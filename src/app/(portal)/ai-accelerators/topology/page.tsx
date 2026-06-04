"use client";
import * as React from "react";
import { Cpu, Server, Building2, Layers } from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatWatts } from "@/lib/utils";
import type { Accelerator, Center, Node, Pool, Zone } from "@/lib/types";

type TopologyResponse = {
  centers: Center[];
  zones: Zone[];
  pools: Pool[];
  nodes: (Node & { accelerators: Accelerator[] })[];
};

export default function TopologyPage() {
  const { data, isLoading } = api.accelerators.topology() as {
    data: TopologyResponse | undefined;
    isLoading: boolean;
  };

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>물리 인프라 토폴로지</CardTitle>
        <CardDescription>
          센터 → 존 → 자원풀 → 노드 → AI반도체 계층구조
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.centers.map((center) => (
            <div key={center.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-md bg-brand-indigo-100 text-brand-indigo-700">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <div className="font-semibold">{center.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {center.location} · 코드 {center.code}
                  </div>
                </div>
              </div>
              <div className="ml-4 space-y-3 border-l-2 border-dashed border-border pl-6">
                {data.zones
                  .filter((z) => z.centerId === center.id)
                  .map((zone) => (
                    <div key={zone.id} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                          <Layers className="size-3.5" />
                        </div>
                        <span className="text-sm font-medium">{zone.name}</span>
                        <Badge variant="outline" className="text-[10px]">{zone.code}</Badge>
                      </div>
                      <div className="ml-4 space-y-2 border-l-2 border-dashed border-border pl-6">
                        {data.pools
                          .filter((p) => p.zoneId === zone.id)
                          .map((pool) => (
                            <div key={pool.id} className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div
                                  className={cn(
                                    "flex size-6 items-center justify-center rounded-md",
                                    pool.type === "OpenStack" && "bg-red-100 text-red-700",
                                    pool.type === "OpenShift" && "bg-rose-100 text-rose-700",
                                  )}
                                >
                                  <Server className="size-3" />
                                </div>
                                <span className="text-sm font-medium">{pool.name}</span>
                                <Badge variant="outline" className="text-[10px]">{pool.type}</Badge>
                                <Badge
                                  variant={pool.status === "정상" ? "success" : pool.status === "주의" ? "warning" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {pool.status}
                                </Badge>
                                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                                  {pool.endpoint}
                                </span>
                              </div>
                              <div className="ml-4 flex flex-wrap gap-2">
                                {data.nodes
                                  .filter((n) => n.poolId === pool.id)
                                  .map((node) => (
                                    <div
                                      key={node.id}
                                      className="rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-md"
                                      style={{ minWidth: 240 }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <div className="size-1.5 rounded-full bg-brand-mint-500" />
                                          <span className="font-mono text-xs font-medium">
                                            {node.hostname}
                                          </span>
                                        </div>
                                        <Badge variant="ghost" className="text-[10px]">
                                          {node.status}
                                        </Badge>
                                      </div>
                                      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                                        <div>
                                          vCPU <span className="font-mono text-foreground">{node.vcpu}</span>
                                        </div>
                                        <div>
                                          RAM <span className="font-mono text-foreground">{node.ramGb}GB</span>
                                        </div>
                                        <div>
                                          전력 <span className="font-mono text-foreground">{formatWatts(node.powerW)}</span>
                                        </div>
                                      </div>
                                      {node.accelerators.length > 0 && (
                                        <>
                                          <div className="mt-2.5 border-t border-border pt-2">
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                              AI반도체 ({node.accelerators.length}장)
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                              {node.accelerators.map((a) => (
                                                <div
                                                  key={a.id}
                                                  className={cn(
                                                    "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]",
                                                    a.kind === "GPU" && "bg-brand-indigo-100 text-brand-indigo-800",
                                                    a.kind === "NPU" && "bg-brand-mint-50 text-brand-mint-700",
                                                    a.kind === "PIM" && "bg-violet-100 text-violet-700",
                                                  )}
                                                  title={`${a.name} · ${a.utilization}%`}
                                                >
                                                  <Cpu className="size-2.5" />
                                                  <span className="font-mono">{a.kind}</span>
                                                  <span className="font-mono tabular-nums">
                                                    {a.utilization}%
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
