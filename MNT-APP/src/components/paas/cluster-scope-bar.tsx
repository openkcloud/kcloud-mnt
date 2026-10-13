"use client";
/**
 * 서비스 클러스터 스코프 바 — 워크로드·서비스·스토리지·설정 공용.
 * K8s 리소스는 "어느 클러스터를 볼지"가 선행되므로, 선택을 전역(persist)으로 공유한다.
 * 클러스터가 준비(*_COMPLETE + api_address)된 것만 선택지로 노출.
 */
import * as React from "react";
import { Boxes } from "lucide-react";
import type { QueryKey } from "@tanstack/react-query";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshControls } from "@/components/iaas/refresh-controls";
import { useClusters, usePaasCluster, useNamespaces } from "@/lib/paas-api";

export function useClusterScope() {
  const clusterId = usePaasCluster((s) => s.clusterId);
  const setClusterId = usePaasCluster((s) => s.setClusterId);
  const clusters = useClusters();
  const ready = React.useMemo(
    () => (clusters.data ?? []).filter((c) => c.status.endsWith("_COMPLETE") && !!c.apiAddress),
    [clusters.data],
  );
  // 선택이 없거나(최초) 더는 존재하지 않으면 첫 클러스터 자동 선택
  React.useEffect(() => {
    if (ready.length && !ready.some((c) => c.id === clusterId)) setClusterId(ready[0].id);
  }, [ready, clusterId, setClusterId]);
  return { clusterId, setClusterId, clusters: ready, isLoading: clusters.isLoading };
}

export function ClusterScopeBar({
  queryKeys, namespace, onNamespaceChange,
}: {
  queryKeys: QueryKey[];
  namespace?: string;
  onNamespaceChange?: (ns: string) => void;
}) {
  const { clusterId, setClusterId, clusters, isLoading } = useClusterScope();
  const namespaces = useNamespaces(clusterId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Boxes className="size-4 text-brand-indigo-700" />
      <Select value={clusterId || undefined} onValueChange={setClusterId}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder={isLoading ? "클러스터 불러오는 중…" : "서비스 클러스터 선택"} />
        </SelectTrigger>
        <SelectContent>
          {clusters.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onNamespaceChange && (
        <Select value={namespace ?? "all"} onValueChange={onNamespaceChange}>
          <SelectTrigger className="w-[180px] font-mono text-xs">
            <SelectValue placeholder="네임스페이스" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 네임스페이스</SelectItem>
            {(namespaces.data ?? []).map((ns) => (
              <SelectItem key={ns} value={ns} className="font-mono text-xs">{ns}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="ml-auto">
        <RefreshControls queryKeys={queryKeys} />
      </div>
    </div>
  );
}
