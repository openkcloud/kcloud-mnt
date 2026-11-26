"""자원신청 티켓(VM · AI 워크스페이스) — 신청 · 목록 · VM 이름 중복 확인 · 승인·반려 · 프로비저닝(Temporal 워크플로) · 진행 조회.

티켓 1건 = VM 1대. 신청자·처리자는 토큰(Keycloak)의 포털 사용자 — 요청 본문의 이름은 쓰지 않는다.
OpenStack 값(프로젝트·플레이버·이미지·서버 이름)은 MNT-IAAS 라이브 조회로 확인하고,
신청 시점의 이름·스펙을 request_spec 에 함께 저장한다(표시용 스냅샷).
"""
import http.client
import ipaddress
import json
import re
import urllib.error
import urllib.request
from urllib.parse import quote

from anyio import from_thread
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import CurrentUser, current_user
from ..config import settings
from ..db import get_db
from ..workflows import runtime

router = APIRouter(tags=["tkt_request"])

# VM 이름 = 서버 이름 = hostname. Nova hostname 규칙에서 영문은 소문자만 허용
_VM_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$")
_REQUEST_ROLES = ["owner", "member"]  # 신청 가능한 프로젝트 멤버 역할 (viewer 불가)
_MAX_VOLUME_GB = 500


def _iaas(path: str, token: str):
    """MNT-IAAS GET(JSON) — 요청한 사용자의 토큰을 그대로 넘긴다(IAAS 가 같은 기준으로 권한 판정).
    주소 미설정은 503, 권한 거부(401·403)는 그대로, 그 밖의 연결·응답 실패는 502."""
    if not settings.iaas_api_base:
        raise HTTPException(503, "MNT-IAAS 주소(IAAS_API_BASE)가 설정되지 않았습니다")
    url = settings.iaas_api_base.rstrip("/") + "/api/iaas" + path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        if e.code in (401, 403):
            try:
                detail = json.loads(body).get("detail") or body
            except ValueError:
                detail = body
            raise HTTPException(e.code, detail)
        raise HTTPException(502, f"OpenStack 조회(MNT-IAAS) 실패: {body[:300] or e}")
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ValueError) as e:
        raise HTTPException(502, f"OpenStack 조회(MNT-IAAS) 실패: {e}")


def _project_path(project_id: str) -> str:
    return "/projects/" + quote(project_id, safe="")


def _check_requestable(db: Session, project_id: str, user: CurrentUser) -> None:
    """신청할 수 있는 프로젝트인지 — 조직이 할당된(iam_project) 프로젝트의 owner·member. 관리자는 조직이 할당된 모든 프로젝트."""
    if user.is_admin:
        if not db.execute(text("SELECT 1 FROM iam_project WHERE project_id = :p"), {"p": project_id}).first():
            raise HTTPException(403, "신청할 수 없는 프로젝트입니다 (조직이 할당되지 않은 프로젝트)")
        return
    role = db.execute(
        text("""SELECT pm.role FROM iam_project_member pm
                  JOIN iam_project p ON p.project_id = pm.project_id
                 WHERE pm.project_id = :p AND pm.user_id = :u"""),
        {"p": project_id, "u": user.id},
    ).scalar()
    if role not in _REQUEST_ROLES:
        raise HTTPException(403, "신청할 수 없는 프로젝트입니다 (조직이 할당된 프로젝트의 owner·member 만 신청 가능)")


_SERVER_NAME_TAKEN = "이미 같은 이름의 가상머신이 있습니다."
_TICKET_NAME_TAKEN = "같은 이름으로 신청된 티켓이 있습니다."


def _server_name_taken(project_id: str, name: str, token: str) -> bool:
    """같은 프로젝트의 기존 VM(Nova)과 이름이 겹치는지. hostname 은 대소문자 구분이 없으므로 소문자로 비교."""
    names = _iaas(_project_path(project_id) + f"/server-names?name={quote(name, safe='')}", token)["names"]  # Nova 이름 필터
    return name in {n.lower() for n in names}


def _ticket_name_taken(db: Session, project_id: str, name: str) -> bool:
    """같은 프로젝트의 반려되지 않은 VM 티켓과 이름이 겹치는지."""
    return db.execute(
        text("""SELECT 1 FROM tkt_request
                 WHERE type = 'vm' AND project_id = :p AND status <> 'rejected'
                   AND request_spec->>'vmName' = :n"""),
        {"p": project_id, "n": name},
    ).first() is not None


_SELECT = """
    SELECT r.id, r.type, r.status, r.project_id, r.request_spec, r.provision_spec, r.result,
           r.approved_at, r.provisioning_at, r.approved_reject_at, r.approved_reject_reason,
           r.provisioning_reject_at, r.provisioning_reject_reason, r.error_message, r.created_at,
           u.username, u.name AS requester_name, ro.name AS requester_org_name, o.id AS org_id, o.name AS org_name,
           ap.username AS approved_by, ap.name AS approved_by_name,
           pv.username AS provisioning_by, pv.name AS provisioning_by_name,
           ar.username AS approved_reject_by, ar.name AS approved_reject_by_name,
           pr.username AS provisioning_reject_by, pr.name AS provisioning_reject_by_name
      FROM tkt_request r
      JOIN iam_user u ON u.id = r.requested_by
      LEFT JOIN iam_org ro ON ro.id = u.org_id  -- 신청자 본인 조직(관리자는 다른 조직 프로젝트에도 신청)
      JOIN iam_project p ON p.project_id = r.project_id
      JOIN iam_org o ON o.id = p.org_id
      LEFT JOIN iam_user ap ON ap.id = r.approved_by
      LEFT JOIN iam_user pv ON pv.id = r.provisioning_by
      LEFT JOIN iam_user ar ON ar.id = r.approved_reject_by
      LEFT JOIN iam_user pr ON pr.id = r.provisioning_reject_by
"""


def _iso(v) -> str | None:
    return v.isoformat() if v else None


def _to_item(r) -> dict:
    """화면 ResourceRequest 형태 — request_spec 필드를 펼쳐서 내려준다."""
    return {
        **r["request_spec"],
        "id": r["id"],  # 신청 ID (req-YYMMDD-NNN)
        "type": r["type"],
        "status": r["status"],
        "requestedBy": r["username"],
        "requestedByName": r["requester_name"],
        "requesterOrgName": r["requester_org_name"],  # 신청자 조직 — orgId·orgName 은 프로젝트 조직
        "requestedAt": r["created_at"].isoformat(),
        "orgId": str(r["org_id"]),
        "orgName": r["org_name"],
        "projectId": r["project_id"],
        "provisionSpec": r["provision_spec"],
        "result": r["result"],
        # 처리 기록 — 승인 단계(승인 / 반려) · 프로비저닝 단계(시작 / 반려)
        "approvedBy": r["approved_by"],
        "approvedByName": r["approved_by_name"],
        "approvedAt": _iso(r["approved_at"]),
        "provisioningBy": r["provisioning_by"],
        "provisioningByName": r["provisioning_by_name"],
        "provisioningAt": _iso(r["provisioning_at"]),
        "approvedRejectBy": r["approved_reject_by"],
        "approvedRejectByName": r["approved_reject_by_name"],
        "approvedRejectAt": _iso(r["approved_reject_at"]),
        "approvedRejectReason": r["approved_reject_reason"],
        "provisioningRejectBy": r["provisioning_reject_by"],
        "provisioningRejectByName": r["provisioning_reject_by_name"],
        "provisioningRejectAt": _iso(r["provisioning_reject_at"]),
        "provisioningRejectReason": r["provisioning_reject_reason"],
        "errorMessage": r["error_message"],
    }


@router.get("/tickets/projects")
def requestable_projects(user: CurrentUser = Depends(current_user), db: Session = Depends(get_db)):
    """신청할 수 있는 프로젝트 — 내가 owner·member 이고 조직이 할당된(iam_project) 프로젝트(관리자는 조직이 할당된 전부).
    이름은 OpenStack 라이브 조회(없거나 비활성인 프로젝트는 제외)."""
    if user.is_admin:
        rows = db.execute(
            text("""SELECT p.project_id, 'admin' AS role, o.id AS org_id, o.name AS org_name
                      FROM iam_project p JOIN iam_org o ON o.id = p.org_id"""),
        ).mappings().all()
    else:
        rows = db.execute(
            text("""SELECT pm.project_id, pm.role, o.id AS org_id, o.name AS org_name
                      FROM iam_project_member pm
                      JOIN iam_user u ON u.id = pm.user_id
                      JOIN iam_project p ON p.project_id = pm.project_id
                      JOIN iam_org o ON o.id = p.org_id
                     WHERE u.username = :un AND pm.role = ANY(:roles)"""),
            {"un": user.username, "roles": _REQUEST_ROLES},
        ).mappings().all()
    if not rows:
        return {"items": []}
    db.rollback()  # 조회 트랜잭션을 닫고 MNT-IAAS 를 호출한다(호출 동안 커넥션을 잡지 않게)
    live = {p["id"]: p for p in _iaas("/projects", user.token)["items"] if p.get("enabled", True)}
    items = [{"id": r["project_id"], "name": live[r["project_id"]]["name"], "role": r["role"],
              "orgId": str(r["org_id"]), "orgName": r["org_name"]}
             for r in rows if r["project_id"] in live]
    return {"items": sorted(items, key=lambda x: x["name"])}


@router.get("/tickets/vm-name-check")
def vm_name_check(projectId: str, name: str, user: CurrentUser = Depends(current_user),
                  db: Session = Depends(get_db)):
    """VM 이름 사용 가능 여부(같은 프로젝트 기준)."""
    if not _VM_NAME_RE.match(name):
        return {"available": False, "reason": "영문 소문자·숫자·하이픈(-) 2~63자로 입력하세요."}
    # MNT-IAAS 를 먼저 호출 — DB 조회 트랜잭션이 열린 채로 외부 호출을 기다리지 않게
    reason = (_SERVER_NAME_TAKEN if _server_name_taken(projectId, name, user.token)
              else _TICKET_NAME_TAKEN if _ticket_name_taken(db, projectId, name) else None)
    return {"available": reason is None, "reason": reason}


@router.get("/tickets")
def list_tickets(requestedBy: str | None = None, status: str | None = None, type: str | None = None,
                 orgId: int | None = None, user: CurrentUser = Depends(current_user), db: Session = Depends(get_db)):
    """티켓 목록(최신순). 사용자는 본인 신청만(requestedBy 무시), 관리자는 전체 또는 requestedBy(username) 지정."""
    if not user.is_admin:
        requestedBy = user.username
    rows = db.execute(
        text(_SELECT + """
             WHERE (CAST(:by AS text) IS NULL OR u.username = :by)
               AND (CAST(:st AS text) IS NULL OR r.status = :st)
               AND (CAST(:tp AS text) IS NULL OR r.type = :tp)
               AND (CAST(:org AS bigint) IS NULL OR o.id = :org)
             ORDER BY split_part(r.id, '-', 2) DESC, split_part(r.id, '-', 3)::int DESC"""),  # 신청 ID(접수 순) 최신순
        {"by": requestedBy, "st": status, "tp": type, "org": orgId},
    ).mappings().all()
    items = [_to_item(r) for r in rows]
    return {"items": items, "total": len(items)}


class CreateTicketBody(BaseModel):
    requestedBy: str | None = None  # 옛 화면 호환용 — 쓰지 않음(신청자 = 토큰 사용자)
    projectId: str               # OpenStack 프로젝트 UUID
    vmName: str
    networkType: str             # 희망 망: internal(내부망) | external(인터넷망)
    floatingIp: bool = False     # 공인 IP 희망 (인터넷망일 때만)
    flavorId: str
    imageId: str
    volumeGb: int | None = None  # 플레이버 disk=0 일 때 부팅 볼륨 크기
    keypairId: int | None = None  # iam_ssh_key.id (선택)


@router.post("/tickets", status_code=201)
def create_ticket(body: CreateTicketBody, user: CurrentUser = Depends(current_user), db: Session = Depends(get_db)):
    """VM 자원신청(신청자 = 토큰 사용자). 저장 직전에 서버에서 다시 확인한다 — 멤버·역할, 이름 규칙·중복(DB+Nova),
    플레이버(public·가속기 device-profile 있음)·이미지(프로젝트에서 사용 가능) 존재, 부팅 볼륨 범위, 키페어 소유."""
    user_id = user.id
    _check_requestable(db, body.projectId, user)
    db.rollback()  # 확인용 조회 트랜잭션을 닫는다 — 아래 MNT-IAAS 호출 동안 커넥션을 잡지 않게

    if body.networkType not in ("internal", "external"):
        raise HTTPException(400, "희망 네트워크는 internal 또는 external 이어야 합니다")
    if not _VM_NAME_RE.match(body.vmName):
        raise HTTPException(400, "가상머신 이름은 영문 소문자·숫자·하이픈(-) 2~63자여야 합니다")

    project = next((p for p in _iaas("/projects", user.token)["items"]
                    if p["id"] == body.projectId and p.get("enabled", True)), None)
    if not project:
        raise HTTPException(400, "OpenStack 프로젝트를 찾을 수 없습니다")
    flavor = next((f for f in _iaas("/flavors", user.token)["items"] if f["id"] == body.flavorId and f["isPublic"]), None)
    if not flavor:
        raise HTTPException(400, "선택한 스펙(플레이버)을 찾을 수 없습니다")
    if flavor.get("deviceProfileMissing"):  # 가속기 device-profile 이 Cyborg 에 없으면 VM 을 만들 수 없다
        raise HTTPException(400, "연결된 디바이스 프로파일이 존재하지 않습니다")
    image = next((i for i in _iaas(_project_path(body.projectId) + "/images", user.token)["items"]
                  if i["id"] == body.imageId), None)
    if not image:
        raise HTTPException(400, "이 프로젝트에서 사용할 수 없는 템플릿(이미지)입니다")

    # 부팅 디스크는 항상 Cinder 부팅 볼륨 — 크기 = 플레이버 디스크(0이면 입력값), 이미지 최소 크기(가상 크기·min_disk) 이상
    volume_gb = None
    low = max(1, image.get("minVolumeGb", image["minDisk"]))  # MNT-IAAS 가 아직 minVolumeGb 를 안 주는 배포 순서여도 동작
    if flavor["diskGb"] == 0:
        if body.volumeGb is None or not low <= body.volumeGb <= _MAX_VOLUME_GB:
            raise HTTPException(400, f"부팅 볼륨 크기는 {low} ~ {_MAX_VOLUME_GB} GB 여야 합니다")
        volume_gb = body.volumeGb
    elif flavor["diskGb"] < low:
        raise HTTPException(400, f"선택한 스펙의 디스크({flavor['diskGb']} GB)가 템플릿에 필요한 최소 크기({low} GB)보다 작습니다")

    if body.keypairId is not None and not image["cloudInit"]:
        raise HTTPException(400, "cloud-init 이 없는 템플릿에는 키페어를 지정할 수 없습니다")
    if _server_name_taken(body.projectId, body.vmName, user.token):
        raise HTTPException(409, _SERVER_NAME_TAKEN)

    # 여기부터 저장까지 한 트랜잭션 — 외부 호출 없음. 같은 이름 동시 제출은 잠금으로 직렬화(커밋·롤백 시 해제)
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"tkt-vm:{body.projectId}:{body.vmName}"})
    if _ticket_name_taken(db, body.projectId, body.vmName):
        raise HTTPException(409, _TICKET_NAME_TAKEN)
    keypair = None
    if body.keypairId is not None:
        keypair = db.execute(
            text("SELECT id, name FROM iam_ssh_key WHERE id = :id AND owner = :o"),
            {"id": body.keypairId, "o": user.username},
        ).mappings().first()
        if not keypair:
            raise HTTPException(400, "본인 키페어가 아닙니다")

    # 신청 ID: req-YYMMDD-NNN (KST 날짜별 일련번호 = 그날 최대 번호 + 1). 같은 날 동시 신청은 잠금으로 직렬화
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext('tkt-request-no'))"))
    day = db.execute(text("SELECT to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYMMDD')")).scalar()
    last = db.execute(
        text("SELECT max(split_part(id, '-', 3)::int) FROM tkt_request WHERE id LIKE :p"),
        {"p": f"req-{day}-%"},
    ).scalar()
    ticket_id = f"req-{day}-{(last or 0) + 1:03d}"

    spec = {
        "projectName": project["name"],
        "vmName": body.vmName,
        "networkType": body.networkType,
        "floatingIp": body.floatingIp and body.networkType == "external",
        "flavorId": flavor["id"],
        "flavorName": flavor["name"],
        "vcpu": flavor["vcpus"],
        "ramGb": flavor["ramMb"] / 1024,
        "diskGb": flavor["diskGb"],
        "volumeGb": volume_gb,
        "deviceProfile": flavor["accelerator"],
        "accelerators": flavor.get("accelerators") or None,  # 가속기 종류·개수 [{kind: GPU|NPU, count}] — 플레이버 라이브 조회 값
        "imageId": image["id"],
        "imageName": image["name"],
        "cloudInit": image["cloudInit"],
        "keypairId": str(keypair["id"]) if keypair else None,
        "keypairName": keypair["name"] if keypair else None,
    }
    db.execute(
        text("""INSERT INTO tkt_request (id, type, project_id, requested_by, request_spec)
                VALUES (:id, 'vm', :p, :u, CAST(:s AS jsonb))"""),
        {"id": ticket_id, "p": body.projectId, "u": user_id,
         "s": json.dumps({k: v for k, v in spec.items() if v is not None}, ensure_ascii=False)},
    )
    db.commit()
    row = db.execute(text(_SELECT + " WHERE r.id = :id"), {"id": ticket_id}).mappings().one()
    return _to_item(row)


# ── AI 워크스페이스 신청(type ai-workspace) — AI 워크스페이스 = 프로젝트 1:1 (Kubeflow Profile) ─────────
# 승인·반려는 VM 과 같은 PATCH, 프로비저닝은 아래 provision-ai-workspace(Temporal AiWorkspaceProvision).

_WS_NAME_RE = re.compile(r"^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$")


def _ainb(path: str):
    """MNT-AINB GET(JSON). 주소 미설정은 503, 연결·응답 실패는 502."""
    if not settings.ainb_api_base:
        raise HTTPException(503, "MNT-AINB 주소(AINB_API_BASE)가 설정되지 않았습니다")
    url = settings.ainb_api_base.rstrip("/") + "/api/ainb" + path
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"AI 노트북(MNT-AINB) 조회 실패: {e.read().decode(errors='replace')[:300] or e}")
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ValueError) as e:
        raise HTTPException(502, f"AI 노트북(MNT-AINB) 조회 실패: {e}")


def _workspace_name(project_name: str, project_id: str) -> str:
    """프로젝트 이름 → 워크스페이스(네임스페이스) 이름: 소문자·숫자·하이픈만 63자. 남는 게 없으면 ws-<ID 앞 8자리>."""
    name = re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]", "-", project_name.lower()))[:63].strip("-")
    return name if _WS_NAME_RE.match(name) else f"ws-{project_id.replace('-', '')[:8].lower()}"


class CreateAiWorkspaceBody(BaseModel):
    requestedBy: str | None = None  # 옛 화면 호환용 — 쓰지 않음(신청자 = 토큰 사용자)
    projectId: str               # OpenStack 프로젝트 UUID — 이 프로젝트의 AI 워크스페이스
    purpose: str = ""
    cpu: int = 4
    memoryGi: int = 16
    acceleratorCount: int = 0
    storageGi: int = 50


@router.post("/tickets/ai-workspace", status_code=201)
def create_ai_workspace_ticket(body: CreateAiWorkspaceBody, user: CurrentUser = Depends(current_user),
                               db: Session = Depends(get_db)):
    """AI 워크스페이스 신청(신청자 = 토큰 사용자) — 멤버·역할, 프로젝트(라이브), 프로젝트당 1개(처리 중인 신청·기존 워크스페이스),
    워크스페이스 이름 사용 가능(MNT-AINB) 확인."""
    user_id = user.id
    _check_requestable(db, body.projectId, user)
    db.rollback()  # 확인용 조회 트랜잭션을 닫는다 — 아래 MNT-IAAS·AINB 호출 동안 커넥션을 잡지 않게

    for label, v in (("vCPU", body.cpu), ("메모리", body.memoryGi), ("저장공간", body.storageGi)):
        if v < 1:
            raise HTTPException(400, f"{label}는 1 이상이어야 합니다")
    if body.acceleratorCount < 0:
        raise HTTPException(400, "가속기는 0 이상이어야 합니다")
    project = next((p for p in _iaas("/projects", user.token)["items"]
                    if p["id"] == body.projectId and p.get("enabled", True)), None)
    if not project:
        raise HTTPException(400, "OpenStack 프로젝트를 찾을 수 없습니다")
    ws_name = _workspace_name(project["name"], body.projectId)
    # 워크스페이스가 이미 있는지는 클러스터(프로젝트 라벨·이름)로 본다 — 완료된 신청이 있어도 워크스페이스를 지웠으면 다시 신청할 수 있다
    chk = _ainb(f"/workspace-name-check?name={quote(ws_name, safe='')}&projectId={quote(body.projectId, safe='')}")
    if not chk["available"]:
        raise HTTPException(409, f"AI 워크스페이스를 신청할 수 없습니다 — {chk['reason']}")

    # 여기부터 저장까지 한 트랜잭션 — 같은 프로젝트 동시 신청은 잠금으로 직렬화
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"tkt-ai-workspace:{body.projectId}"})
    if db.execute(text("""SELECT 1 FROM tkt_request
                           WHERE type = 'ai-workspace' AND project_id = :p
                             AND status IN ('pending', 'approved', 'provisioning', 'failed')"""),
                  {"p": body.projectId}).first():
        raise HTTPException(409, "이 프로젝트에는 처리 중인 AI 워크스페이스 신청이 있습니다 (프로젝트당 1개)")

    db.execute(text("SELECT pg_advisory_xact_lock(hashtext('tkt-request-no'))"))
    day = db.execute(text("SELECT to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYMMDD')")).scalar()
    last = db.execute(
        text("SELECT max(split_part(id, '-', 3)::int) FROM tkt_request WHERE id LIKE :p"),
        {"p": f"req-{day}-%"},
    ).scalar()
    ticket_id = f"req-{day}-{(last or 0) + 1:03d}"
    spec = {
        "projectName": project["name"],
        "workspaceName": ws_name,
        "purpose": body.purpose.strip()[:300],
        "cpu": body.cpu,
        "memoryGi": body.memoryGi,
        "acceleratorCount": body.acceleratorCount,
        "storageGi": body.storageGi,
    }
    db.execute(
        text("""INSERT INTO tkt_request (id, type, project_id, requested_by, request_spec)
                VALUES (:id, 'ai-workspace', :p, :u, CAST(:s AS jsonb))"""),
        {"id": ticket_id, "p": body.projectId, "u": user_id, "s": json.dumps(spec, ensure_ascii=False)},
    )
    db.commit()
    row = db.execute(text(_SELECT + " WHERE r.id = :id"), {"id": ticket_id}).mappings().one()
    return _to_item(row)


class ReviewBody(BaseModel):
    action: str                  # approve | reject
    processedBy: str | None = None  # 옛 화면 호환용 — 쓰지 않음(처리자 = 토큰 사용자, admin 역할)
    reason: str | None = None    # 반려 사유 (반려 시 필수)
    expectedStatus: str | None = None  # 화면이 보고 있던 상태 — 다르면 다른 관리자가 먼저 처리한 것(409)


def _admin_id(db: Session, username: str, denied: str) -> int:
    """관리자(admin 역할) 사용자 ID — 아니면 403(denied)."""
    admin_id = db.execute(
        text("""SELECT u.id FROM iam_user u
                  JOIN iam_user_role ur ON ur.user_id = u.id
                  JOIN iam_role r ON r.id = ur.role_id
                 WHERE u.username = :u AND u.status = 'active' AND r.code = 'admin'"""),
        {"u": username},
    ).scalar()
    if admin_id is None:
        raise HTTPException(403, denied)
    return admin_id


# 반려 단계별 기록 컬럼 접두어 — 대기 → 반려 = 승인 단계 반려, 승인·실패 → 반려 = 프로비저닝 단계 반려
# (실패한 회차가 만든 자원은 워크플로가 실패 때 이미 정리했다)
_REJECT_STAGE = {"pending": "approved_reject", "approved": "provisioning_reject", "failed": "provisioning_reject"}


@router.patch("/tickets/{ticket_id}")
def review_ticket(ticket_id: str, body: ReviewBody, user: CurrentUser = Depends(current_user),
                  db: Session = Depends(get_db)):
    """승인·반려(관리자).
    - 승인: 대기(pending) → 승인(approved). 승인 설정(네트워크·보안그룹)은 프로비저닝 단계에서 입력한다.
    - 반려: 대기 → 반려(approved_reject_*), 승인·실패 → 반려(provisioning_reject_*). 사유 필수."""
    if body.action not in ("approve", "reject"):
        raise HTTPException(400, "action 은 approve 또는 reject 여야 합니다")
    admin_id = _admin_id(db, user.username, "승인·반려는 관리자만 할 수 있습니다")
    status = db.execute(text("SELECT status FROM tkt_request WHERE id = :id"), {"id": ticket_id}).scalar()
    if status is None:
        raise HTTPException(404, "신청을 찾을 수 없습니다")
    if body.expectedStatus and body.expectedStatus != status:
        raise HTTPException(409, "다른 관리자가 먼저 처리했습니다. 목록을 새로 고쳐 확인하세요")

    params = {"id": ticket_id, "cur": status, "by": admin_id}
    if body.action == "approve":
        if status != "pending":
            raise HTTPException(409, "대기중인 신청만 승인할 수 있습니다")
        sets = "status = 'approved', approved_by = :by, approved_at = now()"
    else:
        stage = _REJECT_STAGE.get(status)
        if stage is None:
            raise HTTPException(409, "대기·승인·실패 상태의 신청만 반려할 수 있습니다")
        params["reason"] = (body.reason or "").strip()
        if not params["reason"]:
            raise HTTPException(400, "반려 사유를 입력하세요")
        sets = f"status = 'rejected', {stage}_by = :by, {stage}_at = now(), {stage}_reason = :reason"

    # 읽은 상태 그대로일 때만 바꾼다 — 그사이 다른 관리자가 처리했으면 0건 → 409
    res = db.execute(text(f"UPDATE tkt_request SET {sets} WHERE id = :id AND status = :cur"), params)
    if res.rowcount == 0:
        db.rollback()
        raise HTTPException(409, "다른 관리자가 먼저 처리했습니다. 목록을 새로 고쳐 확인하세요")
    db.commit()
    return _to_item(db.execute(text(_SELECT + " WHERE r.id = :id"), {"id": ticket_id}).mappings().one())


# ── 프로비저닝 — 승인 설정 확인 후 Temporal 워크플로(VmProvision) 시작 ─────────────

class ProvisionSpecBody(BaseModel):
    networkId: str
    floatingNetworkId: str | None = None  # 내부·공유망 + Floating IP 일 때 FIP 풀(external 망)
    fixedIp: str | None = None            # 고정 IP 직접 입력 — 모든 망 (없으면 DHCP 자동 할당)
    securityGroups: list[str] = []        # 보안그룹 이름 (프로젝트 라이브 조회 기준)
    host: str | None = None               # 배치할 컴퓨트 노드(미리보기에서 고름) — 노드 지정 권한이 있을 때만, 없으면 스케줄러


def _verified_provision_spec(project_id: str, flavor_id: str, spec: ProvisionSpecBody, token: str) -> dict:
    """승인 설정을 라이브 조회로 다시 확인하고, 네트워크 이름·종류 등은 서버 값으로 채운다."""
    nets = {n["id"]: n for n in _iaas(_project_path(project_id) + "/networks", token)["items"]}
    net = nets.get(spec.networkId)
    if not net:
        raise HTTPException(400, "이 프로젝트에서 사용할 수 없는 네트워크입니다")
    out = {"networkId": net["id"], "networkName": net["name"], "networkKind": net["kind"]}
    if spec.fixedIp:  # 직접 입력(고정 IP) — 망 종류와 무관, 없으면 DHCP 자동 할당
        chk = _iaas(f"/networks/{quote(net['id'], safe='')}/ip-check?ip={quote(spec.fixedIp, safe='')}", token)
        if not chk["available"]:
            raise HTTPException(409, f"Static IP {spec.fixedIp}: {chk['reason']}")
        out["fixedIp"] = str(ipaddress.ip_address(spec.fixedIp))  # 정규화해서 저장
    if net["kind"] == "external":
        if spec.floatingNetworkId:
            raise HTTPException(400, "외부(external) 네트워크에는 Floating IP 를 함께 지정할 수 없습니다")
    else:
        if spec.floatingNetworkId:
            fip = nets.get(spec.floatingNetworkId)
            if not fip or fip["kind"] != "external":
                raise HTTPException(400, "Floating IP 풀은 외부(external) 네트워크여야 합니다")
            # VM 을 만든 뒤 FIP 단계에서야 실패하지 않게 — 네트워크가 FIP 풀로 나가는 라우터와 연결돼 있는지 미리 확인
            chk = _iaas(f"/networks/{quote(net['id'], safe='')}/fip-reachable?floatingNetworkId={quote(fip['id'], safe='')}",
                        token)
            if not chk["reachable"]:
                raise HTTPException(400, f"{net['name']} 네트워크는 Floating IP({fip['name']})를 연결할 수 없습니다\n"
                                         "Floating IP 연관 라우터와 연결돼 있지 않습니다.")  # 서브넷별 사유는 IAAS 응답(chk)에
            out |= {"floatingNetworkId": fip["id"], "floatingNetworkName": fip["name"]}
    if not spec.securityGroups:
        raise HTTPException(400, "보안그룹을 하나 이상 선택하세요")
    sg_names = [g["name"] for g in _iaas(_project_path(project_id) + "/security-groups", token)["items"]]
    for name in spec.securityGroups:
        if sg_names.count(name) != 1:
            raise HTTPException(400, f"보안그룹 '{name}'을(를) 프로젝트에서 찾을 수 없거나 같은 이름이 여러 개입니다")
    out["securityGroups"] = list(dict.fromkeys(spec.securityGroups))  # 중복 제거, 순서 유지
    if spec.host:  # 미리보기 뒤 권한·자원이 바뀌었을 수 있다 — 지금도 지정할 수 있고 후보인지
        pv = _iaas(f"/placement-preview?flavorId={quote(flavor_id, safe='')}&projectId={quote(project_id, safe='')}", token)
        if not pv["hostPinning"]:
            raise HTTPException(409, "노드를 지정할 권한이 없습니다 — 화면을 새로 고쳐 다시 시도하세요")
        if not any(n["host"] == spec.host and n["candidate"] for n in pv["nodes"]):
            raise HTTPException(409, f"선택한 노드({spec.host})에는 지금 배치할 수 없습니다 — 미리보기를 새로 고쳐 다시 선택하세요")
        out["host"] = spec.host
    return out


def _check_fixed_ip_unassigned(db: Session, ticket_id: str, spec: dict) -> None:
    """Neutron 포트는 VM 생성 때 생기므로, 같은 Static IP 가 지정된 다른 신청(생성 중·재시도 대상 실패)도 확인.
    같은 IP 동시 지정은 잠금으로 직렬화(트랜잭션 종료 시 해제) — 저장과 같은 트랜잭션 안에서 호출할 것."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"tkt-ip:{spec['networkId']}:{spec['fixedIp']}"})
    other = db.execute(
        text("""SELECT id FROM tkt_request
                 WHERE id <> :id AND status IN ('provisioning', 'failed')
                   AND provision_spec->>'networkId' = :net AND provision_spec->>'fixedIp' = :ip"""),
        {"id": ticket_id, "net": spec["networkId"], "ip": spec["fixedIp"]},
    ).scalar()
    if other:
        raise HTTPException(409, f"Static IP {spec['fixedIp']}: 다른 신청({other})에 이미 지정된 IP입니다")


class ProvisionBody(BaseModel):
    processedBy: str | None = None     # 옛 화면 호환용 — 쓰지 않음(처리자 = 토큰 사용자, admin 역할)
    expectedStatus: str | None = None  # 화면이 보고 있던 상태 — 다르면 409
    provisionSpec: ProvisionSpecBody


@router.post("/tickets/{ticket_id}/provision")
def provision_ticket(ticket_id: str, body: ProvisionBody, user: CurrentUser = Depends(current_user),
                     db: Session = Depends(get_db)):
    """프로비저닝 시작(관리자) — 승인(approved)된 VM 신청, 또는 실패(failed)한 신청의 재시도.
    승인 설정(네트워크·IP·보안그룹)과 VM 이름 중복을 라이브 조회로 다시 확인하고, 생성 중(provisioning)으로 바꾼 뒤
    Temporal 워크플로를 새 회차로 시작한다(실패한 회차의 자원은 워크플로가 실패 때 정리했으므로 처음부터).
    워크플로 시작에 실패하면 이전 상태·값으로 되돌린다."""
    if not settings.temporal_api_base:
        raise HTTPException(503, "Temporal 주소(TEMPORAL_API_BASE)가 설정되지 않았습니다")
    admin_id = _admin_id(db, user.username, "프로비저닝은 관리자만 할 수 있습니다")
    t = db.execute(text("""SELECT status, type, project_id, request_spec, provision_spec, result, error_message,
                                  provisioning_by, provisioning_at, workflow_id
                             FROM tkt_request WHERE id = :id"""),
                   {"id": ticket_id}).mappings().first()
    if t is None:
        raise HTTPException(404, "신청을 찾을 수 없습니다")
    if body.expectedStatus and body.expectedStatus != t["status"]:
        raise HTTPException(409, "다른 관리자가 먼저 처리했습니다. 목록을 새로 고쳐 확인하세요")
    if t["type"] != "vm" or t["status"] not in ("approved", "failed"):
        raise HTTPException(409, "승인되었거나 실패한 VM 신청만 프로비저닝(재시도)할 수 있습니다")
    rs = t["request_spec"]
    db.rollback()  # MNT-IAAS 확인 동안 커넥션을 잡지 않게

    spec = _verified_provision_spec(t["project_id"], rs["flavorId"], body.provisionSpec, user.token)
    if _server_name_taken(t["project_id"], rs["vmName"], user.token):  # 신청 뒤에 같은 이름 VM 이 생겼을 수 있다
        raise HTTPException(409, _SERVER_NAME_TAKEN)

    # 여기부터 저장까지 한 트랜잭션
    if spec.get("fixedIp"):
        _check_fixed_ip_unassigned(db, ticket_id, spec)
    public_key = None
    if rs.get("keypairId"):
        public_key = db.execute(text("SELECT public_key FROM iam_ssh_key WHERE id = :id"),
                                {"id": int(rs["keypairId"])}).scalar()
        if public_key is None:
            raise HTTPException(409, f"신청한 키페어({rs.get('keypairName')})가 삭제되어 주입할 수 없습니다")
    # 회차 — 다시 돌리면(예: 실패 후 승인 상태로 되돌려 재실행) 새 회차로 기록하고, 이전 회차 기록은 이력으로 남긴다
    attempt = db.execute(text("SELECT coalesce(max(attempt), 0) + 1 FROM tkt_provision_step WHERE request_id = :id"),
                         {"id": ticket_id}).scalar()
    workflow_id = f"vm-provision-{ticket_id}-{attempt}"
    res = db.execute(
        text("""UPDATE tkt_request
                   SET status = 'provisioning', provision_spec = CAST(:spec AS jsonb), provisioning_by = :by,
                       provisioning_at = now(), workflow_id = :wf, error_message = NULL, result = NULL
                 WHERE id = :id AND status = :cur"""),
        {"id": ticket_id, "spec": json.dumps(spec, ensure_ascii=False), "by": admin_id, "wf": workflow_id,
         "cur": t["status"]},
    )
    if res.rowcount == 0:
        db.rollback()
        raise HTTPException(409, "다른 관리자가 먼저 처리했습니다. 목록을 새로 고쳐 확인하세요")
    db.commit()

    accel = ", ".join(f"{a['kind']} × {a['count']}" for a in rs.get("accelerators") or [])
    inp = {
        "ticketId": ticket_id, "attempt": attempt, "projectId": t["project_id"],
        "vmName": rs["vmName"], "flavorId": rs["flavorId"], "imageId": rs["imageId"],
        "volumeGb": rs.get("volumeGb") or rs["diskGb"],  # 부팅 볼륨 = 플레이버 디스크(0이면 신청 입력값)
        "networkId": spec["networkId"],
        "networkLabel": spec["networkName"] + (" (external)" if spec["networkKind"] == "external" else ""),
        "fixedIp": spec.get("fixedIp"), "securityGroups": spec["securityGroups"],
        "floatingNetworkId": spec.get("floatingNetworkId"),
        "host": spec.get("host"),
        "publicKey": public_key,
        "keypairLabel": rs.get("keypairName") or ("미적용 (cloud-init 없음)" if rs.get("cloudInit") is False else "미지정"),
        "hasAccelerator": bool(rs.get("deviceProfile")),
        "acceleratorLabel": accel or rs.get("deviceProfile"),
    }
    try:
        from_thread.run(runtime.start_vm_provision, workflow_id, inp)  # 이벤트 루프의 Temporal 클라이언트로 시작
    except Exception as e:  # noqa: BLE001 — 시작 실패면 이전 상태(승인·실패)와 값으로 되돌린다
        db.execute(text("""UPDATE tkt_request
                              SET status = :st, provision_spec = CAST(:spec AS jsonb), provisioning_by = :by,
                                  provisioning_at = :at, workflow_id = :wf, error_message = :err,
                                  result = CAST(:res AS jsonb)
                            WHERE id = :id AND status = 'provisioning'"""),
                   {"id": ticket_id, "st": t["status"], "by": t["provisioning_by"], "at": t["provisioning_at"],
                    "wf": t["workflow_id"], "err": t["error_message"],
                    "spec": json.dumps(t["provision_spec"], ensure_ascii=False) if t["provision_spec"] else None,
                    "res": json.dumps(t["result"]) if t["result"] else None})
        db.commit()
        raise HTTPException(503, f"프로비저닝 워크플로를 시작하지 못했습니다: {e}")
    return _to_item(db.execute(text(_SELECT + " WHERE r.id = :id"), {"id": ticket_id}).mappings().one())


class ProvisionAiWorkspaceBody(BaseModel):
    processedBy: str                   # 처리자 username (admin 역할)
    expectedStatus: str | None = None  # 화면이 보고 있던 상태 — 다르면 409
    # 승인하며 조정한 자원 한도 (비우면 신청 값)
    cpu: int | None = None
    memoryGi: int | None = None
    acceleratorCount: int | None = None
    storageGi: int | None = None


@router.post("/tickets/{ticket_id}/provision-ai-workspace")
def provision_ai_workspace_ticket(ticket_id: str, body: ProvisionAiWorkspaceBody, db: Session = Depends(get_db)):
    """AI 워크스페이스 생성 시작(관리자) — 승인(approved)된 신청, 또는 실패(failed)한 신청의 재시도.
    자원 한도를 확정해 생성 중(provisioning)으로 바꾼 뒤 Temporal 워크플로(AiWorkspaceProvision)를 새 회차로 시작한다.
    워크플로 시작에 실패하면 이전 상태·값으로 되돌린다."""
    if not settings.temporal_api_base:
        raise HTTPException(503, "Temporal 주소(TEMPORAL_API_BASE)가 설정되지 않았습니다")
    admin_id = _admin_id(db, body.processedBy, "프로비저닝은 관리자만 할 수 있습니다")
    t = db.execute(text("""SELECT r.status, r.type, r.project_id, r.request_spec, r.provision_spec, r.result,
                                  r.error_message, r.provisioning_by, r.provisioning_at, r.workflow_id,
                                  u.username, u.email
                             FROM tkt_request r JOIN iam_user u ON u.id = r.requested_by
                            WHERE r.id = :id"""),
                   {"id": ticket_id}).mappings().first()
    if t is None:
        raise HTTPException(404, "신청을 찾을 수 없습니다")
    if body.expectedStatus and body.expectedStatus != t["status"]:
        raise HTTPException(409, "다른 관리자가 먼저 처리했습니다. 목록을 새로 고쳐 확인하세요")
    if t["type"] != "ai-workspace" or t["status"] not in ("approved", "failed"):
        raise HTTPException(409, "승인되었거나 실패한 AI 워크스페이스 신청만 생성(재시도)할 수 있습니다")
    rs = t["request_spec"]
    spec = {k: rs[k] if getattr(body, k) is None else getattr(body, k)
            for k in ("cpu", "memoryGi", "acceleratorCount", "storageGi")}
    for label, k in (("vCPU", "cpu"), ("메모리", "memoryGi"), ("저장공간", "storageGi")):
        if spec[k] < 1:
            raise HTTPException(400, f"{label}는 1 이상이어야 합니다")
    if spec["acceleratorCount"] < 0:
        raise HTTPException(400, "가속기는 0 이상이어야 합니다")

    attempt = db.execute(text("SELECT coalesce(max(attempt), 0) + 1 FROM tkt_provision_step WHERE request_id = :id"),
                         {"id": ticket_id}).scalar()
    workflow_id = f"ai-workspace-provision-{ticket_id}-{attempt}"
    res = db.execute(
        text("""UPDATE tkt_request
                   SET status = 'provisioning', provision_spec = CAST(:spec AS jsonb), provisioning_by = :by,
                       provisioning_at = now(), workflow_id = :wf, error_message = NULL, result = NULL
                 WHERE id = :id AND status = :cur"""),
        {"id": ticket_id, "spec": json.dumps(spec), "by": admin_id, "wf": workflow_id, "cur": t["status"]},
    )
    if res.rowcount == 0:
        db.rollback()
        raise HTTPException(409, "다른 관리자가 먼저 처리했습니다. 목록을 새로 고쳐 확인하세요")
    db.commit()

    inp = {
        "ticketId": ticket_id, "attempt": attempt, "projectId": t["project_id"],
        "projectName": rs.get("projectName"), "workspaceName": rs["workspaceName"],
        "ownerEmail": t["email"] or f"{t['username']}@openkcloud.local", **spec,
    }
    try:
        from_thread.run(runtime.start_ai_workspace_provision, workflow_id, inp)
    except Exception as e:  # noqa: BLE001 — 시작 실패면 이전 상태(승인·실패)와 값으로 되돌린다
        db.execute(text("""UPDATE tkt_request
                              SET status = :st, provision_spec = CAST(:spec AS jsonb), provisioning_by = :by,
                                  provisioning_at = :at, workflow_id = :wf, error_message = :err,
                                  result = CAST(:res AS jsonb)
                            WHERE id = :id AND status = 'provisioning'"""),
                   {"id": ticket_id, "st": t["status"], "by": t["provisioning_by"], "at": t["provisioning_at"],
                    "wf": t["workflow_id"], "err": t["error_message"],
                    "spec": json.dumps(t["provision_spec"]) if t["provision_spec"] else None,
                    "res": json.dumps(t["result"]) if t["result"] else None})
        db.commit()
        raise HTTPException(503, f"프로비저닝 워크플로를 시작하지 못했습니다: {e}")
    return _to_item(db.execute(text(_SELECT + " WHERE r.id = :id"), {"id": ticket_id}).mappings().one())


@router.get("/tickets/{ticket_id}/steps")
def ticket_steps(ticket_id: str, user: CurrentUser = Depends(current_user), db: Session = Depends(get_db)):
    """프로비저닝 진행(현재 회차) — 단계 5개와 상세 단계. 이름은 공통코드.
    현재 회차는 티켓의 workflow_id(vm-provision-{신청ID}-{회차})로 정한다 — 재시도 직후 새 회차 단계가 등록되기 전에는
    빈 목록을 돌려준다(가장 큰 회차로 고르면 그 사이 이전 회차 기록이 보인다).
    now = 이 응답을 읽기 시작한 DB 시각 — 단계 시각(DB now())과 같은 시계라 화면이 진행 중 시간을 서버 기준으로 그린다."""
    t = db.execute(text("""SELECT status, result, error_message, workflow_id, requested_by, clock_timestamp() AS now
                             FROM tkt_request WHERE id = :id"""),
                   {"id": ticket_id}).mappings().first()
    if t is None or not (user.is_admin or t["requested_by"] == user.id):  # 남의 신청은 없는 것처럼
        raise HTTPException(404, "신청을 찾을 수 없습니다")
    tail = (t["workflow_id"] or "").rsplit("-", 1)[-1]
    attempt = int(tail) if tail.isdigit() else db.execute(
        text("SELECT coalesce(max(attempt), 1) FROM tkt_provision_step WHERE request_id = :id"), {"id": ticket_id},
    ).scalar()
    steps = db.execute(
        text("""SELECT s.id, s.seq, s.step_code, c.name, s.status, s.started_at, s.ended_at, s.error_message
                  FROM tkt_provision_step s
                  JOIN cmn_code c ON c.group_code = s.step_group_code AND c.code = s.step_code
                 WHERE s.request_id = :id AND s.attempt = :a
                 ORDER BY s.seq"""),
        {"id": ticket_id, "a": attempt},
    ).mappings().all()
    subs = db.execute(
        text("""SELECT ss.step_id, ss.substep_code, c.name, ss.value, ss.status, ss.started_at, ss.ended_at
                  FROM tkt_provision_substep ss
                  JOIN cmn_code c ON c.group_code = ss.substep_group_code AND c.code = ss.substep_code
                 WHERE ss.step_id = ANY(:ids)
                 ORDER BY ss.seq"""),
        {"ids": [s["id"] for s in steps]},
    ).mappings().all()
    return {
        "status": t["status"],
        "now": _iso(t["now"]),
        "attempt": attempt,
        "errorMessage": t["error_message"],
        "result": t["result"],
        "items": [{
            "seq": s["seq"], "code": s["step_code"], "message": s["name"], "status": s["status"],
            "startedAt": _iso(s["started_at"]), "endedAt": _iso(s["ended_at"]), "error": s["error_message"],
            "details": [{"code": d["substep_code"], "label": d["name"], "value": d["value"], "status": d["status"],
                         "startedAt": _iso(d["started_at"]), "endedAt": _iso(d["ended_at"])}
                        for d in subs if d["step_id"] == s["id"]],
        } for s in steps],
    }
