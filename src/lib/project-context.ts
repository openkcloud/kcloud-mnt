/* 포털 전역 프로젝트 컨텍스트 — 테넌트 = 프로젝트 = OpenStack Project = Kubeflow Profile(1:1).
 * 헤더에서 고른 프로젝트로 AI 노트북 전 화면을 거른다. 전체 보기는 관리자만. */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth, type User } from "@/lib/auth";
import { tenants } from "@/mocks/fixtures";

export const ALL = "all";

/** AI 워크스페이스(Profile)가 있는 프로젝트 — 가속기 쿼터가 있는 프로젝트만 승인 시 자동 생성 */
export const AI_PROJECTS = tenants
  .filter((t) => t.quotaAcc > 0)
  .map((t) => ({ id: t.id, name: t.name, orgId: t.orgId, description: t.description, tenant: t }));

export type AIProject = (typeof AI_PROJECTS)[number];

/** 사용자 계정이 소속된 프로젝트 (목업 기본값) */
const DEFAULT_USER_PROJECTS = ["ai-research", "llm-serving"];

export function allowedProjects(user: User | null): string[] {
  if (!user) return [];
  const all = AI_PROJECTS.map((p) => p.name);
  if (user.role === "admin") return all;
  const mine = user.projects.includes("*") ? DEFAULT_USER_PROJECTS : user.projects;
  return all.filter((n) => mine.includes(n));
}

interface ProjectCtxState {
  current: string;
  setCurrent: (p: string) => void;
}

const useProjectCtxStore = create<ProjectCtxState>()(
  persist((set) => ({ current: "ai-research", setCurrent: (current) => set({ current }) }), { name: "openkcloud-project" }),
);

export function useProjectContext() {
  const user = useAuth((s) => s.user);
  const stored = useProjectCtxStore((s) => s.current);
  const setCurrent = useProjectCtxStore((s) => s.setCurrent);
  const isAdmin = user?.role === "admin";
  const allowed = allowedProjects(user);
  let current = stored;
  if (current === ALL ? !isAdmin : !allowed.includes(current)) current = allowed[0] ?? ALL;
  const project = AI_PROJECTS.find((p) => p.name === current);
  return {
    current,
    setCurrent,
    isAdmin,
    allowed,
    project,
    isAll: current === ALL,
    /** 네임스페이스가 현재 프로젝트에 속하는지 */
    match: (ns?: string) => current === ALL || ns === current,
    label: current === ALL ? "전체 프로젝트" : current,
  };
}
