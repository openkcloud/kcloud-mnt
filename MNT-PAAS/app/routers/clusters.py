"""서비스 클러스터(Magnum K8s) — 조회 + kubeconfig 발급 + 삭제(관리자).

생성은 자원신청 → 관리자 승인 → 프로비저닝 워크플로(workflows/activities.py). 삭제는 관리 화면에서 관리자가 직접 수행한다.
권한(auth.py): 목록은 관리자 전체·사용자는 접근 권한이 있는 클러스터만, 상세·kubeconfig 는 그 클러스터 접근 권한, 삭제는 관리자.
"""
from __future__ import annotations

import base64
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from ..auth import Caller, caller, cluster_member, require_admin
from ..openstack_client import magnum

router = APIRouter(tags=["clusters"])


def _err(e: Exception) -> HTTPException:  # noqa: ANN001
    return HTTPException(status_code=502, detail=f"magnum api error: {type(e).__name__}: {e}")


def _summary(c: dict) -> dict:
    """목록/상세 공통 필드 — 사용자 관점(물리·전력 없음)."""
    return {
        "id": c["uuid"],
        "name": c["name"],
        "status": c.get("status", ""),
        "healthStatus": c.get("health_status") or "",
        "k8sVersion": c.get("coe_version") or "",
        "projectId": c.get("project_id") or "",
        "nodeCount": c.get("node_count", 0),
        "masterCount": c.get("master_count", 0),
        "flavorId": c.get("flavor_id") or "",
        "masterFlavorId": c.get("master_flavor_id") or "",
        "apiAddress": c.get("api_address") or "",
        "createdAt": c.get("created_at") or "",
    }


_NAME_RE = re.compile(r"^[a-z]([a-z0-9-]{0,38}[a-z0-9])?$")
NAME_RULE = "클러스터 이름은 영문 소문자로 시작하고 소문자·숫자·하이픈(끝 제외)만, 40자 이내로 입력하세요."
NAME_TAKEN = "이미 사용 중인 클러스터 이름입니다."


def name_rule_ok(name: str) -> bool:
    return bool(_NAME_RE.match(name))


def name_taken(name: str) -> bool:
    """모든 클러스터(다른 프로젝트 포함 — 서비스 계정 admin 스코프)에 같은 이름이 있는지. 삭제 중인 것도 포함."""
    return any(x["name"] == name for x in magnum.get("/clusters").get("clusters", []))


@router.get("/cluster-name-check")
def cluster_name_check(name: str):
    """클러스터 이름 사용 가능 여부 — 신청 화면의 중복 확인. 이름 사용 여부만 돌려주므로 다른 프로젝트 정보는 드러나지 않는다.
    (GET /clusters 는 일반 사용자에게 접근 가능한 클러스터만 줘서 중복 확인에 못 쓴다)"""
    if not name_rule_ok(name):
        return {"available": False, "reason": NAME_RULE}
    try:
        taken = name_taken(name)
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    return {"available": not taken, "reason": NAME_TAKEN if taken else None}


@router.get("/clusters")
def list_clusters(c: Caller = Depends(caller)):
    """클러스터 목록 — Magnum 목록엔 버전·project_id 가 없어 상세로 enrich(수가 적음).
    관리자는 전체, 사용자는 접근 권한이 있는 클러스터만(상세 조회 전에 거른다)."""
    try:
        items = [x for x in magnum.get("/clusters").get("clusters", []) if c.can(x["uuid"])]
        detailed = [magnum.get(f"/clusters/{x['uuid']}") for x in items]
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    return {"items": [_summary(d) for d in detailed]}


@router.get("/clusters/{cluster_id}", dependencies=[Depends(cluster_member)])
def get_cluster(cluster_id: str):
    """클러스터 상세 + 노드그룹(노드풀)."""
    try:
        c = magnum.get(f"/clusters/{cluster_id}")
        ngs = magnum.get(f"/clusters/{cluster_id}/nodegroups").get("nodegroups", [])
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    d = _summary(c)
    d.update({
        "healthReason": c.get("health_status_reason") or {},
        "statusReason": c.get("status_reason") or "",
        "labels": c.get("labels") or {},
        "fixedNetworkId": c.get("fixed_network") or "",
        "floatingIpEnabled": bool(c.get("floating_ip_enabled")),
        "updatedAt": c.get("updated_at") or "",
        "nodegroups": [
            {
                "id": g["uuid"],
                "name": g["name"],
                "role": g.get("role", ""),
                "flavorId": g.get("flavor_id") or "",
                "imageId": g.get("image_id") or "",
                "nodeCount": g.get("node_count", 0),
                "status": g.get("status", ""),
            }
            for g in ngs
        ],
    })
    return d


@router.delete("/clusters/{cluster_id}", dependencies=[Depends(require_admin)])
def delete_cluster(cluster_id: str):
    """클러스터 삭제(관리자). Magnum DELETE 는 비동기 — 호출 후 DELETE_IN_PROGRESS 로 바뀐다."""
    try:
        return magnum.request("DELETE", f"/clusters/{cluster_id}")
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@router.get("/clusters/{cluster_id}/kubeconfig", dependencies=[Depends(cluster_member)])
def get_kubeconfig(cluster_id: str):
    """kubeconfig 발급 — Magnum 엔 다운로드 API 가 없어 포털이 조립한다
    (openstack coe cluster config 와 동일 원리). 인증서 발급은 k8s_client 와 공용.
    """
    from ..k8s_client import issue_client_cert

    try:
        c = magnum.get(f"/clusters/{cluster_id}")
        api_address, ca_pem, signed, key_pem = issue_client_cert(cluster_id)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise _err(e)

    b64 = lambda s: base64.b64encode(s.encode()).decode()  # noqa: E731
    name = c.get("name", cluster_id)
    kubeconfig = f"""apiVersion: v1
kind: Config
clusters:
- name: {name}
  cluster:
    server: {api_address}
    certificate-authority-data: {b64(ca_pem)}
users:
- name: admin
  user:
    client-certificate-data: {b64(signed)}
    client-key-data: {b64(key_pem)}
contexts:
- name: {name}
  context:
    cluster: {name}
    user: admin
current-context: {name}
"""
    return Response(
        content=kubeconfig,
        media_type="application/yaml",
        headers={"Content-Disposition": f'attachment; filename="{name}-kubeconfig.yaml"'},
    )
