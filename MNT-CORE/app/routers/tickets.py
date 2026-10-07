"""자원신청 티켓(VM) — 신청 · 목록 · VM 이름 중복 확인.

티켓 1건 = VM 1대. 사용자는 username 으로 식별(요청별 토큰 검증은 Keycloak 도입 시).
OpenStack 값(프로젝트·플레이버·이미지·서버 이름)은 MNT-IAAS 라이브 조회로 확인하고,
신청 시점의 이름·스펙을 request_spec 에 함께 저장한다(표시용 스냅샷).
"""
import http.client
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
    return name in {n.lower() for n in _iaas(_project_path(project_id) + "/server-names")["names"]}


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
           r.reviewed_at, r.reject_reason, r.error_message, r.created_at,
           u.username, u.name AS requester_name, o.id AS org_id, o.name AS org_name,
           rv.username AS reviewer_username, rv.name AS reviewer_name
      FROM tkt_request r
      JOIN iam_user u ON u.id = r.requested_by
      JOIN iam_project p ON p.project_id = r.project_id
      JOIN iam_org o ON o.id = p.org_id
      LEFT JOIN iam_user rv ON rv.id = r.reviewed_by
"""


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
        "reviewedBy": r["reviewer_username"],
        "reviewedByName": r["reviewer_name"],
        "reviewedAt": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
        "rejectReason": r["reject_reason"],
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

    volume_gb = None
    if flavor["diskGb"] == 0:
        low = max(1, image["minDisk"])
        if body.volumeGb is None or not low <= body.volumeGb <= _MAX_VOLUME_GB:
            raise HTTPException(400, f"부팅 볼륨 크기는 {low} ~ {_MAX_VOLUME_GB} GB 여야 합니다")
        volume_gb = body.volumeGb

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
