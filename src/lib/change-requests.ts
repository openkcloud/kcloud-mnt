/* 변경 요구사항 대비표 — 초기 전달본(v1.0, 2026-06-04) 대비 무엇을 왜 어떻게 바꿨는지.
 *
 * 코드 체계: CR-<영역>-<번호>
 *   OVW 개요 · OBS 옵저버빌리티 · NAV 메뉴·형상 · IAAS 클라우드 자원(IaaS) · PAAS 클라우드 자원(PaaS)
 *   MKT 서비스 마켓플레이스 · AID AI 개발환경 · IAM 운영(IAM) · INF AI 인프라 · DOC 문서·프로세스
 * 출처(SOURCES): ETRI-260615 검토 의견 44건 / MTG-260702 포털 기능 검토 회의록 v1.1 / WS-260828 2차 워크샵 / OKE-260914 오케스트로 내부 확인 / MTG-260916 4차 기관 협조 회의
 *
 * 이 파일은 /changes 페이지, 화면 안 변경 표시(ChangeMark·ChangePanel), docs/변경요구사항_대비표.md(export 스크립트)의 단일 원천이다.
 * node --strip-types 로 읽히도록 enum·데코레이터 없이 작성한다. */

export type CrStatus = "reflected" | "partial" | "pending" | "excluded" | "planned";
export type CrArea = "OVW" | "OBS" | "NAV" | "IAAS" | "PAAS" | "MKT" | "AID" | "IAM" | "INF" | "DOC";
export type SourceId = "ETRI-260615" | "MTG-260702" | "WS-260828" | "OKE-260914" | "MTG-260916" | "API-260911" | "OKE-260919";

export interface SourceDoc {
  id: SourceId;
  title: string;
  date: string;
  org: string;
  /** 회의·문서 성격 */
  kind: "검토의견" | "회의록" | "워크샵" | "내부확인" | "API 명세";
}

export const SOURCES: Record<SourceId, SourceDoc> = {
  "ETRI-260615": { id: "ETRI-260615", title: "openKcloud Portal 검토 의견 v1.0 (44건)", date: "2026-06-15", org: "ETRI", kind: "검토의견" },
  "MTG-260702": { id: "MTG-260702", title: "AI반도체 클라우드 플랫폼 포털 및 기능 개발 이슈 협조 회의록 v1.1", date: "2026-07-02", org: "ETRI·이노그리드·오케스트로", kind: "회의록" },
  "WS-260828": { id: "WS-260828", title: "2차년도 2차 워크샵 회의록·발표자료 (단양)", date: "2026-08-27~28", org: "ETRI·KETI·이노그리드·오케스트로AGI·경희대·연세대·KACI", kind: "워크샵" },
  "OKE-260914": { id: "OKE-260914", title: "오케스트로 내부 확인 (판단이 필요한 4건)", date: "2026-09-14", org: "오케스트로", kind: "내부확인" },
  "MTG-260916": { id: "MTG-260916", title: "2차년도 오케스트로 4차 기관 협조 회의", date: "2026-09-16", org: "ETRI·KETI·이노그리드·오케스트로AGI", kind: "회의록" },
  "API-260911": { id: "API-260911", title: "(AI반도체) 모니터링 API 명세서 v0.2 — KCloud Monitor API v2", date: "2026-09-11", org: "이노그리드", kind: "API 명세" },
  "OKE-260919": { id: "OKE-260919", title: "오케스트로 내부 확인 (마켓플레이스 범위·화면 문구)", date: "2026-09-19", org: "오케스트로", kind: "내부확인" },
};

export interface CrSource {
  doc: SourceId;
  /** 항목 참조 — ETRI "#17", 회의록 "§2.5 네트워크 관리", 워크샵 "이노그리드 p.22" */
  ref: string;
  /** 그 출처에서 무엇을 요구·결정했는지 한 줄 */
  said: string;
}

export interface ChangeRequest {
  id: string;
  area: CrArea;
  title: string;
  /** 변경이 반영된 화면 경로. 첫 항목이 대표 화면(비교 기준) */
  pages: string[];
  sources: CrSource[];
  /** 초기 전달본(v1.0) 상태 */
  before: string;
  /** 반영본(v2.0) 상태 */
  after: string;
  status: CrStatus;
  /** 반영 이력 — 날짜와 커밋. 결정이 바뀐 경우 단계별로 적는다 */
  history: { date: string; note: string; commit?: string }[];
  /** 포털 형상 태그가 걸린 경우 scope.ts FEATURES.id */
  feature?: string;
  /** 결정 필요 사안 번호(docs/목업_버전별_변경사항_및_결정사항.md §6) */
  decision?: number[];
}

export const AREA_LABEL: Record<CrArea, string> = {
  OVW: "개요",
  OBS: "옵저버빌리티",
  NAV: "메뉴·포털 형상",
  IAAS: "클라우드 자원 — IaaS",
  PAAS: "클라우드 자원 — PaaS",
  MKT: "서비스 마켓플레이스",
  AID: "AI 개발환경",
  IAM: "운영 — IAM·Open API",
  INF: "AI 인프라",
  DOC: "문서·프로세스",
};

export const AREA_ORDER: CrArea[] = ["OVW", "OBS", "NAV", "IAAS", "PAAS", "MKT", "AID", "IAM", "INF", "DOC"];

export const STATUS_LABEL: Record<CrStatus, string> = {
  reflected: "반영",
  partial: "부분 반영",
  pending: "대기",
  excluded: "제외",
  planned: "예정",
};

const E = (ref: string, said: string): CrSource => ({ doc: "ETRI-260615", ref, said });
const M = (ref: string, said: string): CrSource => ({ doc: "MTG-260702", ref, said });
const W = (ref: string, said: string): CrSource => ({ doc: "WS-260828", ref, said });
const O = (ref: string, said: string): CrSource => ({ doc: "OKE-260914", ref, said });
const G = (ref: string, said: string): CrSource => ({ doc: "MTG-260916", ref, said });
const A = (ref: string, said: string): CrSource => ({ doc: "API-260911", ref, said });
const K = (ref: string, said: string): CrSource => ({ doc: "OKE-260919", ref, said });

export const CHANGE_REQUESTS: ChangeRequest[] = [
  // ── OVW 개요 ────────────────────────────────────────────────
  {
    id: "CR-OVW-01", area: "OVW", title: "대시보드에 옵저버빌리티 진입점",
    pages: ["/dashboard"],
    sources: [E("#13 §3.i.1", "개요 탭을 옵저버빌리티와 연계할 것")],
    before: "KPI·전력·알람 카드만 있고 모니터링으로 가는 진입점이 없음.",
    after: "모니터링·트레이스·로그·알람 4개 바로가기 카드.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "1차 반영", commit: "47139b3" }],
  },
  {
    id: "CR-OVW-02", area: "OVW", title: "AI반도체 관리 빠른 이동 제거",
    pages: ["/dashboard"],
    sources: [E("#23", "AI 반도체 관리 화면은 기능 명세에 없음")],
    before: "빠른 이동에 AI반도체 관리 링크 포함.",
    after: "링크 제거. 가속기 정보 표시는 유지.",
    status: "reflected",
    history: [{ date: "2026-07-23", note: "스코프 정리(트랙 D)", commit: "dc05fee" }],
  },
  {
    id: "CR-OVW-03", area: "OVW", title: "자원 종합 기준을 단일 클러스터로",
    pages: ["/dashboard"],
    sources: [M("§2.5 공급자 관리", "단일 클러스터 구성이라 센터 추가·자원풀 등록 불필요")],
    before: "\"전체 풀(센터·존·자원풀) 기준\" 표기.",
    after: "\"단일 클러스터 전체 기준\". 헤더에 목업 버전·포털 형상 배지.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "260702 회의 반영" }],
  },

  // ── OBS 옵저버빌리티 ─────────────────────────────────────────
  {
    id: "CR-OBS-01", area: "OBS", title: "Avg P99 지연·에러율·추론 RPS 지표",
    pages: ["/monitoring"],
    sources: [
      E("#3", "이노그리드 미수집 지표. 설치 후 집계 가능 시 추가"),
      M("§2.1 인프라 모니터링", "이노그리드가 지원하기 어려워 대체 지표를 검토"),
      W("회의록 3.1 · 이노그리드", "수집 불가 지표에 대한 대체 지표 검토, UI 제안 고민"),
      G("AI 노트북·옵저버빌리티 검토", "대체 지표 확정 — Avg P99 지연→전력 효율(%/W), 에러율→저장소 사용률(%, API에 총용량·사용용량 GB 포함), 추론 RPS→쓰로틀링 횟수(counter)"),
    ],
    before: "Avg P99 지연·에러율·추론 RPS 3개 카드가 실측처럼 표시(이후 '대체 지표 검토' 상태 표기).",
    after: "확정된 대체 지표 3종으로 교체 — 전력 효율(%/W, 사용률÷전력) · 저장소 사용률(%, API 응답에 총용량·사용용량 GB 포함) · 쓰로틀링 횟수(24h 누적 counter). 안내 배너도 교체 내용으로 갱신.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "회의 결과 표기" }, { date: "2026-09-18", note: "대체 지표 3종으로 카드 교체" }],
    feature: "monitoring.golden-signals", decision: [2],
  },
  {
    id: "CR-OBS-02", area: "OBS", title: "활용률 히트맵 응답 스키마",
    pages: ["/monitoring"],
    sources: [E("#4", "히트맵 전용 응답 추가 예정, UI 고정"), M("§2.1 인프라 모니터링", "정보 제공은 가능, 히트맵 표현용 모니터링 API 수정 검토"),
      A("§9.7 메트릭 시계열", "GET /monitoring/metrics/timeseries — metric·period·step·aggregation으로 라벨별 (시각,값) 시계열 반환")],
    before: "24h × 호스트 히트맵 UI. 전용 응답 스키마 검토 중이라는 안내 표기.",
    after: "히트맵 전용 응답은 없지만 메트릭 시계열 조회(metric=gpu_utilization·period=24h·step=1h)를 호스트×시간으로 펴서 그대로 그릴 수 있다. 안내를 조회 경로 표기로 교체하고 대기 해소.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "회의 결과 표기" }, { date: "2026-09-18", note: "API v0.2 확인 — 시계열 조회로 구성, 대기 해소" }],
  },
  {
    id: "CR-OBS-03", area: "OBS", title: "응답시간 분포",
    pages: ["/monitoring"],
    sources: [E("#5", "이노그리드 vLLM 테스트 후 결정"),
      A("§9 Monitoring · §5 Accelerators", "제공 지표는 전력·사용률·온도·메모리·health와 노드 CPU/메모리/디스크/네트워크. 서비스 응답시간 지표 없음")],
    before: "P50/P95/P99 분포 차트와 마커.",
    after: "모니터링 API v2에 서비스 응답시간 지표가 없어 화면에서 제거하고, 같은 자리를 전력 시계열(server·cpu·accelerator 계층)로 교체했다.",
    status: "excluded",
    history: [{ date: "2026-09-18", note: "API 미제공 확인 — 제거, 전력 시계열로 교체" }],
  },
  {
    id: "CR-OBS-04", area: "OBS", title: "가속기 3종 공통 지표 6종 카드",
    pages: ["/monitoring"],
    sources: [
      W("이노그리드 p.22~23", "GPU·NPU 공통 지표 6종(온도·전력·사용률·메모리 사용량·메모리 총량·health) + 파생 2종(전력효율·TDP 대비). Rebellions 온도·전력 ×1000 보정"),
      W("이노그리드 p.31 시연 1", "가속기가 3종이어도 운영자가 보는 화면과 지표 이름은 하나다"),
    ],
    before: "GPU 사용률·전력 등 단일 KPI. 가속기별 지표 이름이 제각각.",
    after: "인프라 모니터링에 '가속기 공통 지표' 표(RNGD·ATOM·L40S × 6종 + 파생 2종)를 추가. 지표 이름·단위를 3종 공통으로 통일하고 표에는 운영 화면에 필요한 값·기준만 남겼다.",
    status: "reflected",
    history: [{ date: "2026-09-15", note: "2차 워크샵 반영" }, { date: "2026-09-18", note: "수집기 내부 명칭·보정 주석 등 비운영 문구 정리" }],
  },
  {
    id: "CR-OBS-05", area: "OBS", title: "권장조치 자동 적용 → 정보 제공까지",
    pages: ["/monitoring/insights"],
    sources: [E("#6 §2.B.i", "권장조치 자동 적용 범위 질의"), M("§2.1 AI모델 분석", "이노그리드는 정보 제공까지. 자동 적용은 과업 범위 외")],
    before: "권장 조치 카드에 '자동 적용' 버튼.",
    after: "자동 적용 버튼 제거, 확인·수동 적용 수준. 자동 적용은 차차년도 명시.",
    status: "reflected",
    history: [{ date: "2026-07-27", note: "정보 제공으로 하향", commit: "91cf747" }],
  },
  {
    id: "CR-OBS-06", area: "OBS", title: "AI 모델 분석 범위 — AIOps는 최종 형상",
    pages: ["/monitoring/insights", "/ai-development/model-insights"],
    sources: [
      M("§2.1 AI모델 분석", "단순 모니터링보다 AIOps 관점. 오케스트로 과업, 하반기까지 구체화. 2차년도 외는 최종 형상 설계안에만"),
      W("이노그리드 p.24", "2차년도 옵저버빌리티 2종 = Loki 로그 + 규칙 기반 이상감지, 원인 후보 제시는 3차년도"),
    ],
    before: "Davis 스타일 자동 진단·권장 조치·핫스팟이 항상 표시.",
    after: "1차로 자동 진단·권장 조치·핫스팟을 최종 형상 태그로 분리(2026-09-15). 2026-09-16 회의에서 AIOps 자체가 2차년도 과업 밖으로 정리되어 **메뉴 전체를 최종 형상**으로 옮겼다(CR-OBS-12).",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "260702 회의 반영" }, { date: "2026-09-18", note: "메뉴 전체 최종 형상으로 확대" }],
    feature: "monitoring.insights.aiops", decision: [7],
  },
  {
    id: "CR-OBS-07", area: "OBS", title: "분산 트레이스 — 공통 서비스 트레이스 기본 정보만",
    pages: ["/monitoring/traces", "/monitoring/insights"],
    sources: [
      E("#7 #8 #9", "서비스 플로우·분산 트레이스의 vLLM 내부 추적, 기본 정보 범위"),
      M("§2.1 분산 트레이스", "서비스 흐름 모니터링과 통합해 공통 트레이스 정의. vLLM 내부 추적 미지원. 기본 정보 우선"),
      W("이노그리드 p.24~25", "Tempo 트레이스 연계·원인 후보는 3차년도. 트레이스 식별자 미구축"),
    ],
    before: "vLLM 내부 span까지 그리는 PurePath 호출 트리.",
    after: "1차로 기본 정보만 2차년도 형상, 내부 span은 최종 형상 태그(2026-09-15). 2026-09-16 회의에서 트레이스 식별자 미구축·Tempo 연계 3차년도를 확인해 **메뉴 전체를 최종 형상**으로 옮겼다(CR-OBS-12). 대기 상태 해소.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "태그·배너 반영" }, { date: "2026-09-18", note: "메뉴 전체 최종 형상 — 대기 해소" }],
    feature: "monitoring.traces.internal", decision: [3],
  },
  {
    id: "CR-OBS-08", area: "OBS", title: "로그 이벤트 — 이노그리드 UI 제안 대기",
    pages: ["/monitoring/logs"],
    sources: [E("#10", "이슈 없음"), M("§2.1 로그 이벤트", "이노그리드가 UI 기능 정의·목업 제안"), W("이노그리드 p.25", "Loki 조회 API 구현 중, 지표 이상 시각으로 범위를 좁혀 조회")],
    before: "Loki LogQL 콘솔.",
    after: "자리표시자 안내. Loki 실시간 로그 API(2차년도 옵저버빌리티 2종) 연결 예정 표기.",
    status: "pending",
    history: [{ date: "2026-09-14", note: "안내 반영" }],
    decision: [14],
  },
  {
    id: "CR-OBS-09", area: "OBS", title: "SLO 제외",
    pages: ["/monitoring/alerts", "/monitoring/insights", "/ai-development/model-insights"],
    sources: [E("#11", "SLO 정의 필요 여부"), M("§2.1 알람 및 SLO", "SLO 포함 여부는 오케스트로가 정리(삭제 또는 유지)")],
    before: "'알람·SLO' 메뉴, SLO 카드 4종, 'SLO 18% 초과' 문구.",
    after: "SLO 제외 결정. 메뉴 '알람', SLO 카드 제거, 잔여 문구는 '목표 지연 1초'로 정리.",
    status: "excluded",
    history: [{ date: "2026-07-27", note: "제외 결정(트랙 B)", commit: "248cd51" }, { date: "2026-09-14", note: "잔여 문구·탭 라벨 정리" }],
  },
  {
    id: "CR-OBS-10", area: "OBS", title: "알람 정책·채널 CRUD와 임계치",
    pages: ["/monitoring/alerts"],
    sources: [E("#12", "알람 설정·관리 기능 부재"), M("§2.1 알람 및 SLO · 3.2", "알람 설정 및 임계치 기능 필요")],
    before: "활성 알람 목록만 표시.",
    after: "활성 알람 / 알람 정책 / 채널 3탭. 정책 생성·편집·복제·활성 토글(메트릭·조건·임계값·지속시간), 채널 관리, 테스트 발송.",
    status: "reflected",
    history: [{ date: "2026-07-27", note: "알람 CRUD", commit: "248cd51" }, { date: "2026-09-14", note: "임계치 반영 완료 표기" }],
  },
  {
    id: "CR-OBS-11", area: "OBS", title: "이상감지 시나리오 6종을 알람 정책 예시로",
    pages: ["/monitoring/alerts"],
    sources: [W("이노그리드 p.26~27, 30", "알림 묶기·상대 비교·알람 억제·시간대 baseline·spike 무시·NPU 신규 지표. 1단계는 규칙 기반, 기록→이벤트→알림 승격")],
    before: "임계값 단순 초과 정책 5종.",
    after: "이노그리드 감지 시나리오 6종을 정책 예시로 추가(억제·묶기·상대 비교·baseline·지속시간·NPU 규칙). 하반기 Alertmanager 연동 대상.",
    status: "reflected",
    history: [{ date: "2026-09-15", note: "2차 워크샵 반영" }],
  },
  {
    id: "CR-OBS-12", area: "OBS", title: "AI 모델 분석·분산 트레이스 메뉴 2차년도 제외",
    pages: ["/monitoring/insights", "/monitoring/traces"],
    sources: [
      G("옵저버빌리티 범위 정리", "AI 모델 분석(AIOps)과 분산 트레이스는 2차년도 시범서비스에서 제외하고 최종 형상 설계안으로만 둔다"),
      W("이노그리드 p.24~25", "2차년도 옵저버빌리티 2종은 Loki 로그 + 규칙 기반 이상감지. Tempo 트레이스 연계·원인 후보는 3차년도, 트레이스 식별자 미구축"),
    ],
    before: "두 메뉴가 2차년도 사이드바에 항상 노출(메뉴 안 일부 기능만 최종 형상 태그).",
    after: "포털 형상을 메뉴 단위로 올려 2차년도 시범서비스 프리셋에서 두 메뉴를 사이드바와 옵저버빌리티 탭바 양쪽에서 숨긴다. 최종 형상 프리셋에서는 그대로 보이며 화면·데이터는 설계안으로 유지. 각 화면 상단 배너에 제외 사유를 표기.",
    status: "reflected",
    history: [{ date: "2026-09-18", note: "메뉴 단위 형상 전환 + 배너" }],
    feature: "monitoring.insights.aiops",
  },
  {
    id: "CR-OBS-13", area: "OBS", title: "옵저버빌리티 3개 화면을 모니터링 API v2 제공 범위로 재구성",
    pages: ["/monitoring", "/monitoring/logs", "/monitoring/alerts"],
    sources: [
      A("전체 13개 도메인", "Clusters·Nodes·Accelerators·Workloads·OpenStack·Monitoring·Logs·Export는 동작, Storage(Ceph)·Resource Map은 진행중, 알람 API는 없음"),
      A("§9 Monitoring", "overview(클러스터·노드·가속기 수·정상 수·평균 온도) · power summary/breakdown/timeseries/efficiency · metrics query/timeseries · temperature timeseries · SSE 2종"),
      A("§10 Logs", "LogQL 검색 · SSE 스트리밍 · CSV/JSON 내보내기 · 라벨 키·값 · 볼륨 통계 · 클러스터·노드·Pod·드라이버 범위 검색. detected_fields(XID·OOM), trace_id는 미계측"),
    ],
    before: "인프라 모니터링에 추론 RPS·응답시간 분포·활성 문제 카드, 로그 화면은 자리표시자, 알람은 정책·채널만 있고 평가 주체가 불명확.",
    after: "세 화면을 API 제공 범위로 다시 맞췄다. ① 인프라 모니터링 — 카드·표마다 조회 경로를 표기하고, 상위 추론 서비스·응답시간 분포·활성 문제를 빼고 전력 분해(dimension 4종)·전력 시계열(계층 3종)·클러스터 자원 현황·최근 오류 로그를 넣었다. ② 로그 — LogQL 검색, 범위 5종, 라벨 키·값 필터, 실시간 스트리밍, CSV/JSON 내보내기, 볼륨 통계, 구조화 필드(XID·OOM) 배지로 재구성. ③ 알람 — API에 알람이 없어 포털이 지표·로그 조회로 임계 규칙을 평가하는 구조임을 명시하고, 정책 조건을 API 제공 필드로만 다시 썼다(평가 경로 열 추가).",
    status: "reflected",
    history: [{ date: "2026-09-18", note: "API v0.2 대조 후 3개 화면 재구성" }],
  },

  // ── NAV 메뉴·포털 형상 ──────────────────────────────────────
  {
    id: "CR-NAV-01", area: "NAV", title: "관리자/사용자 메뉴 차별화",
    pages: ["/dashboard"],
    sources: [E("#13", "관리자/사용자 메뉴 차별화"), M("§2.2", "이용 목적이 다르므로 메뉴 구성 차별화 수용")],
    before: "두 역할의 사이드바 순서가 같음.",
    after: "역할별 섹션 순서·구성 분기(getNavByRole).",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "역할 분기", commit: "47139b3" }],
  },
  {
    id: "CR-NAV-02", area: "NAV", title: "사용자 메뉴 순서",
    pages: ["/dashboard"],
    sources: [E("#14", "사용자 메뉴 순서(안)"), M("§2.2", "개요 → 클라우드 자원 → 서비스 마켓플레이스 → AI 개발환경 → 옵저버빌리티 → AI 인프라")],
    before: "개요→옵저버→클라우드→AI인프라→AI개발→마켓→운영.",
    after: "개요→클라우드 자원→마켓→AI 개발환경→옵저버빌리티→AI 인프라. 회의록 순서와 동일.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "반영", commit: "47139b3" }],
  },
  {
    id: "CR-NAV-03", area: "NAV", title: "관리자 메뉴 순서와 '네트워크·볼륨·서비스 구성' 섹션",
    pages: ["/dashboard", "/iaas/networks"],
    sources: [
      E("#15", "관리자 메뉴 순서(안)"),
      M("§2.2", "개요 → 옵저버빌리티 → 클라우드 자원 → 서비스 마켓플레이스 → 네트워크·볼륨·서비스 구성 → AI 인프라"),
      O("확인 1", "회의록 6개 대분류에 없는 AI 개발환경·운영(IAM)은 유지"),
    ],
    before: "관리자도 사용자와 같은 순서.",
    after: "개요→옵저버→클라우드 자원→마켓→네트워크·볼륨·서비스 구성→AI 개발환경→AI 인프라→운영. 구성 섹션에 네트워크·라우터·보안 그룹·키페어·볼륨·서비스/인그레스·K8s 스토리지.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "순서 분기", commit: "47139b3" }, { date: "2026-09-14", note: "구성 섹션 신설" }],
    decision: [9],
  },
  {
    id: "CR-NAV-04", area: "NAV", title: "포털 형상 — 2차년도 시범서비스 / 최종 형상 전환",
    pages: ["/settings"],
    sources: [
      M("§2.1 AI모델 분석 · §2.4 AI노트북", "2차년도 과업 범위가 아닌 것은 최종 형상 설계안으로 유지하고 시범서비스 포털에는 삭제"),
      W("회의록 3.2", "8월 워크샵에서 1단계 개발형상·2차년도 개발 형상 제시"),
      O("확인 4", "회의록에서 논의된 기능 외는 최종 형상으로 분류"),
    ],
    before: "형상 구분 없음.",
    after: "환경설정 › 포털 형상: 프리셋(2차년도/최종) + 기능 12개 표시 토글. 사이드바·탭·화면 안 기능에 즉시 반영, 브라우저 저장.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "신설" }],
    decision: [8],
  },

  // ── IAAS ─────────────────────────────────────────────────────
  {
    id: "CR-IAAS-01", area: "IAAS", title: "자원 신청 워크플로우 — 프로젝트(쿼터) → 네트워크 선택 → Flavor → 가속기",
    pages: ["/iaas/instances", "/iaas/projects"],
    sources: [E("#16", "자원 신청 워크플로우 명확화"), M("§2.5 자원 신청", "CPU·메모리·가속기 개수 설정 후 프로젝트 생성, 네트워크망 선택으로 자원 신청 연결")],
    before: "5단계 위저드. 네트워크 임의 선택, 볼륨 개념 없음, 쿼터 사용량 미표시.",
    after: "프로젝트 단계에 쿼터·사용량·선행 생성 안내, 네트워크는 관리자 생성 망 중 선택, Flavor 단계에 루트 볼륨 자동 생성 안내, 확인 단계에 볼륨 행.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "위저드 재정비" }],
  },
  {
    id: "CR-IAAS-02", area: "IAAS", title: "네트워크 생성 주체 — 관리자 전용",
    pages: ["/iaas/networks"],
    sources: [
      E("#17 #18", "네트워크 생성 주체 정의, 명세 없는 네트워크 생성(C)"),
      M("§2.5 네트워크 관리", "네트워크 생성은 관리자 기능. 관리자 생성 네트워크를 사용자가 선택"),
    ],
    before: "명세 없는 '네트워크 생성' 버튼 하나.",
    after: "관리자만 생성. 사용자는 목록·선택. 정책 배너. (1차 반영 때 사용자용·관리자용 이중 버튼이었으나 회의록으로 관리자 전용으로 변경)",
    status: "reflected",
    history: [
      { date: "2026-07-23", note: "명세 없는 버튼 제거", commit: "dc05fee" },
      { date: "2026-07-27", note: "이중 시나리오(사용자용+관리자용)", commit: "248cd51" },
      { date: "2026-09-14", note: "관리자 전용으로 변경" },
    ],
  },
  {
    id: "CR-IAAS-03", area: "IAAS", title: "볼륨 — Flavor 선택 시 자동 생성, 재사용은 최종 형상",
    pages: ["/iaas/volumes", "/iaas/instances"],
    sources: [E("#19", "볼륨 사용자 직접 생성 여부"), M("§2.5 스토리지 관리", "flavor 선택 시 볼륨 자동 생성. 기존 스토리지 재사용은 고도화")],
    before: "볼륨 생성 다이얼로그, 생성 주체 미정의.",
    after: "볼륨 생성·삭제·분리는 관리자. 사용자는 조회. 배너를 자동 생성으로 교체. 'VM 연결(재사용)'은 최종 형상 태그. (1차 반영의 '사용자 자율 CRUD'를 회의록으로 변경)",
    status: "reflected",
    history: [{ date: "2026-07-27", note: "사용자 자율 배너", commit: "248cd51" }, { date: "2026-09-14", note: "자동 생성으로 변경" }],
    feature: "iaas.volumes.reuse",
  },
  {
    id: "CR-IAAS-04", area: "IAAS", title: "키페어·라우터 관리 신설, 생성은 관리자 권한",
    pages: ["/iaas/keypairs", "/iaas/routers"],
    sources: [E("#20", "키페어·라우터 명세 없음"), M("§2.5 키페어 등", "키페어, 라우터, Floating IP, 보안그룹 생성 기능은 관리자 권한"), O("확인 2", "키페어도 회의록대로 관리자 전용")],
    before: "키페어·라우터 화면 없음.",
    after: "두 페이지 신설. 생성·삭제·편집은 관리자만, 사용자는 조회하고 VM 신청 시 선택. 라우터는 사용자 메뉴에서 제외.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "페이지 신설", commit: "1bede22" }, { date: "2026-09-14", note: "관리자 권한 제한" }],
    decision: [10],
  },
  {
    id: "CR-IAAS-05", area: "IAAS", title: "Floating IP 해제·회수·재할당 (관리자)",
    pages: ["/iaas/networks"],
    sources: [E("#21", "Floating IP 관리 기능 부재"), M("§2.5 키페어 등", "Floating IP 생성 기능은 관리자 권한")],
    before: "FIP 할당만 가능.",
    after: "네트워크 상세 FIP 탭에 해제·회수·재할당. 관리자에게만 표시.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "액션 추가", commit: "1bede22" }, { date: "2026-09-14", note: "관리자 한정" }],
  },
  {
    id: "CR-IAAS-06", area: "IAAS", title: "보안 그룹 CRUD 신설, 관리자 권한",
    pages: ["/iaas/security-groups"],
    sources: [E("#22", "보안 그룹 관리 부재"), M("§2.5 키페어 등", "보안그룹 생성은 관리자 권한")],
    before: "네트워크 상세에서 규칙만 편집.",
    after: "보안 그룹 페이지 신설(생성·수정·복제·삭제, 인바운드/아웃바운드 규칙). 생성·수정은 관리자, 사용자는 조회·선택.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "페이지 신설", commit: "1bede22" }, { date: "2026-09-14", note: "관리자 한정" }],
  },
  {
    id: "CR-IAAS-07", area: "IAAS", title: "AI반도체 관리 페이지 제거",
    pages: ["/infrastructure/servers"],
    sources: [E("#23", "AI 반도체 관리 명세 없음")],
    before: "디바이스·할당·파티션·토폴로지 4탭 페이지(/ai-accelerators).",
    after: "페이지·사이드바·링크 제거. fixture와 VM·워크로드·마켓의 가속기 표시는 유지.",
    status: "excluded",
    history: [{ date: "2026-07-23", note: "스코프 정리(트랙 D)", commit: "dc05fee" }],
  },
  {
    id: "CR-IAAS-08", area: "IAAS", title: "OpenShift 제외 → 공급자 관리 메뉴 삭제",
    pages: ["/infrastructure/servers"],
    sources: [E("#24", "OpenShift 지원 범위"), M("§2.5 공급자 관리", "메뉴 전체 삭제 — 단일 클러스터라 센터 추가·자원풀 등록 불필요")],
    before: "센터·존·자원풀 카드, OpenStack/OpenShift 자원풀 등록.",
    after: "OpenShift 옵션 제거(1차) → 공급자 관리 페이지·메뉴·탭 삭제(회의록). fixture 유지.",
    status: "reflected",
    history: [{ date: "2026-07-27", note: "OpenShift 옵션 제거", commit: "248cd51" }, { date: "2026-09-14", note: "페이지 삭제" }],
    decision: [11],
  },
  {
    id: "CR-IAAS-09", area: "IAAS", title: "이미지 패키징 — ETRI 연동 자리(최종 형상)",
    pages: ["/iaas/images"],
    sources: [E("#44", "이미지 패키징 기술(Glance 업로드만 존재)"), M("§2.8 이미지 패키징", "오케스트로 미고려. ETRI 기능 개발 시 이미지 메뉴에 연동")],
    before: "이미지·Flavor 2탭, Glance 업로드.",
    after: "최종 형상에서만 '패키징 (ETRI 연동)' 탭 표시(소스→베이스 이미지→빌드→등록 4단계 자리). 오케스트로 범위 아님으로 종결.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "탭 자리 추가" }],
    feature: "iaas.images.packaging", decision: [13],
  },

  // ── PAAS ─────────────────────────────────────────────────────
  {
    id: "CR-PAAS-01", area: "PAAS", title: "K8s 프로비저닝 5단계 흐름 (Portal → Magnum → Nova → Neutron → Cluster)",
    pages: ["/paas/clusters"],
    sources: [E("#25 §4.B", "Kubernetes 프로비저닝 연동 방안·기본 흐름"), M("§2.6", "검토 의견과 같이 openKcloud 생성 흐름 반영")],
    before: "관리/서비스 클러스터 카드, 생성 위저드 자리만.",
    after: "관리자가 신청을 승인하면 5단계 진행 화면(Portal → Magnum → Nova VM → Neutron → Cluster)이 자동 진행되고 kubeconfig 발급.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "진행 화면 신설" }],
  },
  {
    id: "CR-PAAS-02", area: "PAAS", title: "Service ↔ Ingress 관계 표시 (URL·Host·Path)",
    pages: ["/paas/services"],
    sources: [E("#26", "Ingress·Storage 생성·연동"), M("§2.6", "특정 Service에 연결된 Ingress, 접근 URL·Host·Path를 직관적으로 확인")],
    before: "Service 목록·상세만.",
    after: "서비스 상세에 연결 Ingress·접근 URL·Host·Path 관계 다이어그램, Ingress 규칙 관리. 관리자 사이드바에서는 구성 섹션.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "관계 뷰", commit: "5436795" }],
  },
  {
    id: "CR-PAAS-03", area: "PAAS", title: "VM 개수·가속기 종류·개수 선정",
    pages: ["/paas/clusters", "/paas/workloads"],
    sources: [E("#27", "VM 개수·가속기 종류·개수 선정 방안"), M("§2.6 서비스 클러스터 신청", "사용자는 VM 개수와 Flavor 등을 선택, VM 생성 수준까지 사용자 입력")],
    before: "선정 단계 없음.",
    after: "서비스 클러스터 신청 위저드 '노드·가속기' 단계(Control Plane·Worker 수, Flavor, 가속기 종류·Worker당 개수, 합계). 워크로드 생성에도 가속기 수·종류.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "워크로드 위저드", commit: "5436795" }, { date: "2026-09-14", note: "클러스터 신청 위저드" }],
  },
  {
    id: "CR-PAAS-04", area: "PAAS", title: "StorageClass·PV 관리자 생성 UI",
    pages: ["/paas/storage"],
    sources: [E("#28", "StorageClass·PV 관리자 UI"), M("§2.6", "StorageClass, PV 생성 기능 반영")],
    before: "PVC 위주, PV·SC 생성 UI 없음.",
    after: "관리자용 PV·StorageClass 생성 다이얼로그. 관리자 사이드바 'K8s 스토리지 (SC·PV)'.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "관리자 UI", commit: "5436795" }],
  },
  {
    id: "CR-PAAS-05", area: "PAAS", title: "워크로드 생성 화면",
    pages: ["/paas/workloads"],
    sources: [E("#42 §8.i", "워크로드 생성 화면 부재")],
    before: "서비스 생성 버튼만.",
    after: "Deployment·StatefulSet·DaemonSet·Job·CronJob 유형 선택 → 스펙 2단계 위저드.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "위저드", commit: "5436795" }],
  },
  {
    id: "CR-PAAS-06", area: "PAAS", title: "클러스터 — 사용자는 신청, 관리자가 승인·생성",
    pages: ["/paas/clusters"],
    sources: [M("§2.6 클러스터 생성", "사용자는 로그인 시 사용 가능한 클러스터만, 직접 생성 불가, 관리자에게 요청")],
    before: "생성 주체 미정.",
    after: "사용자: 신청 4단계 위저드 + 내 신청 목록, 소속 클러스터만 표시. 관리자: 신청 관리(승인·반려), 관리 클러스터 표시.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "신설" }],
  },
  {
    id: "CR-PAAS-07", area: "PAAS", title: "워크로드 스케줄링 힌트(sched.ai / profile.ai) 입력",
    pages: ["/paas/workloads"],
    sources: [W("KETI p.13~15, 25, 28①", "작업 정의서 annotation: sched.ai/intent·preference·gpu-profile·rescheduling, profile.ai/model·precision·batch·context·slo-p99-ms. 이노그리드가 kube_pod_labels·annotations 수집")],
    before: "워크로드 생성에 자원 요청과 가속기만.",
    after: "생성 위저드 2단계에 '스케줄링 힌트(선택)' — 작업 의도·선호·가속기 프로파일·재배치 제약과 모델·정밀도·배치·문맥·SLO p99. KETI 비용 최적 스케줄러와 이노그리드 수집 항목의 입력.",
    status: "reflected",
    history: [{ date: "2026-09-15", note: "2차 워크샵 반영" }],
  },
  {
    id: "CR-PAAS-08", area: "PAAS", title: "설정 관리(ConfigMap·Secret) 최종 형상",
    pages: ["/paas/config"],
    sources: [M("§2.4", "2차년도 과업 외는 최종 형상"), O("확인 4", "회의록 미논의 기능은 최종 형상")],
    before: "항상 표시.",
    after: "시범서비스 형상에서는 사이드바·탭에서 숨김(SFR.MNT.028은 '27).",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "태그" }],
    feature: "paas.config",
  },

  // ── MKT ──────────────────────────────────────────────────────
  {
    id: "CR-MKT-01", area: "MKT", title: "실행 대상·방식 구체화 — 시그니처 시나리오",
    pages: ["/catalog"],
    sources: [E("#29", "카드 선택 후 실행 대상·방식이 구체적이지 않음"), M("§2.3", "실행 대상·방식 구체화 필요"),
      K("마켓플레이스 범위", "시그니처 시나리오는 2차년도 시범서비스 범위에서 제외")],
    before: "모델 카드 33종 목록만.",
    after: "원클릭 챗봇·이미지 생성·음성 STT/TTS 대표 시나리오 카드.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "시그니처", commit: "99e9cfa" }],
  },
  {
    id: "CR-MKT-02", area: "MKT", title: "조합형 실행 흐름 — 카드 → 모델 → 가속기 → 인프라 → 실행",
    pages: ["/catalog"],
    sources: [E("#30", "조합형 실행 플로우"), M("§2.3", "서비스 카드 선택 → 모델 → 가속기 → 인프라 유형 → 실행")],
    before: "실행 흐름 없음.",
    after: "4단계 배포 위저드(모델→가속기→인프라→확인·실행). 흐름 문구를 회의록과 통일.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "위저드", commit: "99e9cfa" }, { date: "2026-09-14", note: "문구 통일" }],
  },
  {
    id: "CR-MKT-03", area: "MKT", title: "원클릭 LLM 챗봇 — 통합 시연, ETRI Chatbot 서비스 연계",
    pages: ["/catalog"],
    sources: [E("#31", "원클릭 LLM 응용(챗봇) 통합 시연"), M("§2.3", "통합 시연 공간으로 활용"), W("ETRI p.7~8, 13", "Chatbot 기반 cloud service, DevDay 'Chatbot + 자원할당' 세션")],
    before: "챗봇 시나리오 없음.",
    after: "대표 카드 '원클릭 챗봇 배포' + 자동 배포 흐름. ETRI Chatbot 서비스 연계를 카드에 표기.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "대표 카드", commit: "99e9cfa" }, { date: "2026-09-15", note: "ETRI Chatbot 연계 표기" }],
  },
  {
    id: "CR-MKT-04", area: "MKT", title: "애플리케이션 레벨 실행(최종 형상)",
    pages: ["/catalog"],
    sources: [M("§2.3", "LLM 모델 구동만이 아니라 모델 위 애플리케이션 레벨까지 실행 고려. 7/15 클라우드 분과 워크샵에서 구체화")],
    before: "모델 레벨만.",
    after: "앱 카드 3종(챗봇 웹 앱·문서 QA RAG·코드 어시스턴트) + 앱 선택 단계(5단계). 최종 형상 태그. 7/15 결과 미반영.",
    status: "partial",
    history: [{ date: "2026-09-14", note: "앱 카드 추가" }],
    feature: "catalog.apps", decision: [6],
  },
  {
    id: "CR-MKT-05", area: "MKT", title: "마켓플레이스 화면 문구에서 외부 모델 저장소 홍보 문구 제거",
    pages: ["/catalog"],
    sources: [K("화면 문구", "머리말의 벤더 모델 저장소 연동 문구·배지·외부 링크 버튼 제거")],
    before: "머리말 '○○ ModelZoo 연동 — 33개 모델 즉시 배포' + 'powered by ○○' 배지 + 외부 저장소·공식 페이지 버튼.",
    after: "머리말을 '33개 모델 · 가속기를 골라 바로 배포'로 바꾸고 홍보 배지와 외부 링크 버튼을 제거. 모델별 원본 링크는 카드 안에 유지.",
    status: "reflected",
    history: [{ date: "2026-09-19", note: "머리말·배지·링크 정리" }],
  },


  // ── AID ──────────────────────────────────────────────────────
  {
    id: "CR-AID-01", area: "AID", title: "Kubeflow 사용 순서 가이드",
    pages: ["/ai-development"],
    sources: [E("#32 §6.A", "Kubeflow 사용 순서 가이드")],
    before: "메뉴 설명 카드만.",
    after: "자원 신청 → Profile → 모델 → 노트북 → 파이프라인 → HPO → 서빙 → API 8단계 가이드, 단계별 링크.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "가이드", commit: "755af71" }],
  },
  {
    id: "CR-AID-02", area: "AID", title: "Pipeline YAML 업로드",
    pages: ["/ai-development/pipelines"],
    sources: [E("#33", "Pipeline YAML 업로드 수단")],
    before: "KFP DSL 제출만.",
    after: "YAML 파일 업로드·붙여넣기 2모드.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }],
  },
  {
    id: "CR-AID-03", area: "AID", title: "Experiments 정의 수단",
    pages: ["/ai-development/experiments"],
    sources: [E("#34", "Experiments 정의 수단 부재")],
    before: "더미 trial 결과만.",
    after: "Katib 알고리즘 선택 실험 정의 다이얼로그.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }],
    feature: "ai.experiments",
  },
  {
    id: "CR-AID-04", area: "AID", title: "HPO 명칭 통일",
    pages: ["/ai-development/experiments"],
    sources: [E("#35", "HPO 명칭 변경")],
    before: "'Experiments' 단독 표기.",
    after: "페이지·메뉴 'Experiments (HPO)'.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }],
    feature: "ai.experiments",
  },
  {
    id: "CR-AID-05", area: "AID", title: "MLPerf 벤치마크 콘텐츠",
    pages: ["/ai-development/experiments"],
    sources: [E("#36", "MLPerf 벤치마크 콘텐츠")],
    before: "없음.",
    after: "하드웨어·모델 벤치마크 2탭. 최종 형상 태그(2차년도 SFR에 없음).",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }, { date: "2026-09-14", note: "최종 형상 태그" }],
    feature: "ai.experiments",
  },
  {
    id: "CR-AID-06", area: "AID", title: "Attention Layer 프로파일링 수집 주기",
    pages: ["/ai-development/model-insights"],
    sources: [E("#37", "프로파일링 방식")],
    before: "수집 방식 미명시.",
    after: "1분 주기 샘플링으로 명시.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }],
  },
  {
    id: "CR-AID-07", area: "AID", title: "KV Cache 미스율 산출 방식",
    pages: ["/ai-development/model-insights"],
    sources: [E("#38", "KV Cache 미스율 산출 근거")],
    before: "산출 근거 없음.",
    after: "vLLM 표준 메트릭(gpu_cache_usage_perc + num_preemptions_total) 조합으로 명시. 자동 진단 카드와 함께 최종 형상 태그.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }, { date: "2026-09-14", note: "최종 형상 태그" }],
    feature: "ai.model-insights.aiops",
  },
  {
    id: "CR-AID-08", area: "AID", title: "응답 지연 TTFT / TPOT / E2E 분리",
    pages: ["/ai-development/model-insights"],
    sources: [E("#39", "응답 지연 정의")],
    before: "'응답 지연' 단일 라벨.",
    after: "TTFT·TPOT·E2E 3개 카드와 정의.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "755af71" }],
  },
  {
    id: "CR-AID-09", area: "AID", title: "AI 노트북 — 2차년도 개발 기능만 시범서비스 형상",
    pages: ["/ai-development"],
    sources: [M("§2.4", "전체 지원 기능과 2차년도 개발 기능을 정리해 포털에 반영. 2차년도 외는 최종 형상"), O("확인 4", "HPO·MLPerf·KV Cache는 최종 형상")],
    before: "형상 구분 없음.",
    after: "형상 안내 배너. Profiles·Notebooks·Pipelines·Serving·모델 구조 시각화는 2차년도, Experiments(HPO)·MLPerf·KV Cache·자동 진단은 최종 형상.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "태그·안내" }],
  },

  // ── IAM ──────────────────────────────────────────────────────
  {
    id: "CR-IAM-01", area: "IAM", title: "권한 매트릭스 토글",
    pages: ["/iam/roles"],
    sources: [E("#40", "권한 매트릭스 토글 방식"), M("§2.7", "권한별 토글 방식 적용 여부 확인")],
    before: "매트릭스 표시만.",
    after: "셀별 Switch 토글 + 저장·되돌리기.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "eba9349" }],
  },
  {
    id: "CR-IAM-02", area: "IAM", title: "권한 매트릭스 추가·삭제",
    pages: ["/iam/roles"],
    sources: [E("#41", "권한 매트릭스 추가·삭제"), M("§2.7", "권한 매트릭스 추가 및 삭제 기능 필요")],
    before: "고정 권한 13개.",
    after: "커스텀 권한 정의 다이얼로그로 추가·삭제.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "", commit: "eba9349" }],
  },
  {
    id: "CR-IAM-03", area: "IAM", title: "Workload 기반 접근제어 정책(OPA) 화면",
    pages: ["/iam/roles"],
    sources: [
      W("ETRI p.11 · 회의록 2", "공인인증시험 10/15~11/10, 정량지표 'AI반도체 클라우드 접근제어 방식' 2차년도 2종(RBAC + Workload 기반)"),
      W("KETI p.13", "워크로드 명세(sched.ai/profile.ai) 기반 정책·제약"),
    ],
    before: "RBAC 역할 매트릭스만.",
    after: "역할·권한 화면에 '워크로드 정책 (OPA)' 탭: 워크로드 라벨·네임스페이스·가속기 쿼터·데이터 민감도 조건의 허용/거부 규칙, 평가 순서, 감사 연동. 공인인증시험 2종 대응.",
    status: "reflected",
    history: [{ date: "2026-09-15", note: "2차 워크샵 반영" }],
    decision: [5],
  },
  {
    id: "CR-IAM-04", area: "IAM", title: "개방형 인터페이스 비용 정보 제공 범위",
    pages: ["/iam/api-keys"],
    sources: [W("KETI p.28 ⑥", "오케스트로·KETI: 개방형 인터페이스를 통한 비용 정보 제공 범위 후속 협의"), W("KETI p.19, 26", "점유시간·배분 비중·작업당/토큰당 비용·전성비 산출 항목")],
    before: "API Key 스코프에 비용 도메인 없음.",
    after: "Open API 명세에 비용 리소스 초안(프로젝트·워크로드 점유시간·비용·전성비 읽기 전용) 표시, 스코프 cost:read. KETI 협의 후 확정.",
    status: "partial",
    history: [{ date: "2026-09-15", note: "초안 표시" }],
    decision: [4],
  },

  // ── INF ──────────────────────────────────────────────────────
  {
    id: "CR-INF-01", area: "INF", title: "인프라 관리·기술인벤토리의 AI반도체 링크 제거",
    pages: ["/infrastructure/servers", "/topology"],
    sources: [E("#23", "AI 반도체 관리 명세 없음")],
    before: "가속기 행·노드 클릭 시 /ai-accelerators 상세로 이동.",
    after: "이동 제거, 가속기 정보 표시는 유지.",
    status: "reflected",
    history: [{ date: "2026-07-23", note: "", commit: "dc05fee" }],
  },
  {
    id: "CR-INF-02", area: "INF", title: "기술인벤토리 관리 최종 형상",
    pages: ["/topology"],
    sources: [O("확인 4", "회의록 미논의, 2차년도 SFR 대응 없음 → 최종 형상")],
    before: "항상 표시.",
    after: "시범서비스 형상에서 사이드바 숨김.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "태그" }],
    feature: "topology",
  },
  {
    id: "CR-INF-03", area: "INF", title: "자원풀 헬스체크(052)·외부 블록스토리지 자원풀(048) → 인프라 관리 탭",
    pages: ["/infrastructure/servers"],
    sources: [M("§2.5 공급자 관리", "공급자 관리 삭제"), O("확인 3", "SFR.MNT.052 Provider Health Check·048 외부 블록스토리지 자원풀은 인프라 관리로 이동")],
    before: "공급자 관리 페이지 안의 자원풀 헬스체크.",
    after: "인프라 관리에 '자원풀 헬스체크'(OpenStack 서비스 6종 응답)·'외부 블록스토리지 자원풀'(Ceph RBD·SAN 등록·용량·연결 테스트) 탭.",
    status: "reflected",
    history: [{ date: "2026-09-14", note: "탭 신설" }],
    decision: [11],
  },

  // ── DOC ──────────────────────────────────────────────────────
  {
    id: "CR-DOC-01", area: "DOC", title: "일부 기능 클릭 원활치 않음",
    pages: ["/dashboard", "/monitoring", "/iaas/instances", "/paas/workloads", "/ai-development/notebooks", "/iam/api-keys"],
    sources: [E("#1", "일부 기능 클릭 원활치 않음")],
    before: "헤더의 기간·새로고침·내보내기·동기화 버튼, VM·워크로드·서버 상세의 액션 버튼, API Key 행 버튼 등 121개 버튼에 핸들러 없음(2026-09-15 초기본 전수 점검). 워크로드 행 메뉴 '상세 보기'는 이름으로 이동해 404.",
    after: "전 화면 액션에 다이얼로그·시트·토스트 응답. 2026-09-15 전수 점검으로 남아 있던 39개 버튼(옵저버빌리티 조회 구간 순환·자동 새로고침 토글, 트레이스 선택, 엑셀 내보내기, 동기화, VM 전원·리소스 조정, 워크로드·노트북·서버 액션, API Key 복사·재발급·삭제 등)에 응답 추가, 워크로드 상세 링크 id로 수정.",
    status: "reflected",
    history: [{ date: "2026-07-22", note: "스프린트 1~6" }, { date: "2026-09-15", note: "초기본·반영본 전수 점검 후 잔여 39개 버튼 응답, 워크로드 상세 링크 수정" }],
  },
  {
    id: "CR-DOC-02", area: "DOC", title: "명세↔목업 지속 검토 채널",
    pages: ["/changes"],
    sources: [E("#2", "명세와 목업 지속 검토"), M("§2.8 기능 명세서", "명세에는 반영완료로 되어 있으나 검토 사이트에는 미지원 — 명세 수정 추진. 명세서 공유 여부는 내부 판단")],
    before: "검토 채널 없음.",
    after: "변경 요구사항 대비표(/changes)와 화면 안 변경 표시로 검토. 정기 채널·명세 상태 열 재분류는 미완.",
    status: "partial",
    history: [{ date: "2026-09-15", note: "대비표 신설" }],
    decision: [12],
  },
  {
    id: "CR-DOC-03", area: "DOC", title: "스토리지 기능 명세 갱신",
    pages: ["/paas/storage"],
    sources: [E("#43", "스토리지 관련 기능 명세"), M("§2.8 기능 명세서", "명세-목업 불일치 정리")],
    before: "명세에 반영완료로 표기, 목업 미지원.",
    after: "UI는 완성(PV·SC 관리자). 명세서 갱신은 문서 작업으로 남음.",
    status: "partial",
    history: [{ date: "2026-07-22", note: "UI", commit: "5436795" }],
    decision: [12],
  },
  {
    id: "CR-DOC-04", area: "DOC", title: "버전 이력·변경 표시 도구",
    pages: ["/changes"],
    sources: [M("§3.2", "8월 워크샵에서 1단계·2차년도 개발 형상·진행상황 제시"), W("회의록 5", "오케스트로 진행상황 공유, 9/16 회의에서 통합 현황 제시")],
    before: "없음.",
    after: "초기 전달본(v1.0) 정적 스냅샷 + 변경 요구사항 대비표(/changes) + 화면 안 '변경 표시' 모드(코드·출처·이전/이후).",
    status: "reflected",
    history: [{ date: "2026-09-07", note: "버전 이력 페이지" }, { date: "2026-09-15", note: "요구사항 코드 체계·변경 표시 모드" }, { date: "2026-09-15", note: "마크 없던 18건에 화면 안 변경 표시 추가(메뉴·PaaS·AI 개발환경·AI 인프라)" }],
  },
];

export const CR_MAP: Record<string, ChangeRequest> = Object.fromEntries(CHANGE_REQUESTS.map((c) => [c.id, c]));

/** 경로에 걸린 변경 요구사항 (정확히 같은 경로 우선, 없으면 상위 경로) */
export function changesForPath(pathname: string): ChangeRequest[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  const exact = CHANGE_REQUESTS.filter((c) => c.pages.some((pg) => pg === p));
  if (exact.length > 0) return exact;
  return CHANGE_REQUESTS.filter((c) => c.pages.some((pg) => p.startsWith(pg + "/")));
}

export function countByStatus(list: ChangeRequest[] = CHANGE_REQUESTS): Record<CrStatus, number> {
  const c: Record<CrStatus, number> = { reflected: 0, partial: 0, pending: 0, excluded: 0, planned: 0 };
  for (const cr of list) c[cr.status] += 1;
  return c;
}

export function groupByArea(list: ChangeRequest[] = CHANGE_REQUESTS): { area: CrArea; items: ChangeRequest[] }[] {
  return AREA_ORDER.map((area) => ({ area, items: list.filter((c) => c.area === area) })).filter((g) => g.items.length > 0);
}
