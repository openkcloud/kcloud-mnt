/* 프로젝트(= 워크스페이스, 1:1) 하나의 AI 노트북 자원 요약.
 * IaaS 프로젝트 상세의 'AI 워크스페이스' 탭(CR-IAAS-10)이 쓴다.
 * 실백엔드 모드면 실제 Kubeflow Profile·노트북·실험·서빙에서, 아니면 목업 fixtures에서 계산한다. */
import { api } from "@/lib/api";
import { KF_ENABLED } from "@/lib/kf";
import {
  notebooks as NB,
  pipelines as PL,
  experiments as EX,
  inferenceServices as SV,
} from "@/mocks/fixtures";
import type { KFNotebook, KFExperiment, KFInferenceService, Tenant } from "@/lib/types";

type Quota = { used: number; limit: number };
interface RealProfile {
  name: string;
  status?: string;
  pipelines?: number;
  accQuota?: Quota;
  storageQuota?: Quota;
}

export interface ProjectAIData {
  /** 실백엔드 값인지 */
  real: boolean;
  /** 실백엔드인데 이 프로젝트 이름의 워크스페이스가 아직 없음 */
  missing: boolean;
  loading: boolean;
  status: string;
  notebooks: Pick<KFNotebook, "id" | "name" | "status" | "acceleratorKind" | "acceleratorCount">[];
  pipelines: number;
  experiments: number;
  services: number;
  /** 가속기 — 실백엔드는 워크스페이스 ResourceQuota 기준, 목업은 프로젝트 쿼터 기준 */
  accUsed: number;
  accMax: number;
  accBasis: "워크스페이스 쿼터" | "프로젝트 쿼터";
  /** 노트북 볼륨(TB) */
  storageUsedTb: number;
  storageMaxTb: number;
}

export function useProjectAIData(t: Tenant): ProjectAIData {
  const prof = api.kubeflow.profiles() as { data?: { items: RealProfile[] }; isLoading: boolean };
  const nb = api.kubeflow.notebooks() as { data?: { items: KFNotebook[] } };
  const ex = api.kubeflow.experiments() as { data?: { items: KFExperiment[] } };
  const sv = api.kubeflow.serving() as { data?: { items: KFInferenceService[] } };

  if (!KF_ENABLED) {
    const nbs = NB.filter((n) => n.namespace === t.name);
    const svs = SV.filter((n) => n.namespace === t.name);
    const accInAI = nbs.reduce((a, n) => a + n.acceleratorCount, 0) + svs.length;
    const storageGb = nbs.reduce((a, n) => a + n.storageGb, 0);
    return {
      real: false,
      missing: false,
      loading: false,
      status: "Active",
      notebooks: nbs,
      pipelines: PL.filter((n) => n.namespace === t.name).length,
      experiments: EX.filter((n) => n.namespace === t.name).length,
      services: svs.length,
      accUsed: Math.min(accInAI, t.quotaAcc),
      accMax: t.quotaAcc,
      accBasis: "프로젝트 쿼터",
      storageUsedTb: Math.round(storageGb / 100) / 10,
      storageMaxTb: t.quotaDiskTb,
    };
  }

  const p = prof.data?.items.find((x) => x.name === t.name);
  const inNs = <T extends { namespace?: string }>(xs?: T[]) => (xs ?? []).filter((x) => x.namespace === t.name);
  const nbs = inNs(nb.data?.items);
  const sto = p?.storageQuota ?? { used: 0, limit: 0 };
  return {
    real: true,
    missing: !prof.isLoading && !p,
    loading: prof.isLoading,
    status: p?.status ?? "-",
    notebooks: nbs,
    // KFP 파이프라인 등록본은 네임스페이스가 없는 공용 자원 — 워크스페이스 집계값을 쓴다
    pipelines: p?.pipelines ?? 0,
    experiments: inNs(ex.data?.items).length,
    services: inNs(sv.data?.items).length,
    accUsed: p?.accQuota?.used ?? 0,
    accMax: p?.accQuota?.limit ?? 0,
    accBasis: "워크스페이스 쿼터",
    storageUsedTb: +(sto.used / 1024).toFixed(2),
    storageMaxTb: +(sto.limit / 1024).toFixed(2),
  };
}
