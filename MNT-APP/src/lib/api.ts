"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Flavor, MyProject, Org, ProvisionSpec, ProvisionStepsResp, ProvNetwork, SecurityGroup, SshKey, TemplateImage,
} from "@/lib/types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  dashboard: {
    summary: () =>
      useQuery({ queryKey: ["dashboard", "summary"], queryFn: () => get("/api/dashboard/summary") }),
    activities: () =>
      useQuery({ queryKey: ["dashboard", "activities"], queryFn: () => get("/api/dashboard/activities") }),
    alerts: () =>
      useQuery({ queryKey: ["dashboard", "alerts"], queryFn: () => get("/api/dashboard/alerts") }),
  },
  accelerators: {
    list: (q?: Record<string, string>) => {
      const search = q ? "?" + new URLSearchParams(q).toString() : "";
      return useQuery({
        queryKey: ["accelerators", q],
        queryFn: () => get(`/api/accelerators${search}`),
      });
    },
    topology: () =>
      useQuery({ queryKey: ["accelerators", "topology"], queryFn: () => get("/api/accelerators/topology") }),
  },
  // 자원 신청(티켓) — VM·서비스 클러스터 공통
  ticket: {
    requests: (q?: Record<string, string>) => {
      const search = q ? "?" + new URLSearchParams(q).toString() : "";
      return useQuery({
        queryKey: ["ticket", "requests", q],
        queryFn: () => get<{ items: { status: string }[] }>(`/api/ticket/requests${search}`),
        // 승인·생성 중인 티켓이 있으면 상태가 바뀔 때까지 2초마다 다시 조회
        refetchInterval: (query) =>
          query.state.data?.items.some((r) => r.status === "approved" || r.status === "provisioning") ? 2000 : false,
      });
    },
    reviewRequest: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, ...body }: {
          id: string;
          action: "approve" | "reject";
          reason?: string;
          provisionSpec?: ProvisionSpec;
          reviewedBy?: string;
          reviewedByName?: string;
        }) => patch(`/api/ticket/requests/${id}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket"] }),
      });
    },
    // 프로비저닝 진행 단계 — 진행 중이면 폴링
    steps: (id: string | undefined) =>
      useQuery({
        queryKey: ["ticket", "steps", id],
        queryFn: () => get<ProvisionStepsResp>(`/api/ticket/requests/${id}/steps`),
        enabled: !!id,
        refetchInterval: (q) => {
          const st = q.state.data?.status;
          return st === "approved" || st === "provisioning" ? 1000 : false;
        },
      }),
    retry: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => post(`/api/ticket/requests/${id}/retry`, {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket"] }),
      });
    },
    // 신청 마법사 · 승인 폼 조회
    myProjects: (userId: string) =>
      useQuery({
        queryKey: ["ticket", "my-projects", userId],
        queryFn: () => get<{ items: MyProject[] }>(`/api/core/users/${userId}/projects`),
        enabled: !!userId,
      }),
    // VM 이름 중복 확인 (같은 프로젝트)
    vmNameCheck: (projectId: string, name: string, enabled: boolean) =>
      useQuery({
        queryKey: ["ticket", "vm-name-check", projectId, name],
        queryFn: () =>
          get<{ available: boolean; reason: string | null }>(
            `/api/ticket/vm-name-check?${new URLSearchParams({ projectId, name })}`,
          ),
        enabled,
      }),
    orgs: () => useQuery({ queryKey: ["core", "orgs"], queryFn: () => get<{ items: Org[] }>("/api/core/orgs") }),
    createRequest: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (payload: Record<string, unknown>) => post(`/api/ticket/requests`, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", "requests"] }),
      });
    },
  },
  iaas: {
    pools: () => useQuery({ queryKey: ["iaas", "pools"], queryFn: () => get("/api/iaas/pools") }),
    projects: () => useQuery({ queryKey: ["iaas", "projects"], queryFn: () => get("/api/iaas/projects") }),
    instances: (q?: Record<string, string>) => {
      const search = q ? "?" + new URLSearchParams(q).toString() : "";
      return useQuery({
        queryKey: ["iaas", "instances", q],
        queryFn: () => get(`/api/iaas/instances${search}`),
      });
    },
    volumes: () => useQuery({ queryKey: ["iaas", "volumes"], queryFn: () => get("/api/iaas/volumes") }),
    images: () => useQuery({ queryKey: ["iaas", "images"], queryFn: () => get("/api/iaas/images") }),
    networks: () => useQuery({ queryKey: ["iaas", "networks"], queryFn: () => get("/api/iaas/networks") }),
    centers: () => useQuery({ queryKey: ["iaas", "centers"], queryFn: () => get("/api/iaas/centers") }),
    zones: () => useQuery({ queryKey: ["iaas", "zones"], queryFn: () => get("/api/iaas/zones") }),
    flavors: () => useQuery({ queryKey: ["iaas", "flavors"], queryFn: () => get<{ items: Flavor[] }>("/api/iaas/flavors") }),
    templateImages: () =>
      useQuery({ queryKey: ["iaas", "template-images"], queryFn: () => get<{ items: TemplateImage[] }>("/api/iaas/template-images") }),
    // 신청자 조직의 키페어
    orgKeypairs: (userId: string | undefined) =>
      useQuery({
        queryKey: ["iaas", "keypairs", userId],
        queryFn: () => get<{ items: SshKey[] }>(`/api/iaas/keypairs?userId=${userId}`),
        enabled: !!userId,
      }),
    projectNetworks: (projectId: string | undefined) =>
      useQuery({
        queryKey: ["iaas", "project-networks", projectId],
        queryFn: () => get<{ items: ProvNetwork[] }>(`/api/iaas/projects/${projectId}/networks`),
        enabled: !!projectId,
      }),
    // Static IP 사용 여부 (Neutron 포트 조회)
    ipCheck: (networkId: string, ip: string, enabled: boolean) =>
      useQuery({
        queryKey: ["iaas", "ip-check", networkId, ip],
        queryFn: () =>
          get<{ available: boolean; reason: string | null }>(
            `/api/iaas/networks/${networkId}/ip-check?${new URLSearchParams({ ip })}`,
          ),
        enabled,
      }),
    projectSecurityGroups: (projectId: string | undefined) =>
      useQuery({
        queryKey: ["iaas", "project-sgs", projectId],
        queryFn: () => get<{ items: SecurityGroup[] }>(`/api/iaas/projects/${projectId}/security-groups`),
        enabled: !!projectId,
      }),
  },
  paas: {
    clusters: () => useQuery({ queryKey: ["paas", "clusters"], queryFn: () => get("/api/paas/clusters") }),
    workloads: (q?: Record<string, string>) => {
      const search = q ? "?" + new URLSearchParams(q).toString() : "";
      return useQuery({
        queryKey: ["paas", "workloads", q],
        queryFn: () => get(`/api/paas/workloads${search}`),
      });
    },
    services: () => useQuery({ queryKey: ["paas", "services"], queryFn: () => get("/api/paas/services") }),
  },
  kubeflow: {
    notebooks: () => useQuery({ queryKey: ["kf", "notebooks"], queryFn: () => get("/api/kubeflow/notebooks") }),
    pipelines: () => useQuery({ queryKey: ["kf", "pipelines"], queryFn: () => get("/api/kubeflow/pipelines") }),
    experiments: () => useQuery({ queryKey: ["kf", "experiments"], queryFn: () => get("/api/kubeflow/experiments") }),
    serving: () => useQuery({ queryKey: ["kf", "serving"], queryFn: () => get("/api/kubeflow/serving") }),
  },
  resourceMap: {
    graph: () => useQuery({ queryKey: ["rm", "graph"], queryFn: () => get("/api/resource-map") }),
    partitions: () => useQuery({ queryKey: ["rm", "partitions"], queryFn: () => get("/api/partitions") }),
    mgmtClusters: () => useQuery({ queryKey: ["rm", "mgmt"], queryFn: () => get("/api/clusters/management") }),
    serviceClusters: () => useQuery({ queryKey: ["rm", "svc"], queryFn: () => get("/api/clusters/service") }),
    passthroughs: () => useQuery({ queryKey: ["rm", "pt"], queryFn: () => get("/api/passthroughs") }),
  },
  infra: {
    servers: () => useQuery({ queryKey: ["infra", "servers"], queryFn: () => get("/api/infrastructure/servers") }),
    server: (id: string) => useQuery({ queryKey: ["infra", "server", id], queryFn: () => get(`/api/infrastructure/servers/${id}`) }),
    vmDetail: (id: string) => useQuery({ queryKey: ["iaas", "instance", id], queryFn: () => get(`/api/iaas/instances/${id}`) }),
    acceleratorDetail: (id: string) => useQuery({ queryKey: ["acc", "detail", id], queryFn: () => get(`/api/accelerators/${id}/detail`) }),
    workloadDetail: (id: string) => useQuery({ queryKey: ["wl", "detail", id], queryFn: () => get(`/api/paas/workloads/${id}`) }),
    topology: () => useQuery({ queryKey: ["topology"], queryFn: () => get("/api/topology") }),
  },
};
