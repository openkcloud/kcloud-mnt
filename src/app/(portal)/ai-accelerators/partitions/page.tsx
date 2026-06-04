"use client";
import * as React from "react";
import { Cpu, Box, Layers, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AcceleratorPartition, PartitionModel } from "@/lib/types";

type ListResponse = {
  observed_at: string;
  is_stale: boolean;
  items: AcceleratorPartition[];
  stats: { total: number; byModel: { model: string; count: number }[] };
};

export default function PartitionsPage() {
  const { data, isLoading } = api.resourceMap.partitions() as {
    data: ListResponse | undefined;
    isLoading: boolean;
  };
  const [model, setModel] = React.useState<"all" | PartitionModel>("all");
  const [q, setQ] = React.useState("");

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const items = data.items.filter(
    (p) =>
      (model === "all" || p.model === model) &&
      (!q || p.id.toLowerCase().includes(q.toLowerCase()) || p.profileName.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      {/* Spec banner */}
      <Card className="border-brand-mint-200 bg-gradient-to-br from-brand-mint-50/60 to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint-100 text-brand-mint-700">
            <Layers className="size-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              가속기 파티션 모니터링
              <Badge variant="ghost" className="font-mono text-[10px]">/clusters/{"{c}"}/nodes/{"{n}"}/accelerators/{"{id}"}/partitions</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              MIG / vGPU / mdev / NPU Slice를 벤더 중립으로 통합 관리합니다 — 이노그리드 KCloud Monitor v2 §5
              <span className="ml-1 text-[10px] font-mono">(v1의 /mig → v2 /partitions)</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Model summary chips */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.stats.byModel.map((m) => (
          <Card key={m.model} className="p-4">
            <div className="text-xs text-muted-foreground">{m.model.toUpperCase()}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{m.count}</div>
            <div className="text-[10px] text-muted-foreground">
              {m.model === "mig" && "NVIDIA Multi-Instance GPU"}
              {m.model === "vgpu" && "NVIDIA vGPU"}
              {m.model === "mdev" && "Mediated Device (vfio-mdev)"}
              {m.model === "npu-slice" && "NPU 논리 분할"}
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="파티션 ID·프로파일 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="파티션 모델" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 모델</SelectItem>
              <SelectItem value="mig">MIG</SelectItem>
              <SelectItem value="vgpu">vGPU</SelectItem>
              <SelectItem value="mdev">mdev</SelectItem>
              <SelectItem value="npu-slice">NPU Slice</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length}개 · observed_at <span className="font-mono">{data.observed_at}</span>
          </span>
        </div>
      </Card>

      {/* Partitions table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>파티션 ID</TableHead>
              <TableHead>부모 가속기</TableHead>
              <TableHead>모델</TableHead>
              <TableHead>프로파일</TableHead>
              <TableHead>메모리</TableHead>
              <TableHead>활용률</TableHead>
              <TableHead>전력</TableHead>
              <TableHead>워크로드 바인딩</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Box
                      className={cn(
                        "size-4",
                        p.model === "mig" && "text-brand-indigo-600",
                        p.model === "npu-slice" && "text-brand-mint-600",
                        p.model === "vgpu" && "text-violet-600",
                        p.model === "mdev" && "text-amber-600",
                      )}
                    />
                    <span className="font-mono text-xs">{p.id}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.acceleratorId}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[10px]">{p.model.toUpperCase()}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">{p.profileName}</TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {Math.round(p.memoryUsedMb / 1024)} / {Math.round(p.memoryTotalMb / 1024)} GB
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={p.utilizationPercent}
                      className="w-20"
                      indicatorClassName={p.utilizationPercent > 80 ? "bg-rose-500" : p.utilizationPercent > 50 ? "bg-amber-500" : "bg-brand-mint-500"}
                    />
                    <span className="font-mono text-xs tabular-nums">{p.utilizationPercent}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs tabular-nums">{p.powerWatts}W</span>
                    {p.powerEstimation === "proportional" && (
                      <Badge variant="ghost" className="text-[9px]" title="DCGM이 가속기 전체 전력만 측정 — 이용률 비례 추정">
                        est
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {p.workloadBinding ? (
                    <div className="space-y-0.5 text-xs">
                      <div className="font-mono">{p.workloadBinding.namespace}/{p.workloadBinding.podName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {p.workloadBinding.workloadType} · {p.workloadBinding.containerName}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="secondary">유휴</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
