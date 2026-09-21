import {
  LayoutDashboard,
  Server,
  Boxes,
  BrainCircuit,
  ShoppingBag,
  Activity,
  ShieldCheck,
  Settings,
  Layers,
  GitBranch,
  ScrollText,
  Bell,
  Sparkles,
  Database,
  ListChecks,
  Network,
  Route,
  KeyRound,
  HardDrive,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
  children?: NavItem[];
  badge?: string;
  /** src/lib/scope.ts FEATURES.id — 형상에서 숨기면 이 항목도 숨긴다 */
  feature?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// ─────────────────────────────────────────────────────────────
// 섹션 정의 (재사용 가능한 단위)
// ─────────────────────────────────────────────────────────────

const SECTION_OVERVIEW: NavSection = {
  label: "개요",
  items: [
    {
      label: "통합 대시보드",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ],
};

const SECTION_OBSERVABILITY: NavSection = {
  label: "옵저버빌리티",
  items: [
    { label: "인프라 모니터링", href: "/monitoring", icon: Activity },
    { label: "AI 모델 분석", href: "/monitoring/insights", icon: Sparkles, feature: "monitoring.insights.aiops" },
    { label: "분산 트레이스", href: "/monitoring/traces", icon: GitBranch, feature: "monitoring.traces.internal" },
    { label: "로그·이벤트", href: "/monitoring/logs", icon: ScrollText },
    { label: "알람", href: "/monitoring/alerts", icon: Bell },
  ],
};

// 클라우드 자원 — 사용자: 자원을 쓰기 위한 메뉴(조회·선택·신청)
// 260702 회의록 2.5: 네트워크·라우터·FIP·보안그룹·키페어 생성은 관리자 권한. 사용자는 조회·선택만.
const SECTION_CLOUD_USER: NavSection = {
  label: "클라우드 자원",
  items: [
    {
      label: "IaaS (OpenStack)",
      href: "/iaas",
      icon: Server,
      children: [
        { label: "프로젝트", href: "/iaas/projects", icon: Server },
        { label: "가상서버", href: "/iaas/instances", icon: Server },
        { label: "네트워크", href: "/iaas/networks", icon: Server },
        { label: "보안 그룹", href: "/iaas/security-groups", icon: Server },
        { label: "키페어", href: "/iaas/keypairs", icon: Server },
        { label: "볼륨·스토리지", href: "/iaas/volumes", icon: Server },
        { label: "이미지·플레이버", href: "/iaas/images", icon: Server },
      ],
    },
    {
      label: "PaaS (Kubernetes)",
      href: "/paas",
      icon: Boxes,
      children: [
        { label: "클러스터", href: "/paas/clusters", icon: Boxes },
        { label: "워크로드", href: "/paas/workloads", icon: Boxes },
        { label: "서비스·인그레스", href: "/paas/services", icon: Boxes },
        { label: "스토리지", href: "/paas/storage", icon: Boxes },
        { label: "설정 관리", href: "/paas/config", icon: Boxes, feature: "paas.config" },
      ],
    },
  ],
};

// 클라우드 자원 — 관리자: 구성(셋업) 기능은 아래 "네트워크·볼륨·서비스 구성" 섹션으로 분리
const SECTION_CLOUD_ADMIN: NavSection = {
  label: "클라우드 자원",
  items: [
    {
      label: "IaaS (OpenStack)",
      href: "/iaas",
      icon: Server,
      children: [
        { label: "프로젝트", href: "/iaas/projects", icon: Server },
        { label: "가상서버", href: "/iaas/instances", icon: Server },
        { label: "이미지·플레이버", href: "/iaas/images", icon: Server },
      ],
    },
    {
      label: "PaaS (Kubernetes)",
      href: "/paas",
      icon: Boxes,
      children: [
        { label: "클러스터", href: "/paas/clusters", icon: Boxes },
        { label: "워크로드", href: "/paas/workloads", icon: Boxes },
        { label: "설정 관리", href: "/paas/config", icon: Boxes, feature: "paas.config" },
      ],
    },
  ],
};

// 관리자 전용 구성 섹션 — 260702 회의록 2.2 관리자 메뉴안 "네트워크·볼륨·서비스 구성"
const SECTION_CONFIG_ADMIN: NavSection = {
  label: "네트워크·볼륨·서비스 구성",
  items: [
    { label: "네트워크", href: "/iaas/networks", icon: Network },
    { label: "라우터", href: "/iaas/routers", icon: Route },
    { label: "보안 그룹", href: "/iaas/security-groups", icon: ShieldCheck },
    { label: "키페어", href: "/iaas/keypairs", icon: KeyRound },
    { label: "볼륨·스토리지", href: "/iaas/volumes", icon: HardDrive },
    { label: "서비스·인그레스", href: "/paas/services", icon: Globe },
    { label: "K8s 스토리지 (SC·PV)", href: "/paas/storage", icon: Database },
  ],
};

const SECTION_MARKETPLACE: NavSection = {
  label: "서비스 마켓플레이스",
  items: [
    {
      label: "서비스 마켓플레이스",
      href: "/catalog",
      icon: ShoppingBag,
    },
  ],
};

const SECTION_AI_DEV: NavSection = {
  label: "AI 개발환경",
  items: [
    {
      label: "AI 노트북",
      href: "/ai-development",
      icon: BrainCircuit,
      children: [
        { label: "Profiles (워크스페이스)", href: "/ai-development/profiles", icon: BrainCircuit },
        { label: "Notebooks (개발환경)", href: "/ai-development/notebooks", icon: BrainCircuit },
        { label: "Pipelines (워크플로우)", href: "/ai-development/pipelines", icon: BrainCircuit },
        { label: "Experiments (HPO)", href: "/ai-development/experiments", icon: BrainCircuit, feature: "ai.experiments" },
        { label: "Serving (모델 배포)", href: "/ai-development/serving", icon: BrainCircuit },
        { label: "워크플로우 병목 분석", href: "/ai-development/model-insights", icon: BrainCircuit },
      ],
    },
  ],
};

const SECTION_AI_INFRA: NavSection = {
  label: "AI 인프라",
  items: [
    { label: "리소스 현황", href: "/resource-map", icon: Database },
    { label: "인프라 관리", href: "/infrastructure/servers", icon: Server },
    { label: "기술인벤토리 관리", href: "/topology", icon: Layers, feature: "topology" },
  ],
};

const SECTION_OPS: NavSection = {
  label: "운영",
  items: [
    {
      label: "IAM·접근제어",
      href: "/iam",
      icon: ShieldCheck,
      children: [
        { label: "사용자", href: "/iam/users", icon: ShieldCheck },
        { label: "역할·권한", href: "/iam/roles", icon: ShieldCheck },
        { label: "API Key", href: "/iam/api-keys", icon: ShieldCheck },
        { label: "감사 로그", href: "/iam/audit", icon: ShieldCheck },
      ],
    },
    { label: "시스템 설정", href: "/settings", icon: Settings },
  ],
};

// 목업 관리: 변경 요구사항 대비표 (검토 단계 전용, 양쪽 역할 공통)
const SECTION_MOCKUP: NavSection = {
  label: "목업 관리",
  items: [{ label: "변경 요구사항 대비표", href: "/changes", icon: ListChecks }],
};

// ─────────────────────────────────────────────────────────────
// 역할별 섹션 순서 (ETRI 260615 §3 → 260702 회의록 2.2 확정)
// ─────────────────────────────────────────────────────────────

// 사용자: 자원 활용 중심 — 개요 → 클라우드 자원 → 마켓 → AI 개발환경 → 옵저버빌리티 → AI 인프라
const NAV_SECTIONS_USER: NavSection[] = [
  SECTION_OVERVIEW,
  SECTION_CLOUD_USER,
  SECTION_MARKETPLACE,
  SECTION_AI_DEV,
  SECTION_OBSERVABILITY,
  SECTION_AI_INFRA,
  SECTION_MOCKUP,
];

// 관리자: 인프라 현황·서비스 구성 중심 — 개요 → 옵저버빌리티 → 클라우드 자원 → 마켓 → 네트워크·볼륨·서비스 구성 → AI 인프라
// AI 개발환경·운영은 회의록 6개 대분류에 없지만 유지(2026-09-14 확인). IAM은 정량지표 접근제어·SFR.MNT 006/016/017 핵심.
const NAV_SECTIONS_ADMIN: NavSection[] = [
  SECTION_OVERVIEW,
  SECTION_OBSERVABILITY,
  SECTION_CLOUD_ADMIN,
  SECTION_MARKETPLACE,
  SECTION_CONFIG_ADMIN,
  SECTION_AI_DEV,
  SECTION_AI_INFRA,
  SECTION_OPS,
  SECTION_MOCKUP,
];

// 기본 (역할 미지정 시): 관리자 뷰
export const NAV_SECTIONS: NavSection[] = NAV_SECTIONS_ADMIN;

// ─────────────────────────────────────────────────────────────
// 역할별 사이드바 조회
// ─────────────────────────────────────────────────────────────

function keep(item: NavItem, role: Role, hidden?: Set<string>) {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.feature && hidden?.has(item.feature)) return false;
  return true;
}

/** role별 섹션. hidden에 든 feature id를 가진 항목은 제외한다(포털 형상). */
export function getNavByRole(role: Role, hidden?: Set<string>): NavSection[] {
  const sections = role === "admin" ? NAV_SECTIONS_ADMIN : NAV_SECTIONS_USER;
  return sections
    .map((s) => ({
      ...s,
      items: s.items
        .filter((i) => keep(i, role, hidden))
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => keep(c, role, hidden)) } : i)),
    }))
    .filter((s) => s.items.length > 0);
}
