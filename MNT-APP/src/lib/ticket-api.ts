"use client";
/**
 * 자원신청 티켓(VM) — MNT-CORE 연동(포털 DB). 사용자는 username 으로 식별.
 * 티켓 관련 호출은 MSW 목업으로 폴백하지 않는다 — 실패하면 오류를 보여준다(실제 티켓과 목업 데이터가 섞이지 않게).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coreFetch } from "@/lib/menu-api";
import type { Org, ResourceRequest } from "@/lib/types";

/** 신청할 수 있는 프로젝트 — 내가 owner·member 인 프로젝트(이름은 OpenStack 라이브). */
export interface TicketProject { id: string; name: string; role: string; orgId: string; orgName: string }
export function useTicketProjects(username: string | undefined) {
  return useQuery({
    queryKey: ["tickets", "projects", username],
    enabled: !!username,
    queryFn: async (): Promise<TicketProject[]> =>
      (await coreFetch<{ items: TicketProject[] }>(`/tickets/projects?username=${encodeURIComponent(username!)}`)).items,
    retry: 0,
  });
}

/** VM 이름 사용 가능 여부(같은 프로젝트의 기존 VM + 반려되지 않은 티켓). */
export function useVmNameCheck(projectId: string, name: string, enabled: boolean) {
  return useQuery({
    queryKey: ["tickets", "vm-name-check", projectId, name],
    enabled,
    queryFn: () =>
      coreFetch<{ available: boolean; reason: string | null }>(
        `/tickets/vm-name-check?${new URLSearchParams({ projectId, name })}`,
      ),
    retry: 1,
  });
}

/** 신청 목록 — filters: requestedBy(username)·status·type·orgId. requestedBy 가 없으면 전체(관리자).
 *  생성 중인 티켓이 있으면 상태가 바뀔 때까지 2초마다 다시 조회.
 *  (프로비저닝 연결 전에는 approved 가 끝나지 않으므로 provisioning 만 — 연결 시 approved 도 포함) */
export function useTickets(filters: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: ["tickets", "list", filters],
    enabled,
    queryFn: () => coreFetch<{ items: ResourceRequest[]; total: number }>(`/tickets?${new URLSearchParams(filters)}`),
    retry: 0,
    refetchInterval: (query) =>
      query.state.data?.items.some((r) => r.status === "provisioning") ? 2000 : false,
  });
}

/** 조직 목록 — 신청 관리(관리자) 조직 필터. */
export function useOrgs() {
  return useQuery({
    queryKey: ["tickets", "orgs"],
    queryFn: async (): Promise<Org[]> => (await coreFetch<{ items: Org[] }>(`/orgs`)).items,
    retry: 0,
  });
}

export interface ReviewTicketInput {
  id: string;
  action: "approve" | "reject";
  processedBy: string;     // 처리자 username (admin 역할)
  reason?: string;         // 반려 사유 (반려 시 필수)
  expectedStatus: string;  // 화면이 보고 있던 상태 — 그사이 바뀌었으면 서버가 409
}

/** 승인(대기 → 승인)·반려(대기·승인 → 반려) — 관리자. 승인 설정은 프로비저닝 단계에서 입력. */
export function useReviewTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ReviewTicketInput) =>
      coreFetch<ResourceRequest>(`/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
    // 실패(예: 다른 관리자가 먼저 처리 → 409)해도 목록을 다시 받아 최신 상태를 보여준다
    onSettled: () => qc.invalidateQueries({ queryKey: ["tickets", "list"] }),
  });
}

export interface CreateTicketInput {
  requestedBy: string;
  projectId: string;
  vmName: string;
  networkType: string;
  floatingIp: boolean;
  flavorId: string;
  imageId: string;
  volumeGb?: number;
  keypairId?: string;
}

/** VM 자원신청 — 서버가 멤버·이름·스펙·이미지·볼륨·키페어를 다시 확인한 뒤 저장. */
export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      coreFetch<ResourceRequest>(`/tickets`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets", "list"] }),
  });
}
