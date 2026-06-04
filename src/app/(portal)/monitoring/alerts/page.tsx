"use client";
import { AlertTriangle, Target, TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, relativeTime } from "@/lib/utils";

const SLOS = [
  { name: "vllm-solar-10b · P99 < 1s", target: 99, current: 87.4, period: "30일", trend: -2.1 },
  { name: "stt-rngd-prod · 가용성", target: 99.9, current: 99.97, period: "30일", trend: 0.0 },
  { name: "stt-atom-edge · P95 < 300ms", target: 99, current: 99.4, period: "30일", trend: 0.3 },
  { name: "K8s API 가용성", target: 99.95, current: 99.99, period: "90일", trend: 0.0 },
];

type AlertsResponse = {
  items: { id: string; severity: "critical" | "warning" | "info"; ts: string; source: string; message: string; acknowledged: boolean }[];
  counts: { critical: number; warning: number; info: number };
};

export default function AlertsPage() {
  const { data, isLoading } = api.dashboard.alerts() as { data: AlertsResponse | undefined; isLoading: boolean };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {SLOS.map((s) => {
          const breach = s.current < s.target;
          return (
            <Card key={s.name} className={cn("p-4", breach && "border-rose-200 bg-rose-50/30")}>
              <div className="text-xs text-muted-foreground">{s.name}</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className={cn("text-2xl font-bold tabular-nums", breach ? "text-rose-700" : "text-foreground")}>
                  {s.current}%
                </span>
                <span className="text-xs text-muted-foreground">목표 {s.target}%</span>
              </div>
              <Progress
                value={(s.current / 100) * 100}
                className="mt-2"
                indicatorClassName={breach ? "bg-rose-500" : "bg-brand-mint-500"}
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{s.period}</span>
                <span className={s.trend < 0 ? "text-rose-600" : s.trend > 0 ? "text-brand-mint-700" : ""}>
                  {s.trend > 0 ? "+" : ""}{s.trend}%
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>활성 알람</CardTitle>
            <CardDescription>
              심각 {data?.counts.critical} · 경고 {data?.counts.warning} · 정보 {data?.counts.info}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.items.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    a.severity === "critical" ? "bg-rose-100 text-rose-700" :
                      a.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700",
                  )}
                >
                  <AlertTriangle className="size-4" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-tight">{a.message}</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{a.source}</span>
                    <span>·</span>
                    <span>{relativeTime(a.ts)}</span>
                    {a.acknowledged && <Badge variant="ghost" className="text-[10px]">확인됨</Badge>}
                  </div>
                </div>
                <Badge
                  variant={a.severity === "critical" ? "destructive" : a.severity === "warning" ? "warning" : "default"}
                >
                  {a.severity}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
