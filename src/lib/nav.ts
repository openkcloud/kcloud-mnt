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
    { label: "AI 모델 분석", href: "/monitoring/insights", icon: Sparkles },
    { label: "분산 트레이스", href: "/monitoring/traces", icon: GitBranch },
    { label: "로그·이벤트", href: "/monitoring/logs", icon: ScrollText },
    { label: "알람·SLO", href: "/monitoring/alerts", icon: Bell },
  ],
};

const SECTION_CLOUD: NavSection = {
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
        { label: "라우터", href: "/iaas/routers", icon: Server },
        { label: "보안 그룹", href: "/iaas/security-groups", icon: Server },
        { label: "키페어", href: "/iaas/keypairs", icon: Server },
        { label: "볼륨·스토리지", href: "/iaas/volumes", icon: Server },
        { label: "이미지·플레이버", href: "/iaas/images", icon: Server },
        { label: "공급자 관리", href: "/iaas/providers", icon: Server },
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
        { label: "설정 관리", href: "/paas/config", icon: Boxes },
      ],
    },
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
        { label: "Experiments (HPO)", href: "/ai-development/experiments", icon: BrainCircuit },
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
    { label: "기술인벤토리 관리", href: "/topology", icon: Layers },
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

// ─────────────────────────────────────────────────────────────
// 역할별 섹션 순서 (ETRI 260615 피드백 §3 반영)
// ─────────────────────────────────────────────────────────────

// 사용자: 자원 활용이 주 목적 → 클라우드 자원·마켓플레이스·AI 개발환경 우선 배치
const NAV_SECTIONS_USER: NavSection[] = [
  SECTION_OVERVIEW,
  SECTION_CLOUD,
  SECTION_MARKETPLACE,
  SECTION_AI_DEV,
  SECTION_OBSERVABILITY,
  SECTION_AI_INFRA,
];

// 관리자: 인프라 현황 파악과 서비스 구성이 주 목적 → 옵저버빌리티·클라우드 자원 우선
const NAV_SECTIONS_ADMIN: NavSection[] = [
  SECTION_OVERVIEW,
  SECTION_OBSERVABILITY,
  SECTION_CLOUD,
  SECTION_MARKETPLACE,
  SECTION_AI_DEV,
  SECTION_AI_INFRA,
  SECTION_OPS,
];

// 기본 (역할 미지정 시): 관리자 뷰
export const NAV_SECTIONS: NavSection[] = NAV_SECTIONS_ADMIN;

// ─────────────────────────────────────────────────────────────
// 역할별 사이드바 조회
// ─────────────────────────────────────────────────────────────

export function getNavByRole(role: Role): NavSection[] {
  const sections = role === "admin" ? NAV_SECTIONS_ADMIN : NAV_SECTIONS_USER;
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => !i.roles || i.roles.includes(role)),
    }))
    .filter((s) => s.items.length > 0);
}

// backward-compat (기존 filterNavByRole 사용처 존재 시)
export function filterNavByRole(_sections: NavSection[], role: Role): NavSection[] {
  return getNavByRole(role);
}
