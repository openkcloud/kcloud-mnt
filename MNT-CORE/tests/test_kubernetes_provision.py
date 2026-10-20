"""서비스 클러스터 프로비저닝 워크플로 — 정상 완료·생성 실패 정리·생성 요청 실패·사전 확인 실패·정리 실패.
로컬 Temporal 개발 서버 + 가짜 작업. 운영과 같은 샌드박스 러너로 띄워 공통 파일 포함 import 위반도 확인한다."""
import asyncio
import shutil
from concurrent.futures import ThreadPoolExecutor

import pytest
from temporalio import activity
from temporalio.client import WorkflowFailureError
from temporalio.exceptions import ApplicationError
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from app.workflows import kubernetes_provision as kp
from app.workflows import vm_provision
from app.workflows.provision_base import CORE_QUEUE

PLAN = ([{"step": "check_creatable", "sub": s} for s in ("check_name", "check_quota", "check_network")]
        + [{"step": "create_cluster", "sub": s} for s in ("send_request", "create_control_plane", "create_workers", "check_api")]
        + [{"step": "setup_cluster", "sub": s} for s in ("create_namespace", "grant_access")])


def _snap(status, master=False, workers=0, api=""):
    return {"status": status, "reason": "Stack 실패(시험)" if status.endswith("FAILED") else "", "masterReady": master,
            "workersActive": workers, "apiAddress": api, "key": f"{status}/{master}/{workers}/{api}"}


WATCH = {
    "wf-ok": [_snap(""), _snap("CREATE_IN_PROGRESS"), _snap("CREATE_IN_PROGRESS", True, 1),
              _snap("CREATE_COMPLETE", True, 2, "https://192.0.2.1:6443")],
    "wf-failed": [_snap("CREATE_IN_PROGRESS"), _snap("CREATE_FAILED")],
    "wf-cleanup-fail": [_snap("CREATE_FAILED")],
}


@pytest.mark.skipif(not shutil.which("temporal"), reason="temporal CLI 없음 — brew install temporal")
def test_클러스터_프로비저닝():
    asyncio.run(_scenarios())


async def _scenarios():
    calls: list[tuple] = []

    def wid():
        return activity.info().workflow_id

    @activity.defn(name="core.init_steps_paas")
    def init_steps_paas(ticket_id, attempt):
        return PLAN

    @activity.defn(name="core.update_steps")
    def update_steps(ticket_id, attempt, changes):
        calls.append(("steps", ticket_id, changes))

    @activity.defn(name="core.finish")
    def finish(ticket_id, status, result, error):
        calls.append(("finish", ticket_id, status, result, error))

    @activity.defn(name="core.grant_cluster_access")
    def grant_cluster_access(project_id, cluster_id):
        calls.append(("grant", wid(), project_id, cluster_id))

    @activity.defn(name="iaas.check_quota")
    def check_quota(project_id, need):
        if wid() == "wf-quota":
            raise ApplicationError("프로젝트 쿼터가 부족합니다 — VM 필요 4대 · 남음 1대", non_retryable=True)
        return f"VM {need['instances']}대 · vCPU {need['vcpu']} · RAM {need['ramGb']}GB"

    @activity.defn(name="iaas.check_network")
    def check_network(network_id, subnet_id, floating_network_id):
        return "my-network / 10.0.1.0/24"

    @activity.defn(name="paas.check_name")
    def check_name(name):
        return name

    @activity.defn(name="paas.create_cluster")
    def create_cluster(project_id, spec):
        calls.append(("create", wid(), project_id, spec))
        if wid() == "wf-request-lost":
            raise ApplicationError("생성 요청 응답 끊김(시험)", non_retryable=True)
        return f"c-{wid()}"

    @activity.defn(name="paas.watch_cluster")
    def watch_cluster(cluster_id, last, max_seconds, interval):
        return WATCH[wid()].pop(0)

    @activity.defn(name="paas.check_api")
    def check_api(cluster_id):
        return "https://192.0.2.1:6443"

    @activity.defn(name="paas.create_namespace")
    def create_namespace(cluster_id, name, project_id, project_name):
        calls.append(("namespace", wid(), cluster_id, name, project_id, project_name))
        return name

    @activity.defn(name="paas.delete_cluster")
    def delete_cluster(project_id, name, cluster_id, deadline):
        calls.append(("delete", wid(), project_id, name, cluster_id))
        if wid() == "wf-cleanup-fail":
            raise ApplicationError("클러스터 삭제가 제한 시간 안에 끝나지 않았습니다 — 삭제 진행 중, 확인 필요",
                                   non_retryable=True)
        return cluster_id is not None

    def inp(tid):
        return {"ticketId": tid, "attempt": 1, "projectId": "p-1", "projectName": "okc_test_prj",
                "clusterName": f"cl-{tid}", "templateId": "t-1", "masterCount": 1, "masterFlavorId": "m1.large",
                "nodeCount": 2, "flavorId": "m1.large", "networkId": "net-1", "subnetId": "sub-1",
                "floatingNetworkId": "pub", "namespace": "okc-test-prj", "need": {"instances": 3, "vcpu": 12, "ramGb": 24}}

    async with await WorkflowEnvironment.start_local(dev_server_existing_path=shutil.which("temporal")) as env:
        with ThreadPoolExecutor(4) as pool:
            # 운영과 같은 샌드박스 러너 — 워크플로 파일이 외부 모듈을 가져오면 여기서 실패한다(VmProvision 도 함께 확인)
            async with Worker(env.client, task_queue=CORE_QUEUE,
                              workflows=[kp.KubernetesProvision, vm_provision.VmProvision],
                              activities=[init_steps_paas, update_steps, finish, grant_cluster_access],
                              activity_executor=pool), \
                       Worker(env.client, task_queue=kp.IAAS_QUEUE, activity_executor=pool,
                              activities=[check_quota, check_network]), \
                       Worker(env.client, task_queue=kp.PAAS_QUEUE, activity_executor=pool,
                              activities=[check_name, create_cluster, watch_cluster, check_api, create_namespace,
                                          delete_cluster]):
                ok = await env.client.execute_workflow(kp.KubernetesProvision.run, inp("wf-ok"), id="wf-ok",
                                                       task_queue=CORE_QUEUE)
                for tid in ("wf-failed", "wf-request-lost", "wf-quota", "wf-cleanup-fail"):
                    with pytest.raises(WorkflowFailureError):
                        await env.client.execute_workflow(kp.KubernetesProvision.run, inp(tid), id=tid,
                                                          task_queue=CORE_QUEUE)

    def fin(tid):
        return next(c for c in calls if c[:2] == ("finish", tid))[2:]

    def sub_values(tid):
        return {c["sub"]: c["value"] for x in calls if x[:2] == ("steps", tid) for c in x[2]
                if "sub" in c and c.get("value")}

    # 정상 완료 — 결과·접근 권한(소유 프로젝트)·네임스페이스, 단계 값
    assert ok == {"clusterId": "c-wf-ok", "clusterName": "cl-wf-ok", "namespace": "okc-test-prj",
                  "apiAddress": "https://192.0.2.1:6443"}
    assert fin("wf-ok") == ("completed", ok, None)
    assert ("grant", "wf-ok", "p-1", "c-wf-ok") in calls
    assert ("namespace", "wf-ok", "c-wf-ok", "okc-test-prj", "p-1", "okc_test_prj") in calls
    create = next(c for c in calls if c[:2] == ("create", "wf-ok"))
    assert create[2] == "p-1" and create[3]["name"] == "cl-wf-ok" and create[3]["subnetId"] == "sub-1"
    assert sub_values("wf-ok") == {"check_name": "cl-wf-ok", "check_quota": "VM 3대 · vCPU 12 · RAM 24GB",
                                   "check_network": "my-network / 10.0.1.0/24", "send_request": "c-wf-ok",
                                   "create_control_plane": "1/1", "create_workers": "2/2",
                                   "check_api": "https://192.0.2.1:6443", "create_namespace": "okc-test-prj",
                                   "grant_access": "okc_test_prj"}

    # 생성 중 실패 — 만든 클러스터(ID)를 지우고 실패
    status, result, error = fin("wf-failed")
    assert status == "failed" and result is None
    assert error == "클러스터 생성 실패(CREATE_FAILED): Stack 실패(시험) — 생성한 클러스터는 삭제함"
    assert ("delete", "wf-failed", "p-1", "cl-wf-failed", "c-wf-failed") in calls

    # 생성 요청 응답이 끊김 — ID 없이 이름으로 찾아 정리(없었으면 덧붙일 말 없음)
    assert ("delete", "wf-request-lost", "p-1", "cl-wf-request-lost", None) in calls
    assert fin("wf-request-lost") == ("failed", None, "생성 요청 응답 끊김(시험)")

    # 사전 확인 실패 — 만든 것이 없어 생성·정리 없음
    assert fin("wf-quota") == ("failed", None, "프로젝트 쿼터가 부족합니다 — VM 필요 4대 · 남음 1대")
    assert not any(c[:2] in (("create", "wf-quota"), ("delete", "wf-quota")) for c in calls)

    # 정리 실패 — 클러스터 ID 를 결과에 남긴다
    status, result, error = fin("wf-cleanup-fail")
    assert status == "failed" and result == {"clusterId": "c-wf-cleanup-fail", "clusterName": "cl-wf-cleanup-fail"}
    assert "생성한 클러스터 정리 실패, 확인 필요(clusterId=c-wf-cleanup-fail)" in error
