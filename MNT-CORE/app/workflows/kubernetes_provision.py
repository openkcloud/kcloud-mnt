"""서비스 클러스터 프로비저닝 워크플로 — CORE 워커가 실행한다. Magnum·K8s 작업은 PAAS 큐, 쿼터·망 확인은 IAAS 큐,
DB 기록은 CORE 큐의 작업으로 부른다.

진행 표시: 시작할 때 등록한 상세 단계 순서(plan, 공통코드 TKT_PROVISION_*_PAAS)를 앞에서부터 '진행 중 → 완료'로 기록한다.
실패하면 이번 회차가 만든(또는 생성 요청 응답이 끊겨 만들어졌을 수 있는) 클러스터를 삭제하고 사라질 때까지 기다린 뒤
티켓을 '실패'로 마감한다 — 재시도는 새 회차로 처음부터. 시간 값은 임시값(시험 후 조정).
이 파일은 Temporal 샌드박스에서 실행되므로 DB·HTTP 등 외부 모듈을 가져오지 않는다.
"""
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError

from .provision_base import END, HEARTBEAT, NO_RETRY, QUERY_RETRY, ProvisionSteps, reason

IAAS_QUEUE = "okc-iaas"   # IAAS 워커: 쿼터·노드 망 확인
PAAS_QUEUE = "okc-paas"   # PAAS 워커: Magnum·K8s 작업

# ── 시간 기준(임시값 — 시험 후 조정) ─────────────────────────────────
POLL_SECONDS = 10                         # 진행 상태 확인 간격
WATCH_MAX = timedelta(seconds=60)         # 상태 확인 작업 1회 최대 점유시간(상태가 바뀌면 바로 돌아옴)
VISIBLE_MAX = timedelta(minutes=2)        # 생성 요청 뒤 GET 이 404·400 인 동안 견디는 시간(2026-10-19 시험: 몇 초)
CREATE_MAX = timedelta(minutes=45)        # 생성 요청 ~ CREATE_COMPLETE 최대(시험: 10~13분)
SETUP_MAX = timedelta(minutes=5)          # K8s API 연결·네임스페이스·접근 권한 최대
WORKFLOW_MAX = timedelta(minutes=60)      # 워크플로 전체 최대(넘으면 실패로 기록)
QUEUE_WAIT_MAX = timedelta(minutes=2)     # PAAS·IAAS 작업이 큐에서 기다리는 최대 — 넘으면 '워커 없음'
CLEANUP_MAX = timedelta(minutes=15)       # 실패 후 클러스터 삭제 완료까지 최대(시험: 76~91초)
RUN_MAX = WORKFLOW_MAX + CLEANUP_MAX + timedelta(minutes=5)  # 실행 제한(안전장치) — 진행 + 정리 + 여유


@workflow.defn(name="KubernetesProvision")
class KubernetesProvision(ProvisionSteps):
    @workflow.run
    async def run(self, inp: dict) -> dict:
        self.inp = inp
        self.cur = -1  # 진행 중인 상세 단계 위치(plan 인덱스)
        self.plan: list[dict] = []
        self.requested = False  # 생성 요청을 보냈다 — 응답이 끊겨도 만들어졌을 수 있어 실패하면 정리한다
        self.cluster_id: str | None = None
        self.granted = False  # 접근 권한까지 등록 — 이후 실패(진행 기록 등)로 다 만든 클러스터를 지우지 않는다
        try:
            self.plan = await self._core("core.init_steps_paas", inp["ticketId"], inp["attempt"])
            result = await self._within(WORKFLOW_MAX, self._provision())
        except Exception as e:  # noqa: BLE001 — 어떤 실패든 진행 기록·티켓에 남긴다
            msg = reason(e)
            try:
                await self._fail_current(msg)
            except Exception:  # noqa: BLE001 — 단계 기록이 실패해도 정리·티켓 마감은 한다
                pass
            note, left = await self._cleanup()
            await self._core("core.finish", inp["ticketId"], "failed", left, msg + note)
            raise ApplicationError(msg + note, non_retryable=True) from e
        await self._core("core.finish", inp["ticketId"], "completed", result, None)
        return result

    async def _provision(self) -> dict:
        inp = self.inp
        # 클러스터 생성 가능 여부 — 신청·프로비저닝 뒤 바뀌었을 수 있어 실행 때 다시 본다(여기서 실패하면 만든 것 없음)
        await self._go("check_name")
        await self._paas("paas.check_name", inp["clusterName"])
        await self._go("check_quota", {"check_name": inp["clusterName"]})
        quota = await self._iaas("iaas.check_quota", inp["projectId"], inp["need"])
        await self._go("check_network", {"check_quota": quota})
        network = await self._iaas("iaas.check_network", inp["networkId"], inp["subnetId"], inp["floatingNetworkId"])
        await self._go("send_request", {"check_network": network})

        # 생성 요청(1회) — 다시 보내면 중복 생성 위험. 응답이 끊기면 정리 때 이름으로 찾아 지운다
        self.requested = True
        spec = {"name": inp["clusterName"], **{k: inp[k] for k in (
            "templateId", "masterCount", "masterFlavorId", "nodeCount", "flavorId", "networkId", "subnetId")}}
        self.cluster_id = await self._paas("paas.create_cluster", inp["projectId"], spec, retry=NO_RETRY,
                                           timeout=timedelta(seconds=90))
        await self._go("create_control_plane", {"send_request": self.cluster_id})

        # 생성 대기 — Control Plane 노드그룹 완료 → Worker(Nova Worker VM ACTIVE 수) → CREATE_COMPLETE
        masters, workers = f"{inp['masterCount']}/{inp['masterCount']}", inp["nodeCount"]
        started, until, last = workflow.now(), workflow.now() + CREATE_MAX, ""
        while True:
            left = until - workflow.now()
            if left <= timedelta(0):
                raise ApplicationError(f"{int(CREATE_MAX.total_seconds() // 60)}분 안에 클러스터 생성이 끝나지 않았습니다"
                                       f" (마지막 상태 {last})")
            s = await self._paas("paas.watch_cluster", self.cluster_id, last, min(WATCH_MAX, left).total_seconds(),
                                 POLL_SECONDS, timeout=WATCH_MAX + timedelta(seconds=30), heartbeat=HEARTBEAT)
            last = s["key"]
            if not s["status"]:  # 생성 직후 잠깐 조회되지 않는다
                if workflow.now() - started > VISIBLE_MAX:
                    raise ApplicationError("생성 요청 뒤 클러스터가 조회되지 않습니다")
                continue
            if s["status"].endswith("FAILED"):
                raise ApplicationError(f"클러스터 생성 실패({s['status']}): {s['reason'] or '사유 없음'}")
            if s["status"] == "CREATE_COMPLETE":
                break
            if s["masterReady"]:
                await self._go("create_workers", {"create_control_plane": masters})
                await self._set_values({"create_workers": f"{s['workersActive']}/{workers}"})
        await self._go("check_api", {"create_control_plane": masters, "create_workers": f"{workers}/{workers}"})
        return await self._within(SETUP_MAX, self._setup())

    async def _setup(self) -> dict:
        """K8s API 연결 → 프로젝트 네임스페이스 → 접근 권한(소유 프로젝트, 전용)."""
        inp = self.inp
        api = await self._paas("paas.check_api", self.cluster_id)
        await self._go("create_namespace", {"check_api": api})
        namespace = await self._paas("paas.create_namespace", self.cluster_id, inp["namespace"], inp["projectId"],
                                     inp["projectName"])
        await self._go("grant_access", {"create_namespace": namespace})
        await self._core("core.grant_cluster_access", inp["projectId"], self.cluster_id)
        self.granted = True
        await self._go(END, {"grant_access": inp["projectName"]})
        return {"clusterId": self.cluster_id, "clusterName": inp["clusterName"], "namespace": namespace, "apiAddress": api}

    async def _cleanup(self) -> tuple[str, dict | None]:
        """실패한 회차의 클러스터 삭제 → (실패 사유에 덧붙일 문구, 티켓 result). 정리하지 못하면 클러스터 ID 를 남긴다."""
        if not self.requested or self.granted:
            return "", ({"clusterId": self.cluster_id} if self.granted else None)
        deadline = (workflow.now() + CLEANUP_MAX).timestamp()
        try:
            deleted = await self._paas("paas.delete_cluster", self.inp["projectId"], self.inp["clusterName"],
                                       self.cluster_id, deadline, timeout=CLEANUP_MAX + timedelta(seconds=30),
                                       heartbeat=HEARTBEAT)
        except Exception as e:  # noqa: BLE001 — 정리 실패는 사유에 남기고 클러스터 ID 를 결과에 보존
            return (f" — 생성한 클러스터 정리 실패, 확인 필요(clusterId={self.cluster_id or '응답 없음'}): {reason(e)}",
                    {"clusterId": self.cluster_id, "clusterName": self.inp["clusterName"]})
        return (" — 생성한 클러스터는 삭제함" if deleted else ""), None

    # ── 작업 호출 ────────────────────────────────────────────────
    async def _paas(self, name: str, *args, retry: RetryPolicy = QUERY_RETRY, timeout: timedelta = timedelta(seconds=60),
                    heartbeat: timedelta | None = None):
        return await workflow.execute_activity(name, args=list(args), task_queue=PAAS_QUEUE, start_to_close_timeout=timeout,
                                               schedule_to_start_timeout=QUEUE_WAIT_MAX, heartbeat_timeout=heartbeat,
                                               retry_policy=retry)

    async def _iaas(self, name: str, *args):
        return await workflow.execute_activity(name, args=list(args), task_queue=IAAS_QUEUE,
                                               start_to_close_timeout=timedelta(seconds=60),
                                               schedule_to_start_timeout=QUEUE_WAIT_MAX, retry_policy=QUERY_RETRY)
