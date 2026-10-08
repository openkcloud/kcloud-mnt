"""자원신청 티켓(VM) — 신청 · 목록 · VM 이름 중복 확인.

티켓 1건 = VM 1대. 사용자는 username 으로 식별(요청별 토큰 검증은 Keycloak 도입 시).
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

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db

router = APIRouter(tags=["tkt_request"])

# VM 이름 = 서버 이름 = hostname. Nova hostname 규칙에서 영문은 소문자만 허용
_VM_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$")
_REQUEST_ROLES = ["owner", "member"]  # 신청 가능한 프로젝트 멤버 역할 (viewer 불가)
_MAX_VOLUME_GB = 500


def _iaas(path: str):
    """MNT-IAAS GET(JSON). 주소 미설정은 503, 연결·응답 실패는 502."""
    if not settings.iaas_api_base:
        raise HTTPException(503, "MNT-IAAS 주소(IAAS_API_BASE)가 설정되지 않았습니다")
    url = settings.iaas_api_base.rstrip("/") + "/api/iaas" + path
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"OpenStack 조회(MNT-IAAS) 실패: {e.read().decode(errors='replace')[:300] or e}")
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ValueError) as e:
        raise HTTPException(502, f"OpenStack 조회(MNT-IAAS) 실패: {e}")


def _project_path(project_id: str) -> str:
    return "/projects/" + quote(project_id, safe="")


_SERVER_NAME_TAKEN = "이미 같은 이름의 가상머신이 있습니다."
_TICKET_NAME_TAKEN = "같은 이름으로 신청된 티켓이 있습니다."


def _server_name_taken(project_id: str, name: str) -> bool:
    """같은 프로젝트의 기존 VM(Nova)과 이름이 겹치는지. hostname 은 대소문자 구분이 없으므로 소문자로 비교."""
    names = _iaas(_project_path(project_id) + f"/server-names?name={quote(name, safe='')}")["names"]  # Nova 이름 필터
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
           u.username, u.name AS requester_name, o.id AS org_id, o.name AS org_name,
           ap.username AS approved_by, ap.name AS approved_by_name,
           pv.username AS provisioning_by, pv.name AS provisioning_by_name,
           ar.username AS approved_reject_by, ar.name AS approved_reject_by_name,
           pr.username AS provisioning_reject_by, pr.name AS provisioning_reject_by_name
      FROM tkt_request r
      JOIN iam_user u ON u.id = r.requested_by
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
def requestable_projects(username: str, db: Session = Depends(get_db)):
    """신청할 수 있는 프로젝트 — 내가 owner·member 이고 조직이 할당된(iam_project) 프로젝트.
    이름은 OpenStack 라이브 조회(없거나 비활성인 프로젝트는 제외)."""
    rows = db.execute(
        text("""SELECT pm.project_id, pm.role, o.id AS org_id, o.name AS org_name
                  FROM iam_project_member pm
                  JOIN iam_user u ON u.id = pm.user_id
                  JOIN iam_project p ON p.project_id = pm.project_id
                  JOIN iam_org o ON o.id = p.org_id
                 WHERE u.username = :un AND pm.role = ANY(:roles)"""),
        {"un": username, "roles": _REQUEST_ROLES},
    ).mappings().all()
    if not rows:
        return {"items": []}
    db.rollback()  # 조회 트랜잭션을 닫고 MNT-IAAS 를 호출한다(호출 동안 커넥션을 잡지 않게)
    live = {p["id"]: p for p in _iaas("/projects")["items"] if p.get("enabled", True)}
    items = [{"id": r["project_id"], "name": live[r["project_id"]]["name"], "role": r["role"],
              "orgId": str(r["org_id"]), "orgName": r["org_name"]}
             for r in rows if r["project_id"] in live]
    return {"items": sorted(items, key=lambda x: x["name"])}


@router.get("/tickets/vm-name-check")
def vm_name_check(projectId: str, name: str, db: Session = Depends(get_db)):
    """VM 이름 사용 가능 여부(같은 프로젝트 기준)."""
    if not _VM_NAME_RE.match(name):
        return {"available": False, "reason": "영문 소문자·숫자·하이픈(-) 2~63자로 입력하세요."}
    # MNT-IAAS 를 먼저 호출 — DB 조회 트랜잭션이 열린 채로 외부 호출을 기다리지 않게
    reason = (_SERVER_NAME_TAKEN if _server_name_taken(projectId, name)
              else _TICKET_NAME_TAKEN if _ticket_name_taken(db, projectId, name) else None)
    return {"available": reason is None, "reason": reason}


@router.get("/tickets")
def list_tickets(requestedBy: str | None = None, status: str | None = None, type: str | None = None,
                 orgId: int | None = None, db: Session = Depends(get_db)):
    """티켓 목록(최신순). requestedBy(username)를 주면 그 사용자의 신청만, 없으면 전체(관리자)."""
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
    requestedBy: str             # 신청자 username
    projectId: str               # OpenStack 프로젝트 UUID
    vmName: str
    networkType: str             # 희망 망: internal(내부망) | external(인터넷망)
    floatingIp: bool = False     # 공인 IP 희망 (인터넷망일 때만)
    flavorId: str
    imageId: str
    volumeGb: int | None = None  # 플레이버 disk=0 일 때 부팅 볼륨 크기
    keypairId: int | None = None  # iam_ssh_key.id (선택)


@router.post("/tickets", status_code=201)
def create_ticket(body: CreateTicketBody, db: Session = Depends(get_db)):
    """VM 자원신청. 저장 직전에 서버에서 다시 확인한다 — 멤버·역할, 이름 규칙·중복(DB+Nova),
    플레이버(public)·이미지(프로젝트에서 사용 가능) 존재, 부팅 볼륨 범위, 키페어 소유."""
    user_id = db.execute(
        text("SELECT id FROM iam_user WHERE username = :u AND status = 'active'"), {"u": body.requestedBy},
    ).scalar()
    if user_id is None:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    role = db.execute(
        text("""SELECT pm.role FROM iam_project_member pm
                  JOIN iam_project p ON p.project_id = pm.project_id
                 WHERE pm.project_id = :p AND pm.user_id = :u"""),
        {"p": body.projectId, "u": user_id},
    ).scalar()
    if role not in _REQUEST_ROLES:
        raise HTTPException(403, "신청할 수 없는 프로젝트입니다 (조직이 할당된 프로젝트의 owner·member 만 신청 가능)")
    db.rollback()  # 확인용 조회 트랜잭션을 닫는다 — 아래 MNT-IAAS 호출 동안 커넥션을 잡지 않게

    if body.networkType not in ("internal", "external"):
        raise HTTPException(400, "희망 네트워크는 internal 또는 external 이어야 합니다")
    if not _VM_NAME_RE.match(body.vmName):
        raise HTTPException(400, "가상머신 이름은 영문 소문자·숫자·하이픈(-) 2~63자여야 합니다")

    project = next((p for p in _iaas("/projects")["items"]
                    if p["id"] == body.projectId and p.get("enabled", True)), None)
    if not project:
        raise HTTPException(400, "OpenStack 프로젝트를 찾을 수 없습니다")
    flavor = next((f for f in _iaas("/flavors")["items"] if f["id"] == body.flavorId and f["isPublic"]), None)
    if not flavor:
        raise HTTPException(400, "선택한 스펙(플레이버)을 찾을 수 없습니다")
    image = next((i for i in _iaas(_project_path(body.projectId) + "/images")["items"] if i["id"] == body.imageId), None)
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
    if _server_name_taken(body.projectId, body.vmName):
        raise HTTPException(409, _SERVER_NAME_TAKEN)

    # 여기부터 저장까지 한 트랜잭션 — 외부 호출 없음. 같은 이름 동시 제출은 잠금으로 직렬화(커밋·롤백 시 해제)
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"tkt-vm:{body.projectId}:{body.vmName}"})
    if _ticket_name_taken(db, body.projectId, body.vmName):
        raise HTTPException(409, _TICKET_NAME_TAKEN)
    keypair = None
    if body.keypairId is not None:
        keypair = db.execute(
            text("SELECT id, name FROM iam_ssh_key WHERE id = :id AND owner = :o"),
            {"id": body.keypairId, "o": body.requestedBy},
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


class ReviewBody(BaseModel):
    action: str                  # approve | reject
    processedBy: str             # 처리자 username (admin 역할)
    reason: str | None = None    # 반려 사유 (반려 시 필수)
    expectedStatus: str | None = None  # 화면이 보고 있던 상태 — 다르면 다른 관리자가 먼저 처리한 것(409)


# 반려 단계별 기록 컬럼 접두어 — 대기 → 반려 = 승인 단계 반려, 승인 → 반려 = 프로비저닝 단계 반려
_REJECT_STAGE = {"pending": "approved_reject", "approved": "provisioning_reject"}


@router.patch("/tickets/{ticket_id}")
def review_ticket(ticket_id: str, body: ReviewBody, db: Session = Depends(get_db)):
    """승인·반려(관리자).
    - 승인: 대기(pending) → 승인(approved). 승인 설정(네트워크·보안그룹)은 프로비저닝 단계에서 입력한다.
    - 반려: 대기 → 반려(approved_reject_*), 승인 → 반려(provisioning_reject_*). 사유 필수."""
    if body.action not in ("approve", "reject"):
        raise HTTPException(400, "action 은 approve 또는 reject 여야 합니다")
    admin_id = db.execute(
        text("""SELECT u.id FROM iam_user u
                  JOIN iam_user_role ur ON ur.user_id = u.id
                  JOIN iam_role r ON r.id = ur.role_id
                 WHERE u.username = :u AND u.status = 'active' AND r.code = 'admin'"""),
        {"u": body.processedBy},
    ).scalar()
    if admin_id is None:
        raise HTTPException(403, "승인·반려는 관리자만 할 수 있습니다")
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
            raise HTTPException(409, "대기중이거나 승인된 신청만 반려할 수 있습니다")
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


# ── 프로비저닝 단계 승인 설정 확인 — 프로비저닝 API(개발 중)에서 사용 ─────────────
# 2-1 에서 승인 단계에 두었던 검증을 프로비저닝 단계로 옮겨 둔 것. 아직 호출하는 API 는 없다.

class ProvisionSpecBody(BaseModel):
    networkId: str
    floatingNetworkId: str | None = None  # 내부·공유망 + Floating IP 일 때 FIP 풀(external 망)
    fixedIp: str | None = None            # external 망 Static IP 직접 입력 (없으면 자동 할당)
    securityGroups: list[str] = []        # 보안그룹 이름 (프로젝트 라이브 조회 기준)


def _verified_provision_spec(project_id: str, spec: ProvisionSpecBody) -> dict:
    """승인 설정을 라이브 조회로 다시 확인하고, 네트워크 이름·종류 등은 서버 값으로 채운다."""
    nets = {n["id"]: n for n in _iaas(_project_path(project_id) + "/networks")["items"]}
    net = nets.get(spec.networkId)
    if not net:
        raise HTTPException(400, "이 프로젝트에서 사용할 수 없는 네트워크입니다")
    out = {"networkId": net["id"], "networkName": net["name"], "networkKind": net["kind"]}
    if net["kind"] == "external":
        if spec.floatingNetworkId:
            raise HTTPException(400, "외부(external) 네트워크에는 Floating IP 를 함께 지정할 수 없습니다")
        if spec.fixedIp:
            chk = _iaas(f"/networks/{quote(net['id'], safe='')}/ip-check?ip={quote(spec.fixedIp, safe='')}")
            if not chk["available"]:
                raise HTTPException(409, f"Static IP {spec.fixedIp}: {chk['reason']}")
            out["fixedIp"] = str(ipaddress.ip_address(spec.fixedIp))  # 정규화해서 저장
    else:
        if spec.fixedIp:
            raise HTTPException(400, "Static IP 는 외부(external) 네트워크에서만 지정할 수 있습니다")
        if spec.floatingNetworkId:
            fip = nets.get(spec.floatingNetworkId)
            if not fip or fip["kind"] != "external":
                raise HTTPException(400, "Floating IP 풀은 외부(external) 네트워크여야 합니다")
            out |= {"floatingNetworkId": fip["id"], "floatingNetworkName": fip["name"]}
    sg_names = [g["name"] for g in _iaas(_project_path(project_id) + "/security-groups")["items"]]
    for name in spec.securityGroups:
        if sg_names.count(name) != 1:
            raise HTTPException(400, f"보안그룹 '{name}'을(를) 프로젝트에서 찾을 수 없거나 같은 이름이 여러 개입니다")
    out["securityGroups"] = list(dict.fromkeys(spec.securityGroups))  # 중복 제거, 순서 유지
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
