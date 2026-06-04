"use client";
import * as React from "react";
import Link from "next/link";
import {
  Cpu,
  Filter,
  Grid3x3,
  ListFilter,
  Thermometer,
  Zap,
  Activity,
  RefreshCw,
  Layers,
  TableIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatWatts } from "@/lib/utils";
import type { Accelerator } from "@/lib/types";

type ListResponse = {
  items: Accelerator[];
  total: number;
  meta: {
    byKind: { kind: string; count: number }[];
    byVendor: { vendor: string; count: number }[];
  };
};

export default function AcceleratorDevicesPage() {
  const [filters, setFilters] = React.useState({
    vendor: "all",
    kind: "all",
    status: "all",
    q: "",
  });
  const [view, setView] = React.useState<"card" | "table">("card");

  const cleanFilters: Record<string, string> = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v && v !== "all"),
  );
  const { data, isLoading } = api.accelerators.list(cleanFilters) as {
    data: ListResponse | undefined;
    isLoading: boolean;
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="size-4 text-muted-foreground" />
            <span className="font-medium">필터</span>
          </div>
          <Input
            placeholder="모델·이름 검색…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="w-56"
          />
          <Select value={filters.kind} onValueChange={(v) => setFilters({ ...filters, kind: v })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              <SelectItem value="GPU">GPU</SelectItem>
              <SelectItem value="NPU">NPU</SelectItem>
              <SelectItem value="PIM">PIM</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.vendor} onValueChange={(v) => setFilters({ ...filters, vendor: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="벤더" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 벤더</SelectItem>
              <SelectItem value="NVIDIA">NVIDIA</SelectItem>
              <SelectItem value="Furiosa">Furiosa</SelectItem>
              <SelectItem value="Rebellions">Rebellions</SelectItem>
              <SelectItem value="HyperAccel">HyperAccel</SelectItem>
              <SelectItem value="Samsung">Samsung</SelectItem>
              <SelectItem value="SK Hynix">SK Hynix</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="Healthy">Healthy</SelectItem>
              <SelectItem value="Allocated">Allocated</SelectItem>
              <SelectItem value="Idle">Idle</SelectItem>
              <SelectItem value="Error">Error</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              <Button
                variant={view === "card" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView("card")}
                className="size-7"
              >
                <Grid3x3 className="size-3.5" />
              </Button>
              <Button
                variant={view === "table" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView("table")}
                className="size-7"
              >
                <TableIcon className="size-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="size-3.5" /> 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary chips */}
      {data?.meta && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            총 <strong className="text-foreground">{data.total}</strong>장 ·
          </span>
          {data.meta.byKind.map((b) => (
            <Badge key={b.kind} variant="outline" className="font-mono text-[11px]">
              {b.kind} {b.count}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">|</span>
          {data.meta.byVendor.map((b) => (
            <Badge key={b.vendor} variant="ghost" className="text-[11px]">
              {b.vendor} <strong className="ml-0.5 text-foreground">{b.count}</strong>
            </Badge>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : view === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.items.map((acc) => (
            <AcceleratorCard key={acc.id} acc={acc} />
          ))}
        </div>
      ) : (
        <AcceleratorTable items={data?.items ?? []} />
      )}
    </div>
  );
}

function AcceleratorCard({ acc }: { acc: Accelerator }) {
  return (
    <Link href={`/ai-accelerators/devices/${acc.id}`}>
      <_AcceleratorCard acc={acc} />
    </Link>
  );
}

function _AcceleratorCard({ acc }: { acc: Accelerator }) {
  const statusColors: Record<Accelerator["status"], string> = {
    Healthy: "bg-brand-mint-50 text-brand-mint-700",
    Allocated: "bg-brand-indigo-100 text-brand-indigo-700",
    Idle: "bg-slate-100 text-slate-600",
    Error: "bg-red-100 text-red-700",
    Maintenance: "bg-amber-100 text-amber-700",
  };
  const kindColors: Record<Accelerator["kind"], string> = {
    GPU: "from-brand-indigo-500/20 to-brand-indigo-500/0",
    NPU: "from-brand-mint-500/20 to-brand-mint-500/0",
    PIM: "from-violet-500/20 to-violet-500/0",
  };
  const utilColor =
    acc.utilization > 80
      ? "bg-rose-500"
      : acc.utilization > 60
        ? "bg-amber-500"
        : "bg-brand-mint-500";
  const tempColor =
    acc.temperatureC > 75
      ? "text-rose-600"
      : acc.temperatureC > 65
        ? "text-amber-600"
        : "text-brand-mint-700";

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100",
          kindColors[acc.kind],
        )}
      />
      <CardContent className="relative space-y-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  acc.kind === "GPU" && "bg-brand-indigo-100 text-brand-indigo-700",
                  acc.kind === "NPU" && "bg-brand-mint-50 text-brand-mint-700",
                  acc.kind === "PIM" && "bg-violet-100 text-violet-700",
                )}
              >
                <Cpu className="size-5" />
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">{acc.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {acc.vendor} · {acc.kind}
                </div>
              </div>
            </div>
          </div>
          <Badge className={statusColors[acc.status]}>{acc.status}</Badge>
        </div>

        {/* Memory + ID */}
        <div className="flex items-baseline justify-between border-y border-border py-2.5">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Memory</div>
            <div className="text-base font-bold tabular-nums">
              {acc.memoryGb} <span className="text-xs font-normal text-muted-foreground">GB</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">ID</div>
            <div className="font-mono text-[11px] text-muted-foreground">{acc.id}</div>
          </div>
        </div>

        {/* Utilization */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">활용률</span>
            <span className="font-mono font-bold tabular-nums text-foreground">
              {acc.utilization}%
            </span>
          </div>
          <Progress value={acc.utilization} indicatorClassName={utilColor} />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-card/60 p-2 backdrop-blur">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              <Thermometer className="size-3" /> 온도
            </div>
            <div className={cn("font-mono text-sm font-semibold tabular-nums", tempColor)}>
              {acc.temperatureC}°C
            </div>
          </div>
          <div className="rounded-md bg-card/60 p-2 backdrop-blur">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              <Zap className="size-3" /> 전력
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums">
              {formatWatts(acc.powerW)}
            </div>
          </div>
          <div className="rounded-md bg-card/60 p-2 backdrop-blur">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              <Activity className="size-3" /> 매핑
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums">
              {acc.multiplexing}
            </div>
          </div>
        </div>

        {/* Sharing + Tenant */}
        <div className="space-y-1.5 rounded-md bg-card/60 p-2.5 backdrop-blur">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">공유 정책</span>
            <Badge variant="outline" className="text-[10px]">
              {acc.sharing}
            </Badge>
          </div>
          {acc.allocatedToTenant && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">할당 테넌트</span>
              <span className="font-mono text-foreground">{acc.allocatedToTenant}</span>
            </div>
          )}
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1">
          {acc.capabilities.slice(0, 3).map((c) => (
            <Badge key={c} variant="ghost" className="text-[10px]">
              {c}
            </Badge>
          ))}
          {acc.capabilities.length > 3 && (
            <Badge variant="ghost" className="text-[10px]">
              +{acc.capabilities.length - 3}
            </Badge>
          )}
        </div>

        {/* Footer info */}
        <div className="grid grid-cols-2 gap-1 border-t border-border pt-3 text-[10px] text-muted-foreground">
          <div>
            <span className="opacity-60">드라이버 </span>
            <span className="font-mono text-foreground">{acc.driverVersion}</span>
          </div>
          <div>
            <span className="opacity-60">펌웨어 </span>
            <span className="font-mono text-foreground">{acc.firmwareVersion}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AcceleratorTable({ items }: { items: Accelerator[] }) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID / 이름</TableHead>
            <TableHead>벤더</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>메모리</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>공유</TableHead>
            <TableHead>매핑</TableHead>
            <TableHead>가동률</TableHead>
            <TableHead>온도</TableHead>
            <TableHead>전력</TableHead>
            <TableHead>할당 테넌트</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id} className="cursor-pointer" onClick={() => window.location.assign(`/ai-accelerators/devices/${a.id}`)}>
              <TableCell>
                <div className="font-medium">{a.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{a.id}</div>
              </TableCell>
              <TableCell>{a.vendor}</TableCell>
              <TableCell>
                <Badge variant="outline">{a.kind}</Badge>
              </TableCell>
              <TableCell className="font-mono tabular-nums">{a.memoryGb} GB</TableCell>
              <TableCell>
                <Badge
                  variant={
                    a.status === "Allocated" ? "default" :
                      a.status === "Healthy" ? "success" :
                        a.status === "Error" ? "destructive" :
                          a.status === "Maintenance" ? "warning" : "secondary"
                  }
                >
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{a.sharing}</TableCell>
              <TableCell className="font-mono tabular-nums">{a.multiplexing}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={a.utilization} className="w-20" indicatorClassName={a.utilization > 80 ? "bg-rose-500" : a.utilization > 60 ? "bg-amber-500" : "bg-brand-mint-500"} />
                  <span className="font-mono text-xs tabular-nums">{a.utilization}%</span>
                </div>
              </TableCell>
              <TableCell className="font-mono tabular-nums">{a.temperatureC}°C</TableCell>
              <TableCell className="font-mono tabular-nums">{formatWatts(a.powerW)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {a.allocatedToTenant ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
