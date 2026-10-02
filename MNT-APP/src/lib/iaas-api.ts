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
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@/lib/types";

const RAW = process.env.NEXT_PUBLIC_IAAS_API;
export const IAAS_BASE = RAW === undefined ? "http://localhost:8001" : RAW;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
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
