/* 포털 형상(scope) — 2차년도 시범서비스 형상과 최종 형상 설계안을 기능 단위로 구분한다.
 *
 * 근거: 260702 포털 기능 검토 회의록 2.1·2.4 — "2차년도 과업 범위가 아닌 것들은 최종 형상 설계안으로 유지하고
 * 시범서비스 포털에는 삭제 필요". 2026-09-14 확인: 회의록에서 논의된 기능 외는 최종 형상으로 분류한다.
 *
 * 사용:
 *   - nav.ts 항목의 `feature` 필드가 여기 FEATURES.id와 연결되면 형상에 따라 사이드바에서 숨긴다.
 *   - 페이지 안의 기능은 <FeatureGate id="..."> 로 감싼다.
 *   - 환경설정(/settings) "포털 형상"에서 프리셋 전환과 기능별 표시 여부를 바꾼다. localStorage에 저장한다. */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Scope = "y2" | "final";

export const SCOPE_LABEL: Record<Scope, string> = {
  y2: "2차년도 시범서비스",
  final: "최종 형상",
};

export const SCOPE_SHORT: Record<Scope, string> = {
  y2: "2차년도",
  final: "최종 형상",
};

export interface Feature {
  id: string;
  label: string;
  /** 소속 메뉴 경로. 메뉴 단위 기능이면 그 메뉴의 href */
  href: string;
  /** 사이드바 섹션(관리자 기준) */
  section: string;
  /** menu: 메뉴 전체를 숨김 · feature: 메뉴 안의 일부 기능만 숨김 */
  level: "menu" | "feature";
  scope: Scope;
  /** 범위 판단 근거 */
  basis: string;
}

export const FEATURES: Feature[] = [
  // ── 옵저버빌리티 ──────────────────────────────────────────
  {
    id: "monitoring.golden-signals",
    label: "인프라 모니터링 상단 지표 카드 3종",
    href: "/monitoring",
    section: "옵저버빌리티",
    level: "feature",
    scope: "y2",
    basis: "수집이 어려운 3종을 대체 지표(전력 효율·저장소 사용률·쓰로틀링 횟수)로 교체해 2차년도 형상에 포함한다.",
  },
  {
    id: "monitoring.insights.aiops",
    label: "AI 모델 분석 (메뉴 전체)",
    href: "/monitoring/insights",
    section: "옵저버빌리티",
    level: "menu",
    scope: "final",
    basis: "AIOps 성격으로 2차년도 과업 범위 밖. 2차년도 옵저버빌리티 2종은 Loki 로그 + 규칙 기반 이상감지까지라 메뉴 전체를 최종 형상 설계안에만 둔다.",
  },
  {
    id: "monitoring.traces.internal",
    label: "분산 트레이스 (메뉴 전체)",
    href: "/monitoring/traces",
    section: "옵저버빌리티",
    level: "menu",
    scope: "final",
    basis: "트레이스 식별자가 구축되지 않았고 Tempo 연계는 3차년도라 메뉴 전체를 최종 형상 설계안에만 둔다.",
  },
  // ── 클라우드 자원 ─────────────────────────────────────────
  {
    id: "iaas.volumes.reuse",
    label: "기존 볼륨 재사용(VM 연결)",
    href: "/iaas/volumes",
    section: "클라우드 자원",
    level: "feature",
    scope: "final",
    basis: "볼륨은 Flavor 선택 시 자동 생성. 기존 스토리지 재사용은 고도화 항목.",
  },
  {
    id: "iaas.images.packaging",
    label: "이미지 패키징(멀티레벨 이미지 빌더 연동)",
    href: "/iaas/images",
    section: "클라우드 자원",
    level: "feature",
    scope: "final",
    basis: "외부 이미지 빌더 개발 시 이미지 메뉴에 연동.",
  },
  {
    id: "paas.config",
    label: "설정 관리(ConfigMap·Secret)",
    href: "/paas/config",
    section: "클라우드 자원",
    level: "menu",
    scope: "final",
    basis: "SFR.MNT.028 K8s 앱 관리는 '27 항목.",
  },
  // ── 서비스 마켓플레이스 ───────────────────────────────────
  {
    id: "catalog.apps",
    label: "애플리케이션 레벨 실행(모델 위 앱 카탈로그)",
    href: "/catalog",
    section: "서비스 마켓플레이스",
    level: "feature",
    scope: "final",
    basis: "애플리케이션 레벨은 추가 정의 필요. SFR.MNT.035 마켓플레이스는 '26 설계·'27 프로토타입.",
  },
  // ── AI 개발환경 ───────────────────────────────────────────
  {
    id: "ai.experiments",
    label: "Experiments (HPO) · MLPerf 벤치마크",
    href: "/ai-development/experiments",
    section: "AI 개발환경",
    level: "menu",
    scope: "final",
    basis: "2차년도 개발 기능만 시범서비스에 반영. HPO·벤치마크는 '26 SFR 목록에 없음.",
  },
  {
    id: "ai.model-insights.aiops",
    label: "병목 분석 — 자동 진단·권장 조치·KV Cache 미스율",
    href: "/ai-development/model-insights",
    section: "AI 개발환경",
    level: "feature",
    scope: "final",
    basis: "SFR.MNT.014 모델 구조 시각화·병목 하이라이트는 '26, 프로파일러 031은 '27, 병목 분석 034는 '28.",
  },
  // ── AI 인프라 ─────────────────────────────────────────────
  {
    id: "topology",
    label: "기술인벤토리 관리(Smartscape)",
    href: "/topology",
    section: "AI 인프라",
    level: "menu",
    scope: "final",
    basis: "2차년도 SFR에 대응 항목 없음.",
  },
  {
    id: "infra.storage-pools",
    label: "외부 블록스토리지 자원풀",
    href: "/infrastructure/servers",
    section: "AI 인프라",
    level: "feature",
    scope: "y2",
    basis: "SFR.MNT.048('26 신규). 공급자 관리 삭제로 인프라 관리 탭으로 이동.",
  },
  {
    id: "infra.health-check",
    label: "Provider Health Check",
    href: "/infrastructure/servers",
    section: "AI 인프라",
    level: "feature",
    scope: "y2",
    basis: "SFR.MNT.052('26 신규). 공급자 관리 삭제로 인프라 관리 탭으로 이동.",
  },
];

export const FEATURE_MAP: Record<string, Feature> = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

export type Preset = "y2" | "final" | "custom";

export const PRESET_LABEL: Record<Preset, string> = {
  y2: "2차년도 시범서비스",
  final: "최종 형상 설계안",
  custom: "사용자 지정",
};

function presetMap(p: Exclude<Preset, "custom">): Record<string, boolean> {
  return Object.fromEntries(FEATURES.map((f) => [f.id, p === "final" ? true : f.scope === "y2"]));
}

function detectPreset(visible: Record<string, boolean>): Preset {
  const y2 = presetMap("y2");
  const fin = presetMap("final");
  if (FEATURES.every((f) => (visible[f.id] ?? y2[f.id]) === y2[f.id])) return "y2";
  if (FEATURES.every((f) => (visible[f.id] ?? fin[f.id]) === fin[f.id])) return "final";
  return "custom";
}

interface ScopeState {
  preset: Preset;
  /** 기능별 표시 여부 */
  visible: Record<string, boolean>;
  setPreset: (p: Exclude<Preset, "custom">) => void;
  setFeature: (id: string, on: boolean) => void;
  reset: () => void;
}

export const useScope = create<ScopeState>()(
  persist(
    (set, get) => ({
      preset: "y2",
      visible: presetMap("y2"),
      setPreset: (p) => set({ preset: p, visible: presetMap(p) }),
      setFeature: (id, on) => {
        const visible = { ...get().visible, [id]: on };
        set({ visible, preset: detectPreset(visible) });
      },
      reset: () => set({ preset: "y2", visible: presetMap("y2") }),
    }),
    { name: "openkcloud-scope", version: 2 },
  ),
);

/** 기능 표시 여부. 등록되지 않은 id는 항상 표시 */
export function isFeatureVisible(visible: Record<string, boolean>, id: string): boolean {
  const f = FEATURE_MAP[id];
  if (!f) return true;
  return visible[id] ?? f.scope === "y2";
}

export function useFeatureVisible(id: string): boolean {
  return useScope((s) => isFeatureVisible(s.visible, id));
}

/** 현재 숨겨진 기능 id 집합 */
export function hiddenFeatures(visible: Record<string, boolean>): Set<string> {
  return new Set(FEATURES.filter((f) => !isFeatureVisible(visible, f.id)).map((f) => f.id));
}

/** 메뉴 href에 대응하는 메뉴 단위 기능 */
export function menuFeature(href: string): Feature | undefined {
  return FEATURES.find((f) => f.level === "menu" && f.href === href);
}

/** 메뉴 href 아래에 걸린 기능(메뉴 단위·기능 단위 모두) */
export function featuresOf(href: string): Feature[] {
  return FEATURES.filter((f) => f.href === href);
}
