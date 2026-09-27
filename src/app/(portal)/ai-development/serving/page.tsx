"use client";
import { Send, Activity, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { useProjectContext } from "@/lib/project-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { KFInferenceService } from "@/lib/types";

export default function ServingPage() {
  const { data, isLoading } = api.kubeflow.serving() as {
    data: { items: KFInferenceService[] } | undefined;
    isLoading: boolean;
  };
  const { match, isAll } = useProjectContext();
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const items = data.items.filter((x) => match(x.namespace));
  if (!items.length)
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">이 프로젝트에 배포된 모델 서비스가 없다.</CardContent>
      </Card>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <Card key={s.id}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <Send className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {s.modelName} · {s.modelVersion}
                  </div>
                </div>
              </div>
              <Badge variant={s.status === "Ready" ? "success" : s.status === "Failed" ? "destructive" : "warning"} className="gap-1">
                {s.status === "Ready" && <span className="size-1.5 rounded-full bg-brand-mint-500" />}
                {s.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/40 p-3">
              <Metric label="레플리카" value={s.replicas} />
              <Metric label="평균 RPS" value={formatNumber(s.rpsAvg)} />
              <Metric label="p95 지연" value={`${s.p95LatencyMs}ms`} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="gap-1">
                  <Cpu className="size-3" /> {s.acceleratorKind}
                </Badge>
                {isAll && s.namespace && (
                  <Badge variant="ghost" className="font-mono text-[10px]">{s.namespace}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Activity className="size-3" />
                실시간
              </div>
            </div>

            <div className="rounded-md bg-card border border-border p-2 font-mono text-[11px] text-muted-foreground">
              {s.endpoint}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
