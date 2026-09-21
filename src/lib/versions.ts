/* 목업 버전 — 초기 전달본(v1.0)과 반영본(v2.0).
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
  id: "v2.0",
  label: "회의·워크샵 반영본",
  date: "2026-09-15",
  commit: "8391ea5",
  status: "current",
  basis: "ETRI 검토 의견 44건(2026-06-15) · 포털 기능 검토 회의록 v1.1(2026-07-02) · 2차년도 2차 워크샵(2026-08-27~28) · 오케스트로 내부 확인(2026-09-14)",
  summary:
    "초기 전달본 대비 변경 요구사항을 코드(CR-영역-번호)로 채번해 반영했다. 역할별 메뉴·관리자 구성 섹션, IaaS 관리자 권한과 자원 신청 흐름, 클러스터 신청·승인, 옵저버빌리티 범위와 공통 지표, IAM 워크로드 정책, 마켓플레이스 조합형 실행, 포털 형상 전환, 화면 안 변경 표시.",
  sidebar: {
    admin: ["개요", "옵저버빌리티", "클라우드 자원", "서비스 마켓플레이스", "네트워크·볼륨·서비스 구성", "AI 개발환경", "AI 인프라", "운영", "목업 관리"],
    user: ["개요", "클라우드 자원", "서비스 마켓플레이스", "AI 개발환경", "옵저버빌리티", "AI 인프라", "목업 관리"],
  },
  steps: [
    { date: "2026-07-22~27", label: "ETRI 검토 의견 1차 반영(스프린트 1~6, 트랙 B/D)", commit: "248cd51" },
    { date: "2026-09-07", label: "Mac 이관, 버전 이력 도구", commit: "112a6d6" },
    { date: "2026-09-14", label: "260702 회의록 결정 반영, 포털 형상" },
    { date: "2026-09-15", label: "2차 워크샵 반영, 변경 요구사항 코드 체계·화면 안 변경 표시" },
    { date: "2026-09-18", label: "4차 협조 회의 반영 — 인프라 모니터링 대체 지표 3종 교체, AI 모델 분석·분산 트레이스 2차년도 제외" },
  ],
};

export const VERSIONS: MockupVersion[] = [INITIAL_VERSION, CURRENT_VERSION];

/** 스냅샷 디렉터리 경로. dev에서는 next.config의 rewrite가 index.html로 연결한다. */
export function snapshotUrl(base: string, href: string) {
  return `${base}${href}/`;
}
