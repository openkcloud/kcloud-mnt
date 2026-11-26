"""서비스 클러스터(Magnum K8s) — 조회 + kubeconfig 발급 + 삭제(관리자).

생성은 자원신청 → 관리자 승인 흐름(추후). 삭제는 관리 화면에서 관리자가 직접 수행한다.
권한(auth.py): 목록은 관리자 전체·사용자는 접근 권한이 있는 클러스터만, 상세·kubeconfig 는 그 클러스터 접근 권한, 삭제는 관리자.
"""
from __future__ import annotations

import base64

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
