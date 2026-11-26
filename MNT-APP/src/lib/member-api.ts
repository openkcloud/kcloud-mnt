"use client";
/** 프로젝트 멤버 관리 — MNT-CORE 연동(포털 DB). OpenStack 멤버와 별개. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coreFetch } from "@/lib/menu-api";

export interface PortalUser { id: string; username: string; name: string; org: string; status: string }
export interface ProjectMember {
  userId: string; username: string; name: string; org: string; email: string | null; role: string; createdAt: string;
}

/** 포털 사용자 목록 — 멤버 추가 picker용. */
/** 포털 사용자 목록 — 관리자 전용 API(멤버 추가 후보). enabled 로 사용자 화면에서는 부르지 않는다. */
export function usePortalUsers(enabled = true) {
  return useQuery({
    queryKey: ["core-users"],
    enabled,
    queryFn: async (): Promise<PortalUser[]> => (await coreFetch<{ items: PortalUser[] }>(`/users`)).items,
    staleTime: 5 * 60 * 1000, retry: 0,
  });
}

/** 내가 멤버인 프로젝트 ID 집합 — 사용자 화면 스코프(프로젝트·VM·네트워크·볼륨 필터). 사용자는 서버가 토큰으로 정한다.
 *  username 은 캐시 구분·호출 여부(관리자는 undefined → 호출 안 함)용. */
export function useMyProjectIds(username: string | undefined) {
  return useQuery({
    queryKey: ["core-my-projects", username],
    enabled: !!username,
    queryFn: async (): Promise<Set<string>> =>
      new Set((await coreFetch<{ projectIds: string[] }>(`/my-projects`)).projectIds),
    staleTime: 60 * 1000, retry: 0,
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["core-members", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectMember[]> =>
      (await coreFetch<{ items: ProjectMember[] }>(`/projects/${projectId}/members`)).items,
    staleTime: 30 * 1000, retry: 0,
  });
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: number; role: string }) =>
      coreFetch(`/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core-members", projectId] }),
  });
}

export function useUpdateProjectMemberRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      coreFetch(`/projects/${projectId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core-members", projectId] }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      coreFetch<void>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["core-members", projectId] }),
  });
}
