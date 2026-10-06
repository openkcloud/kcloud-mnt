"use client";
/**
 * MNT-IAAS 연동 — IaaS 자원(OpenStack)은 전부 MNT-IAAS 모듈을 통해 가져온다.
 *
 * 주소(NEXT_PUBLIC_IAAS_API):
 *   - 미설정        → http://localhost:8001 (로컬 dev, MNT-IAAS 직접 — CORS 허용됨)
 *   - ""(빈값)      → same-origin (게이트웨이가 /api/iaas 라우팅하는 운영 구성)
 *   - "http://..."  → 고정 주소
 *
 * 실패 시 MSW 목업(/api/iaas/*)으로 폴백 — 백엔드 없이도 목업 동작 유지.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IaasNetwork, Tenant } from "@/lib/types";

const RAW = process.env.NEXT_PUBLIC_IAAS_API;
export const IAAS_BASE = RAW === undefined ? "http://localhost:8001" : RAW;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function sendJson<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); if (j.detail) msg = j.detail; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T; // No Content (삭제)
  return (await res.json()) as T;
}

const postJson = <T>(url: string, body: unknown) => sendJson<T>("POST", url, body);

export interface CreateProjectInput {
  name: string;
  description?: string;
  quotaVcpu?: number;
  quotaRamGb?: number;
  quotaDiskGb?: number;
  quotaAcc?: number; // 비활성(-1) — OpenStack 미지원, 포털 DB 관리 예정
}

/** 프로젝트 생성 — MNT-IAAS가 Keystone 생성 + Nova/Cinder 쿼터 설정. */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      postJson<Tenant>(`${IAAS_BASE}/api/iaas/projects`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-projects"] }),
  });
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  quotaVcpu?: number;
  quotaRamGb?: number;
  quotaDiskGb?: number;
}

/** 프로젝트 수정 — Keystone 메타(이름·설명·활성) + Nova/Cinder 쿼터. */
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) =>
      sendJson<Tenant>("PATCH", `${IAAS_BASE}/api/iaas/projects/${id}`, input),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["iaas-projects"] });
      qc.invalidateQueries({ queryKey: ["iaas-project", id] });
    },
  });
}

/** 프로젝트 삭제 — Keystone 프로젝트 삭제(자원 사전 정리 전제). */
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-projects"] }),
  });
}

/** 프로젝트 목록(경량, 쿼터 미포함) — MNT-IAAS 우선, 실패 시 MSW 목업 폴백.
 *  쿼터는 N+1 방지를 위해 목록에 넣지 않고, 상세(useProject)에서 on-demand 조회한다. */
export function useProjects() {
  return useQuery({
    queryKey: ["iaas-projects"],
    queryFn: async (): Promise<{ items: Tenant[]; live: boolean }> => {
      try {
        const d = await fetchJson<{ items: Tenant[] }>(`${IAAS_BASE}/api/iaas/projects`);
        return { items: d.items, live: true };
      } catch {
        const d = await fetchJson<{ items: Tenant[] }>(`/api/iaas/projects`);
        return { items: d.items, live: false };
      }
    },
    staleTime: 30 * 1000,
    retry: 0,
  });
}

/** 단일 프로젝트 상세(+쿼터) — 신청 화면 등에서 특정 프로젝트 남은 쿼터 표시용. */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["iaas-project", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Tenant> =>
      fetchJson<Tenant>(`${IAAS_BASE}/api/iaas/projects/${projectId}`),
    staleTime: 30 * 1000,
    retry: 0,
  });
}

/** 남은 쿼터 = 한도 - 사용량 (음수 방지). 신청 화면에서 "남은 양" 표시 공통 유틸. */
export function remaining(quota: number, used: number): number {
  return Math.max(0, (quota ?? 0) - (used ?? 0));
}

// ────── 네트워크(Neutron, 읽기 전용) ──────
export interface NetworkDetail {
  id: string;
  name: string;
  tenantId: string;
  type: "tenant" | "external" | "shared";
  vlan: number | null;
  status: string;
  subnets: { id: string; name: string; cidr: string; gateway: string; dhcp: boolean; dns: string[]; allocationPool: string }[];
  ports: { id: string; name: string; status: string; mac: string; ip: string; deviceOwner: string; vm: string | null }[];
  securityGroups: { id: string; name: string; rules: number; desc: string }[];
  routers: { id: string; name: string; status: string; gatewayIp: string; routes: number; ha: boolean }[];
  floatingIps: { id: string; ip: string; portId: string | null; mappedTo: string; status: string }[];
  quotas: {
    ports: { used: number; max: number };
    floatingIps: { used: number; max: number };
    subnets: { used: number; max: number };
  };
}

/** 네트워크 목록(요약) — MNT-IAAS(Neutron) 우선, 실패 시 MSW 목업 폴백. */
export function useNetworks() {
  return useQuery({
    queryKey: ["iaas-networks"],
    queryFn: async (): Promise<{ items: IaasNetwork[]; live: boolean }> => {
      try {
        const d = await fetchJson<{ items: IaasNetwork[] }>(`${IAAS_BASE}/api/iaas/networks`);
        return { items: d.items, live: true };
      } catch {
        const d = await fetchJson<{ items: IaasNetwork[] }>(`/api/iaas/networks`);
        return { items: d.items, live: false };
      }
    },
    staleTime: 30 * 1000,
    retry: 0,
  });
}

export interface CreateNetworkInput {
  name: string;
  projectId: string;
  cidr: string;
  subnetName?: string;
  gatewayIp?: string;
  enableDhcp?: boolean;
  dnsNameservers?: string[];
  shared?: boolean;
}

/** 네트워크+서브넷 생성 — MNT-IAAS(Neutron). 성공 시 목록 갱신. */
export function useCreateNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNetworkInput) =>
      postJson<NetworkDetail>(`${IAAS_BASE}/api/iaas/networks`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-networks"] }),
  });
}

/** 단일 네트워크 상세(+서브넷·포트·SG·라우터·FIP·쿼터) — 상세 패널 열 때 on-demand. */
export function useNetwork(networkId: string | undefined) {
  return useQuery({
    queryKey: ["iaas-network", networkId],
    enabled: !!networkId,
    queryFn: async (): Promise<NetworkDetail> =>
      fetchJson<NetworkDetail>(`${IAAS_BASE}/api/iaas/networks/${networkId}`),
    staleTime: 30 * 1000,
    retry: 0,
  });
}

// ────── Floating IP (확보/연결/해제/반납) ──────
export interface FipTarget { portId: string; ip: string; networkName: string; vm: string | null }

/** 공인 IP 연결 대상(프로젝트 compute 포트) 조회. */
export function useFipTargets(projectId: string | undefined) {
  return useQuery({
    queryKey: ["iaas-fip-targets", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<FipTarget[]> =>
      (await fetchJson<{ items: FipTarget[] }>(`${IAAS_BASE}/api/iaas/projects/${projectId}/fip-targets`)).items,
    staleTime: 15 * 1000,
    retry: 0,
  });
}

/** FIP 변경 후 네트워크 상세·목록 캐시 무효화 공통 훅 팩토리. */
function useFipMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iaas-network"] });
      qc.invalidateQueries({ queryKey: ["iaas-networks"] });
    },
  });
}

/** 공인 IP 확보(allocate). */
export function useAllocateFip() {
  return useFipMutation((projectId: string) =>
    sendJson("POST", `${IAAS_BASE}/api/iaas/floatingips`, { projectId }));
}

/** 공인 IP 반납(release). */
export function useReleaseFip() {
  return useFipMutation((fipId: string) =>
    sendJson("DELETE", `${IAAS_BASE}/api/iaas/floatingips/${fipId}`));
}

/** 공인 IP 연결/해제 — portId 지정=연결, null=해제. */
export function useUpdateFip() {
  return useFipMutation(({ fipId, portId }: { fipId: string; portId: string | null }) =>
    sendJson("PUT", `${IAAS_BASE}/api/iaas/floatingips/${fipId}`, { portId }));
}

// ────── 서브넷 추가 / 네트워크 삭제 ──────
export interface AddSubnetInput {
  name?: string;
  cidr: string;
  gatewayIp?: string;
  enableDhcp?: boolean;
  dnsNameservers?: string[];
}

/** 기존 네트워크에 서브넷 추가. */
export function useAddSubnet(networkId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddSubnetInput) =>
      postJson<NetworkDetail>(`${IAAS_BASE}/api/iaas/networks/${networkId}/subnets`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iaas-network", networkId] });
      qc.invalidateQueries({ queryKey: ["iaas-networks"] });
    },
  });
}

/** 네트워크 삭제. */
export function useDeleteNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/networks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-networks"] }),
  });
}

// ────── 보안 그룹 규칙 편집 ──────
export interface SgRule {
  id: string;
  direction: string;
  ethertype: string;
  protocol: string | null;
  portMin: number | null;
  portMax: number | null;
  remoteCidr: string | null;
  remoteGroup: string | null;
}
export interface SecurityGroupDetail { id: string; name: string; desc: string; rules: SgRule[] }
export interface AddSgRuleInput {
  direction: string;
  ethertype?: string;
  protocol?: string | null;
  portMin?: number | null;
  portMax?: number | null;
  remoteCidr?: string | null;
}

/** 보안 그룹 + 규칙 상세. */
export function useSecurityGroup(sgId: string | undefined) {
  return useQuery({
    queryKey: ["iaas-sg", sgId],
    enabled: !!sgId,
    queryFn: async (): Promise<SecurityGroupDetail> =>
      fetchJson<SecurityGroupDetail>(`${IAAS_BASE}/api/iaas/security-groups/${sgId}`),
    staleTime: 15 * 1000,
    retry: 0,
  });
}

/** 보안 그룹 규칙 추가. */
export function useAddSgRule(sgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddSgRuleInput) =>
      postJson<SecurityGroupDetail>(`${IAAS_BASE}/api/iaas/security-groups/${sgId}/rules`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iaas-sg", sgId] });
      qc.invalidateQueries({ queryKey: ["iaas-network"] });
    },
  });
}

/** 보안 그룹 규칙 삭제. */
export function useDeleteSgRule(sgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/security-group-rules/${ruleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iaas-sg", sgId] });
      qc.invalidateQueries({ queryKey: ["iaas-network"] });
    },
  });
}

// ────── 보안 그룹 목록/생성/삭제 ──────
export interface SgSummary { id: string; name: string; tenantId: string; desc: string; rules: number }

export function useSecurityGroups() {
  return useQuery({
    queryKey: ["iaas-sgs"],
    queryFn: async (): Promise<SgSummary[]> =>
      (await fetchJson<{ items: SgSummary[] }>(`${IAAS_BASE}/api/iaas/security-groups`)).items,
    staleTime: 30 * 1000,
    retry: 0,
  });
}

export function useCreateSecurityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; projectId: string; description?: string }) =>
      postJson<SecurityGroupDetail>(`${IAAS_BASE}/api/iaas/security-groups`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-sgs"] }),
  });
}

export function useDeleteSecurityGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/security-groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-sgs"] }),
  });
}

// ────── 라우터 (L3) ──────
export interface RouterSummary {
  id: string; name: string; tenantId: string; status: string; adminStateUp: boolean;
  externalNetwork: string; externalIp: string; interfaces: number; ha: boolean; routes: number;
}
export interface RouterInterface { portId: string; subnetId: string; subnetName: string; cidr: string; ip: string }
export interface RouterDetail {
  id: string; name: string; tenantId: string; status: string; adminStateUp: boolean;
  externalNetwork: string; externalIp: string; ha: boolean;
  interfaces: RouterInterface[];
  routes: { destination: string; nexthop: string }[];
}
export interface ProjectSubnet { id: string; name: string; cidr: string; networkName: string }

export function useRouters() {
  return useQuery({
    queryKey: ["iaas-routers"],
    queryFn: async (): Promise<RouterSummary[]> =>
      (await fetchJson<{ items: RouterSummary[] }>(`${IAAS_BASE}/api/iaas/routers`)).items,
    staleTime: 30 * 1000,
    retry: 0,
  });
}

export function useRouter(routerId: string | undefined) {
  return useQuery({
    queryKey: ["iaas-router", routerId],
    enabled: !!routerId,
    queryFn: async (): Promise<RouterDetail> =>
      fetchJson<RouterDetail>(`${IAAS_BASE}/api/iaas/routers/${routerId}`),
    staleTime: 15 * 1000,
    retry: 0,
  });
}

export function useProjectSubnets(projectId: string | undefined) {
  return useQuery({
    queryKey: ["iaas-project-subnets", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectSubnet[]> =>
      (await fetchJson<{ items: ProjectSubnet[] }>(`${IAAS_BASE}/api/iaas/projects/${projectId}/subnets`)).items,
    staleTime: 15 * 1000,
    retry: 0,
  });
}

export function useCreateRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; projectId: string; externalNetworkId?: string }) =>
      postJson<RouterDetail>(`${IAAS_BASE}/api/iaas/routers`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-routers"] }),
  });
}

export function useDeleteRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/routers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iaas-routers"] }),
  });
}

/** 라우터 인터페이스 연결/해제 — add=true 연결, false 해제. */
export function useRouterInterface(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subnetId, add }: { subnetId: string; add: boolean }) =>
      sendJson<RouterDetail>("PUT", `${IAAS_BASE}/api/iaas/routers/${routerId}/${add ? "add" : "remove"}-interface`, { subnetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iaas-router", routerId] });
      qc.invalidateQueries({ queryKey: ["iaas-routers"] });
    },
  });
}

// ────── 볼륨·스토리지 (Cinder, 백엔드 Ceph) ──────
export interface VolumeAttachment { serverId: string | null; device: string | null }
export interface VolumeSummary {
  id: string; name: string; tenantId: string; size: number; type: string;
  status: string; bootable: boolean; attachments: VolumeAttachment[]; description: string; createdAt: string;
}
export interface VolumeSnapshot { id: string; name: string; size: number; status: string; createdAt: string }
export interface VolumeDetail extends VolumeSummary { snapshots: VolumeSnapshot[] }
export interface StoragePool { name: string; backend: string; protocol: string; totalGb: number; freeGb: number }
export interface VolumeTypeOpt { id: string; name: string }

// Cinder 전이(진행 중) 상태 — 이 상태가 하나라도 있으면 자동 폴링, 안정되면 중단.
const VOLUME_SETTLED = new Set(["available", "in-use", "error", "error_deleting", "error_extending", "error_restoring"]);
const isTransitional = (status: string) => !VOLUME_SETTLED.has(status);

export function useVolumes() {
  return useQuery({
    queryKey: ["iaas-volumes"],
    queryFn: async (): Promise<VolumeSummary[]> =>
      (await fetchJson<{ items: VolumeSummary[] }>(`${IAAS_BASE}/api/iaas/volumes`)).items,
    staleTime: 30 * 1000, retry: 0,
    // creating/deleting/extending 등 진행 중 볼륨이 있으면 3초마다 갱신
    refetchInterval: (q) => ((q.state.data as VolumeSummary[] | undefined)?.some((v) => isTransitional(v.status)) ? 3000 : false),
  });
}
export function useVolume(id: string | undefined) {
  return useQuery({
    queryKey: ["iaas-volume", id],
    enabled: !!id,
    queryFn: async (): Promise<VolumeDetail> => fetchJson<VolumeDetail>(`${IAAS_BASE}/api/iaas/volumes/${id}`),
    staleTime: 15 * 1000, retry: 0,
    // 볼륨 또는 스냅샷이 진행 중이면 폴링
    refetchInterval: (q) => {
      const d = q.state.data as VolumeDetail | undefined;
      if (!d) return false;
      const pending = isTransitional(d.status) || d.snapshots.some((s) => isTransitional(s.status));
      return pending ? 3000 : false;
    },
  });
}
export function useVolumeTypes() {
  return useQuery({
    queryKey: ["iaas-volume-types"],
    queryFn: async (): Promise<VolumeTypeOpt[]> =>
      (await fetchJson<{ items: VolumeTypeOpt[] }>(`${IAAS_BASE}/api/iaas/volume-types`)).items,
    staleTime: 5 * 60 * 1000, retry: 0,
  });
}
export function useStorageCapacity() {
  return useQuery({
    queryKey: ["iaas-storage-capacity"],
    queryFn: async (): Promise<StoragePool[]> =>
      (await fetchJson<{ items: StoragePool[] }>(`${IAAS_BASE}/api/iaas/storage-capacity`)).items,
    staleTime: 60 * 1000, retry: 0,
  });
}

function useVolumeMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation<R, Error, V>({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iaas-volumes"] });
      qc.invalidateQueries({ queryKey: ["iaas-volume"] });
      qc.invalidateQueries({ queryKey: ["iaas-storage-capacity"] });
    },
  });
}

export interface CreateVolumeInput {
  name: string; size: number; projectId: string; volumeType?: string; description?: string; imageRef?: string; snapshotId?: string;
}
export function useCreateVolume() {
  return useVolumeMutation((input: CreateVolumeInput) =>
    postJson<VolumeSummary>(`${IAAS_BASE}/api/iaas/volumes`, input));
}
export function useDeleteVolume() {
  return useVolumeMutation(({ id, cascade }: { id: string; cascade?: boolean }) =>
    sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/volumes/${id}${cascade ? "?cascade=true" : ""}`));
}
export function useExtendVolume() {
  return useVolumeMutation(({ id, newSize }: { id: string; newSize: number }) =>
    sendJson<VolumeDetail>("POST", `${IAAS_BASE}/api/iaas/volumes/${id}/extend`, { newSize }));
}
export function useCreateSnapshot() {
  return useVolumeMutation((input: { volumeId: string; name: string; force?: boolean }) =>
    postJson(`${IAAS_BASE}/api/iaas/snapshots`, input));
}
export function useDeleteSnapshot() {
  return useVolumeMutation((id: string) => sendJson<void>("DELETE", `${IAAS_BASE}/api/iaas/snapshots/${id}`));
}
