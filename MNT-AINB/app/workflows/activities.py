"""AINB 워커가 실행하는 작업 — AI 워크스페이스(Kubeflow Profile = 네임스페이스 + 자원 한도) 생성·대기·정리.

워크플로(MNT-CORE ai_workspace_provision)가 이름으로 부른다. 재시도돼도 결과가 같도록(멱등) 작성한다.
쿠버네티스 접속·Profile 생성은 app.main 의 것을 그대로 쓴다(지연 import — main 이 이 모듈을 불러 워커를 시작하므로).
"""
import time

from temporalio import activity
from temporalio.exceptions import ApplicationError

POLL_SECONDS = 2


def _m():
    from .. import main
    return main


def _profile(name: str) -> dict | None:
    m = _m()
    try:
        return m.crd.get_cluster_custom_object(m.GROUP, m.VERSION, m.P_PLURAL, name)
    except m.client.exceptions.ApiException as e:
        if e.status == 404:
            return None
        raise


def _project_of(p: dict) -> str | None:
    return ((p.get("metadata") or {}).get("labels") or {}).get(_m().PROJECT_LABEL)


@activity.defn(name="ainb.create_workspace")
def create_workspace(spec: dict) -> dict:
    """Profile 생성. spec = {name, projectId, projectName, ownerEmail, cpu, memoryGi, acceleratorCount, storageGi}.
    같은 프로젝트로 이미 만들어져 있으면(응답 유실 후 재시도) 성공으로 본다. 다른 것이 쓰는 이름이면 재시도 없이 실패."""
    m = _m()
    name = spec["name"]
    if not m._WS_NAME.match(name):
        raise ApplicationError(f"워크스페이스 이름 '{name}'이(가) 규칙(영문 소문자·숫자·하이픈 63자)에 맞지 않습니다",
                               non_retryable=True)
    cur = _profile(name)
    if cur is not None:
        if _project_of(cur) == spec["projectId"]:
            return {"namespace": name, "created": False}
        raise ApplicationError(f"'{name}' 워크스페이스가 이미 있습니다(다른 프로젝트)", non_retryable=True)
    if m._profile_exists(name):  # Profile 없이 같은 이름의 네임스페이스만 있는 경우
        raise ApplicationError(f"'{name}' 네임스페이스가 이미 있습니다", non_retryable=True)
    m.create_profile(m.CreateProfile(
        name=name, ownerEmail=spec["ownerEmail"], cpu=spec["cpu"], memoryGi=spec["memoryGi"],
        acceleratorCount=spec["acceleratorCount"], storageGi=spec["storageGi"],
        projectId=spec["projectId"], projectName=spec.get("projectName")))
    return {"namespace": name, "created": True}


@activity.defn(name="ainb.wait_ready")
def wait_ready(name: str, deadline: float) -> dict:
    """네임스페이스 Active + 자원 한도(ResourceQuota) 적용까지 대기 — deadline(epoch 초)을 넘기면 실패."""
    m = _m()
    while True:
        activity.heartbeat()
        try:
            ns = m.core.read_namespace(name)
            if (ns.status.phase or "") == "Active":
                rq = m.core.read_namespaced_resource_quota("kf-resource-quota", name)
                hard = {k: str(v) for k, v in (rq.spec.hard or {}).items()}
                return {"namespace": name, "quota": hard, "accelerator": m.ACCEL_RESOURCE}
        except m.client.exceptions.ApiException as e:
            if e.status != 404:
                raise
        if time.time() > deadline:
            raise ApplicationError(f"'{name}' 워크스페이스가 제한 시간 안에 준비되지 않았습니다", non_retryable=True)
        time.sleep(POLL_SECONDS)


@activity.defn(name="ainb.delete_workspace")
def delete_workspace(name: str, project_id: str) -> bool:
    """실패 정리 — 이 프로젝트로 만든 Profile 만 지운다(다른 것은 건드리지 않음). 지웠으면 True."""
    m = _m()
    cur = _profile(name)
    if cur is None or _project_of(cur) != project_id:
        return False
    try:
        m.crd.delete_cluster_custom_object(m.GROUP, m.VERSION, m.P_PLURAL, name)
    except m.client.exceptions.ApiException as e:
        if e.status != 404:
            raise
    return True


ALL = [create_workspace, wait_ready, delete_workspace]
