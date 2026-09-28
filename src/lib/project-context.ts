/* 포털 전역 프로젝트 컨텍스트 — 테넌트 = 프로젝트 = OpenStack Project = Kubeflow Profile(1:1).
 * 헤더에서 고른 프로젝트로 AI 노트북 전 화면을 거른다. 전체 보기는 관리자만.
 *
 * 실백엔드 모드(KF_ENABLED)에서는 프로젝트 목록을 실제 워크스페이스(Kubeflow Profile)에서 만든다.
 * 쿼터·사용량도 Profile의 ResourceQuota 실측값이다. 목업 모드는 fixtures의 tenants를 쓴다. */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth, type User } from "@/lib/auth";
import { api } from "@/lib/api";
import { KF_ENABLED } from "@/lib/kf";
import { tenants } from "@/mocks/fixtures";
import type { Tenant } from "@/lib/types";

export const ALL = "all";

export interface AIProject {
  id: string;
  name: string;
  orgId: string;
  description: string;
  tenant: Tenant;
}

/** 목업 — AI 워크스페이스(Profile)가 있는 프로젝트. 가속기 쿼터가 있는 프로젝트만 승인 시 자동 생성 */
export const AI_PROJECTS: AIProject[] = tenants
  .filter((t) => t.quotaAcc > 0)
  .map((t) => ({ id: t.id, name: t.name, orgId: t.orgId, description: t.description, tenant: t }));

type Quota = { used: number; limit: number } | undefined;
interface RealProfile {
  name: string;
  owner?: string;
  members?: number;
  cpuQuota?: Quota;
  memQuota?: Quota;
  accQuota?: Quota;
  storageQuota?: Quota;
}

function toProject(p: RealProfile): AIProject {
  const q = (x: Quota) => ({ used: x?.used ?? 0, limit: x?.limit ?? 0 });
  const cpu = q(p.cpuQuota), mem = q(p.memQuota), acc = q(p.accQuota), sto = q(p.storageQuota);
  // IaaS 프로젝트 화면(목업)과 이름이 같으면 그 ID를 써서 '프로젝트에서 보기' 링크가 이어지게 한다
  const iaas = tenants.find((t) => t.name === p.name);
  const id = iaas?.id ?? p.name;
  const orgId = iaas?.orgId ?? "";
  return {
    id,
    name: p.name,
    orgId,
    description: p.owner ? `소유자 ${p.owner}` : "",
    tenant: {
      id,
      name: p.name,
      orgId,
      description: p.owner ? `소유자 ${p.owner}` : "",
      quotaVcpu: cpu.limit,
      usedVcpu: cpu.used,
      quotaRamGb: mem.limit,
      usedRamGb: mem.used,
      // 스토리지 쿼터는 GB 단위로 오므로 TB로 환산
      quotaDiskTb: +(sto.limit / 1024).toFixed(2),
      usedDiskTb: +(sto.used / 1024).toFixed(2),
      quotaAcc: acc.limit,
      usedAcc: acc.used,
      members: p.members ?? 0,
      createdAt: "",
    },
  };
}

/** 지금 쓸 프로젝트 목록 — 실백엔드면 실제 워크스페이스, 아니면 목업 */
export function useAIProjects(): AIProject[] {
  const { data } = api.kubeflow.profiles() as { data: { items: RealProfile[] } | undefined };
  if (!KF_ENABLED) return AI_PROJECTS;
  return (data?.items ?? []).map(toProject);
}

/** 사용자 계정이 소속된 프로젝트 (목업 기본값) */
const DEFAULT_USER_PROJECTS = ["ai-research", "llm-serving"];

export function allowedProjects(user: User | null, projects: AIProject[] = AI_PROJECTS): string[] {
  if (!user) return [];
  const all = projects.map((p) => p.name);
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
  const projects = useAIProjects();
  const isAdmin = user?.role === "admin";
  const allowed = allowedProjects(user, projects);
  // 실백엔드 목록이 아직 안 왔으면 저장된 선택을 그대로 둔다(첫 렌더에서 엉뚱한 프로젝트로 튀지 않게)
  const loading = KF_ENABLED && projects.length === 0;
  let current = stored;
  if (!loading && (current === ALL ? !isAdmin : !allowed.includes(current))) current = allowed[0] ?? ALL;
  const project = projects.find((p) => p.name === current);
  return {
    current,
    setCurrent,
    isAdmin,
    allowed,
    projects,
    project,
    isAll: current === ALL,
    /** 네임스페이스가 현재 프로젝트에 속하는지. 네임스페이스가 없는 자원(실백엔드의 KFP 파이프라인 등록본)은 공용이라 모든 프로젝트에 보인다 */
    match: (ns?: string) => current === ALL || !ns || ns === current,
    label: current === ALL ? "전체 프로젝트" : current,
  };
}
