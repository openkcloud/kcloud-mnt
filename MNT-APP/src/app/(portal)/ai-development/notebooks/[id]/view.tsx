"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Code2,
  Cpu,
  HardDrive,
  ChevronLeft,
  Square,
  RefreshCw,
  FileCode,
  Folder,
  TerminalSquare,
  Activity,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { relativeTime } from "@/lib/utils";
import type { KFNotebook } from "@/lib/types";

const FILES = [
  { name: "train.py", size: "12.4 KB", modified: "2026-05-31T14:22" },
  { name: "data_loader.py", size: "4.8 KB", modified: "2026-05-30T19:15" },
  { name: "config.yaml", size: "1.2 KB", modified: "2026-05-29T11:42" },
  { name: "datasets/", size: "—", modified: "2026-05-22T09:18" },
  { name: "checkpoints/", size: "—", modified: "2026-05-31T13:50" },
  { name: "logs/", size: "—", modified: "2026-05-31T14:31" },
];

export default function NotebookDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = api.kubeflow.notebooks() as {
    data: { items: KFNotebook[] } | undefined;
    isLoading: boolean;
  };
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const nb = data.items.find((n) => n.id === params.id);
  if (!nb) return <div>찾을 수 없습니다.</div>;

  const series = Array.from({ length: 30 }, (_, i) => ({
    t: `${(14 - Math.floor(i / 6)).toString().padStart(2, "0")}:${(((30 - i) * 2) % 60).toString().padStart(2, "0")}`,
    gpu: 35 + Math.round(Math.sin(i / 3) * 25 + (i % 4) * 5),
    mem: 40 + Math.round(Math.cos(i / 4) * 18 + (i % 5) * 3),
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/ai-development/notebooks"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3" /> 노트북 목록
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-mint-50 text-brand-mint-700">
              <Code2 className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{nb.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{nb.namespace}</span>
                <span>·</span>
                <span>마지막 활동 {relativeTime(nb.lastActivity)}</span>
              </div>
            </div>
            <Badge variant="success" className="ml-2 gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-mint-500" />
              {nb.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="size-3.5" /> 재시작
          </Button>
          <Button variant="outline" size="sm">
            <Square className="size-3.5" /> 정지
          </Button>
          <Button size="sm" asChild>
            <Link href={`/notebooks/${nb.id}/ide`}>
              <TerminalSquare className="size-3.5" /> Code Server 열기
            </Link>
          </Button>
        </div>
      </div>

      {/* Resource panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>리소스 사용량 (실시간)</CardTitle>
            <CardDescription>
              마지막 60분간 가속기·메모리 사용률
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                gpu: { label: nb.acceleratorKind ?? "Accelerator", color: "var(--brand-mint-500)" },
                mem: { label: "Memory", color: "var(--brand-indigo-500)" },
              }}
              className="h-[200px] w-full"
            >
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-mint-500)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--brand-mint-500)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-indigo-500)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--brand-indigo-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <Area type="monotone" dataKey="gpu" stroke="var(--brand-mint-500)" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="mem" stroke="var(--brand-indigo-500)" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>스펙</CardTitle>
            <CardDescription>K8s Pod 명세</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Pair label="이미지" value={<span className="font-mono text-[11px]">{nb.image}</span>} />
            <Pair label="vCPU" value={`${nb.cpu} cores`} />
            <Pair label="메모리" value={`${nb.memGb} GiB`} />
            {nb.acceleratorCount > 0 && (
              <Pair
                label="가속기"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Cpu className="size-3" />
                    {nb.acceleratorKind} × {nb.acceleratorCount}
                  </span>
                }
              />
            )}
            <Pair label="볼륨" value={`${nb.storageGb} GiB · PVC`} />
            <Pair label="네임스페이스" value={<span className="font-mono">{nb.namespace}</span>} />
            <Pair label="생성" value={nb.createdAt} />
          </CardContent>
        </Card>
      </div>

      {/* Workspace + Logs */}
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">
            <Folder className="size-3.5" /> 워크스페이스
          </TabsTrigger>
          <TabsTrigger value="events">
            <Activity className="size-3.5" /> Pod 이벤트
          </TabsTrigger>
          <TabsTrigger value="env">
            <FileCode className="size-3.5" /> 환경 변수
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="size-4" />
                /home/kubeflow
              </CardTitle>
              <CardDescription>PVC 마운트 — {nb.storageGb} GiB</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {FILES.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/30">
                    {f.name.endsWith("/") ? (
                      <Folder className="size-4 text-brand-indigo-600" />
                    ) : (
                      <FileCode className="size-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 font-mono text-sm">{f.name}</span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{f.size}</span>
                    <span className="text-xs text-muted-foreground">
                      <Clock className="mr-1 inline size-3" />
                      {relativeTime(f.modified)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[
                  { ts: "14:22", type: "Normal", reason: "Started", msg: "Container code-server started" },
                  { ts: "14:21", type: "Normal", reason: "Pulled", msg: `Image ${nb.image} pulled successfully` },
                  { ts: "14:20", type: "Normal", reason: "Scheduled", msg: `Pod assigned to gpu-node-01` },
                  { ts: "14:19", type: "Normal", reason: "Created", msg: "Created PVC kf-nb-volume" },
                ].map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-2 font-mono text-xs">
                    <span className="text-muted-foreground tabular-nums">{e.ts}</span>
                    <Badge variant="ghost" className="text-[10px]">{e.type}</Badge>
                    <span className="font-medium">{e.reason}</span>
                    <span className="text-muted-foreground">{e.msg}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="env">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[
                  ["RBLN_DEVICE_COUNT", "1"],
                  ["KUBEFLOW_USER", "user@openkcloud.local"],
                  ["NB_NAMESPACE", nb.namespace],
                  ["HF_HUB_CACHE", "/home/kubeflow/.cache/huggingface"],
                  ["PYTHONUNBUFFERED", "1"],
                  ["NV_DRIVER_VERSION", "550.127.05"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-4 px-5 py-2 font-mono text-xs">
                    <span className="w-56 font-medium">{k}</span>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
