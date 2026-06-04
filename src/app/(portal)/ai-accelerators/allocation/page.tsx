"use client";
import * as React from "react";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Layers, Server, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { Accelerator } from "@/lib/types";

type ListResponse = { items: Accelerator[]; total: number };

export default function AllocationPage() {
  const { data, isLoading } = api.accelerators.list() as {
    data: ListResponse | undefined;
    isLoading: boolean;
  };

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const items = data.items;

  // Group by tenant
  const byTenant = items.reduce<Record<string, Accelerator[]>>((acc, a) => {
    const t = a.allocatedToTenant ?? "(미할당)";
    (acc[t] ??= []).push(a);
    return acc;
  }, {});

  // Sharing mode distribution
  const sharingData = ["전용", "시간분할", "논리분할", "멀티플렉싱"].map((mode) => ({
    mode,
    count: items.filter((i) => i.sharing === mode).length,
  }));

  // Multiplexing distribution
  const muxData = ["1:1", "1:N", "N:1"].map((m) => ({
    mode: m,
    count: items.filter((i) => i.multiplexing === m).length,
  }));

  // By kind/vendor matrix
  const vendors = Array.from(new Set(items.map((i) => i.vendor)));
  const matrix = vendors.map((v) => ({
    vendor: v,
    GPU: items.filter((i) => i.vendor === v && i.kind === "GPU").length,
    NPU: items.filter((i) => i.vendor === v && i.kind === "NPU").length,
    PIM: items.filter((i) => i.vendor === v && i.kind === "PIM").length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" />
              공유 정책 분포
            </CardTitle>
            <CardDescription>전용 / 시간분할 / 논리분할 / 멀티플렉싱</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ count: { label: "장 수", color: "var(--brand-indigo-500)" } }}
              className="h-[180px] w-full"
            >
              <BarChart data={sharingData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mode" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--brand-indigo-500)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="size-4" />
              인스턴스:AI반도체 매핑
            </CardTitle>
            <CardDescription>SNR.PF.001 — 1:1 / 1:N / N:1 지원 검증</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ count: { label: "장 수", color: "var(--brand-mint-500)" } }}
              className="h-[180px] w-full"
            >
              <BarChart data={muxData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mode" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--brand-mint-500)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4" />
              벤더 × 유형 매트릭스
            </CardTitle>
            <CardDescription>이종 AI반도체 다양성 — UFR.SVC.001</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                GPU: { label: "GPU", color: "var(--brand-indigo-500)" },
                NPU: { label: "NPU", color: "var(--brand-mint-500)" },
                PIM: { label: "PIM", color: "var(--chart-3)" },
              }}
              className="h-[180px] w-full"
            >
              <BarChart data={matrix}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="vendor" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="GPU" stackId="a" fill="var(--brand-indigo-500)" />
                <Bar dataKey="NPU" stackId="a" fill="var(--brand-mint-500)" />
                <Bar dataKey="PIM" stackId="a" fill="var(--chart-3)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per tenant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> 테넌트별 AI반도체 할당
          </CardTitle>
          <CardDescription>
            테넌트가 점유한 AI반도체 자원과 평균 가동률
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(byTenant)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([tenant, accs]) => {
              const avgUtil =
                accs.reduce((s, a) => s + a.utilization, 0) / accs.length;
              return (
                <div key={tenant} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{tenant}</span>
                      <Badge variant="outline">{accs.length}장</Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      평균 가동률 {avgUtil.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {accs.map((a) => (
                      <div
                        key={a.id}
                        className="group relative flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px]"
                        title={`${a.name} · ${a.utilization}%`}
                      >
                        <div
                          className="size-1.5 rounded-full"
                          style={{
                            background:
                              a.kind === "GPU"
                                ? "var(--brand-indigo-500)"
                                : a.kind === "NPU"
                                  ? "var(--brand-mint-500)"
                                  : "var(--chart-3)",
                          }}
                        />
                        <span className="font-mono">{a.id}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono tabular-nums">{a.utilization}%</span>
                      </div>
                    ))}
                  </div>
                  <Progress value={avgUtil} indicatorClassName="bg-brand-indigo-500" />
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
