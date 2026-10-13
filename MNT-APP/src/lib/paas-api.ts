"use client";
/**
 * MNT-PAAS 연동 — 서비스 클러스터(Magnum K8s)는 MNT-PAAS 모듈을 통해 가져온다.
 *
 * 주소(NEXT_PUBLIC_PAAS_API):
 *   - 미설정        → http://localhost:8002 (로컬 dev, MNT-PAAS 직접)
 *   - ""(빈값)      → same-origin 상대경로 (/api/paas) — 게이트웨이 운영
 *   - "http://..."  → 고정 주소
 */
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { usePollingInterval } from "@/lib/polling";

const RAW = process.env.NEXT_PUBLIC_PAAS_API;
export const PAAS_BASE = RAW === undefined ? "http://localhost:8002" : RAW;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`PAAS ${res.status}`);
  return res.json() as Promise<T>;
}

// ── 서비스 클러스터 (Magnum) ──
export interface ClusterSummary {
  id: string;
  name: string;
  status: string; // CREATE_COMPLETE / CREATE_IN_PROGRESS / DELETE_IN_PROGRESS / ..._FAILED
  healthStatus: string; // HEALTHY / UNHEALTHY / ""
  k8sVersion: string;
  projectId: string;
  nodeCount: number;
  masterCount: number;
  flavorId: string; // 워커 flavor — IaaS useFlavors 와 조인해 가속기 표시
  masterFlavorId: string;
  apiAddress: string;
  createdAt: string;
}
export interface ClusterNodegroup {
  id: string;
  name: string;
  role: string; // master | worker
  flavorId: string;
  imageId: string;
  nodeCount: number;
  status: string;
}
export interface ClusterDetail extends ClusterSummary {
  healthReason: Record<string, string>;
  statusReason: string;
  labels: Record<string, string>;
  fixedNetworkId: string;
  floatingIpEnabled: boolean;
  updatedAt: string;
  nodegroups: ClusterNodegroup[];
}

// 진행 중(…_IN_PROGRESS)이면 4초, 평상시엔 사용자 설정 주기 (IaaS 서버 목록과 동일 패턴)
const isClusterBusy = (s: string) => s.endsWith("_IN_PROGRESS");

export function useClusters() {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["paas-clusters"],
    queryFn: async (): Promise<ClusterSummary[]> =>
      (await fetchJson<{ items: ClusterSummary[] }>(`${PAAS_BASE}/api/paas/clusters`)).items,
    staleTime: 20 * 1000, retry: 0,
    refetchInterval: (q) =>
      ((q.state.data as ClusterSummary[] | undefined)?.some((c) => isClusterBusy(c.status)) ? 4000 : (pollMs || false)),
  });
}

export function useCluster(id: string | null) {
  return useQuery({
    queryKey: ["paas-cluster", id],
    enabled: !!id,
    queryFn: () => fetchJson<ClusterDetail>(`${PAAS_BASE}/api/paas/clusters/${id}`),
    staleTime: 10 * 1000, retry: 0,
    refetchInterval: (q) => {
      const d = q.state.data as ClusterDetail | undefined;
      return d && isClusterBusy(d.status) ? 4000 : false;
    },
  });
}

/** kubeconfig 다운로드 URL — 브라우저가 직접 받는다(Content-Disposition attachment). */
export function kubeconfigUrl(id: string): string {
  return `${PAAS_BASE}/api/paas/clusters/${id}/kubeconfig`;
}

// ── 전역 클러스터 선택 — 워크로드·서비스·스토리지·설정이 공유하는 스코프 ──
interface PaasClusterState {
  clusterId: string; // "" = 미선택
  setClusterId: (id: string) => void;
}
export const usePaasCluster = create<PaasClusterState>()(
  persist((set) => ({ clusterId: "", setClusterId: (id) => set({ clusterId: id }) }),
    { name: "okc-paas-cluster" }),
);

// ── 클러스터 내부 K8s 리소스 (읽기) — 선택된 클러스터의 API 질의 ──
const nsQ = (ns?: string) => (ns && ns !== "all" ? `?namespace=${encodeURIComponent(ns)}` : "");

export function useNamespaces(clusterId: string) {
  return useQuery({
    queryKey: ["paas-namespaces", clusterId],
    enabled: !!clusterId,
    queryFn: async () =>
      (await fetchJson<{ items: string[] }>(`${PAAS_BASE}/api/paas/clusters/${clusterId}/namespaces`)).items,
    staleTime: 60 * 1000, retry: 0,
  });
}

export interface WorkloadRow {
  name: string;
  namespace: string;
  kind: "Deployment" | "StatefulSet" | "DaemonSet" | "Job" | "CronJob" | string;
  image: string;
  ready: number;
  total: number;
  requests: { cpu: string; memory: string };
  accelerator: { kind: string; count: number } | null;
  schedule: string;
  status: string;
  labels: Record<string, string>;
  createdAt: string;
}
export function useWorkloads(clusterId: string, namespace?: string) {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["paas-workloads", clusterId, namespace ?? "all"],
    enabled: !!clusterId,
    queryFn: async () =>
      (await fetchJson<{ items: WorkloadRow[] }>(
        `${PAAS_BASE}/api/paas/clusters/${clusterId}/workloads${nsQ(namespace)}`)).items,
    retry: 0, refetchInterval: pollMs || false,
  });
}

export interface ServiceRow {
  name: string;
  namespace: string;
  type: string;
  clusterIp: string;
  externalIp: string;
  ports: { port: number; targetPort: string; protocol: string }[];
  selector: Record<string, string>;
  createdAt: string;
}
export interface IngressRow {
  name: string;
  namespace: string;
  className: string;
  hosts: string[];
  tls: boolean;
  ruleCount: number;
  createdAt: string;
}
export function useK8sServices(clusterId: string, namespace?: string) {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["paas-services", clusterId, namespace ?? "all"],
    enabled: !!clusterId,
    queryFn: () => fetchJson<{ services: ServiceRow[]; ingresses: IngressRow[] }>(
      `${PAAS_BASE}/api/paas/clusters/${clusterId}/services${nsQ(namespace)}`),
    retry: 0, refetchInterval: pollMs || false,
  });
}

export interface PvcRow {
  name: string; namespace: string; status: string; volumeName: string;
  capacity: string; accessModes: string[]; storageClass: string; createdAt: string;
}
export interface PvRow {
  name: string; capacity: string; accessModes: string[]; reclaimPolicy: string;
  status: string; claim: string; storageClass: string; csiDriver: string; createdAt: string;
}
export interface StorageClassRow {
  name: string; provisioner: string; reclaimPolicy: string; bindingMode: string;
  isDefault: boolean; parameters: Record<string, string>;
}
export function useK8sStorage(clusterId: string, namespace?: string) {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["paas-storage", clusterId, namespace ?? "all"],
    enabled: !!clusterId,
    queryFn: () => fetchJson<{ pvcs: PvcRow[]; pvs: PvRow[]; storageClasses: StorageClassRow[] }>(
      `${PAAS_BASE}/api/paas/clusters/${clusterId}/storage${nsQ(namespace)}`),
    retry: 0, refetchInterval: pollMs || false,
  });
}

export interface ConfigMapRow { name: string; namespace: string; keys: string[]; createdAt: string }
export interface SecretRow { name: string; namespace: string; type: string; keys: string[]; createdAt: string }
export function useK8sConfigs(clusterId: string, namespace?: string) {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["paas-configs", clusterId, namespace ?? "all"],
    enabled: !!clusterId,
    queryFn: () => fetchJson<{ configmaps: ConfigMapRow[]; secrets: SecretRow[] }>(
      `${PAAS_BASE}/api/paas/clusters/${clusterId}/configs${nsQ(namespace)}`),
    retry: 0, refetchInterval: pollMs || false,
  });
}
