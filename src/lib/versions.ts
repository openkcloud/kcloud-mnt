/* 목업 버전 — 초기 전달본(v1.0)과 현재 반영본(v2.1). v2.0은 steps에 남긴다.
 * 메뉴·기능 단위 변경 내용은 src/lib/change-requests.ts(변경 요구사항 대비표)가 단일 원천이다.
 * 이전 버전 화면은 scripts/build-version-snapshot.sh 로 public/versions/<id>/ 에 정적 스냅샷으로 넣는다. */

export interface MockupVersion {
  id: string;
  label: string;
  /** YYYY-MM-DD */
  date: string;
  commit: string;
  status: "delivered" | "current";
  /** 근거 문서·이벤트 */
  basis: string;
  summary: string;
  /** 정적 스냅샷 basePath. 없으면 현재 앱 자체가 이 버전 */
  snapshotBase?: string;
  /** 역할별 사이드바 섹션 순서 */
  sidebar: { admin: string[]; user: string[] };
  /** 중간 단계(참고) */
  steps?: { date: string; label: string; commit?: string }[];
}

export const INITIAL_VERSION: MockupVersion = {
  id: "v1.0",
  label: "초기 전달본",
  date: "2026-06-04",
  commit: "4bf38da",
  status: "delivered",
  basis: "요구사항정의서 v1.1(2026.03.20) 반영 검토서 · IaaS/PaaS 기능명세서 113건 · ETRI 검토 요청본",
  summary:
    "OpenStack IaaS·Kubernetes PaaS·Kubeflow·마켓플레이스·옵저버빌리티·IAM을 한 포탈로 구성한 첫 전달본. 메뉴 37개. 관리자·사용자 사이드바 순서가 같고, AI반도체 관리·공급자 관리 페이지가 있다.",
  snapshotBase: "/versions/v1.0",
  sidebar: {
    admin: ["개요", "옵저버빌리티", "클라우드 자원", "AI 인프라", "AI 개발환경", "서비스 마켓플레이스", "운영"],
    user: ["개요", "옵저버빌리티", "클라우드 자원", "AI 인프라", "AI 개발환경", "서비스 마켓플레이스", "운영"],
  },
};

export const CURRENT_VERSION: MockupVersion = {
  id: "v2.1",
  label: "AI 노트북 재편 반영본",
  date: "2026-09-27",
  commit: "pending",
  status: "current",
  basis: "ETRI 검토 의견 44건(2026-06-15) · 포털 기능 검토 회의록 v1.1(2026-07-02) · 2차년도 2차 워크샵(2026-08-27~28) · 4차 기관 협조 회의(2026-09-16) · 이노그리드 모니터링 API v0.2(2026-09-11) · ETRI AI 노트북 추가 피드백(2026-09-24)",
  summary:
    "v2.0(회의·워크샵 반영본) 위에 4차 협조 회의와 ETRI AI 노트북 피드백을 얹었다. 옵저버빌리티 3개 화면을 모니터링 API v2 제공 범위로 재구성하고 마켓플레이스 시그니처 시나리오를 뺐다. AI 노트북 메뉴를 사용 순서(워크스페이스·개발환경·학습·모델 배포·성능 분석)로 재편하고, 헤더 프로젝트 선택기로 테넌트 단위를 구분하며, 프로젝트 상세에 AI 워크스페이스 탭을 두었다.",
  sidebar: {
    admin: ["개요", "옵저버빌리티", "클라우드 자원", "서비스 마켓플레이스", "네트워크·볼륨·서비스 구성", "AI 개발환경", "AI 인프라", "운영", "목업 관리"],
    user: ["개요", "클라우드 자원", "서비스 마켓플레이스", "AI 개발환경", "옵저버빌리티", "AI 인프라", "목업 관리"],
  },
  steps: [
    { date: "2026-07-22~27", label: "ETRI 검토 의견 1차 반영(스프린트 1~6, 트랙 B/D)", commit: "248cd51" },
    { date: "2026-09-07", label: "Mac 이관, 버전 이력 도구", commit: "112a6d6" },
    { date: "2026-09-14", label: "260702 회의록 결정 반영, 포털 형상" },
    { date: "2026-09-15", label: "2차 워크샵 반영, 변경 요구사항 코드 체계·화면 안 변경 표시" },
    { date: "2026-09-15", label: "v2.0 회의·워크샵 반영본", commit: "8391ea5" },
    { date: "2026-09-18", label: "4차 협조 회의 반영 — 인프라 모니터링 대체 지표 3종 교체, AI 모델 분석·분산 트레이스 2차년도 제외" },
    { date: "2026-09-19", label: "옵저버빌리티 3개 화면을 모니터링 API v0.2 기준으로 재구성, 마켓플레이스 시그니처 시나리오 제외" },
    { date: "2026-09-27", label: "ETRI AI 노트북 피드백 반영 — 메뉴를 사용 순서로 재편(C안), 프로젝트 단위 구분, 프로젝트 상세 AI 워크스페이스 탭" },
  ],
};

export const VERSIONS: MockupVersion[] = [INITIAL_VERSION, CURRENT_VERSION];

/** 스냅샷 디렉터리 경로. dev에서는 next.config의 rewrite가 index.html로 연결한다. */
export function snapshotUrl(base: string, href: string) {
  return `${base}${href}/`;
}
