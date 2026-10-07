"use client";
import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useScope, isFeatureVisible } from "@/lib/scope";
import { usePollingInterval } from "@/lib/polling";

const TABS = [
  { href: "/monitoring", label: "인프라 모니터링" },
  { href: "/monitoring/insights", label: "AI 모델 분석", feature: "monitoring.insights.aiops" },
  { href: "/monitoring/traces", label: "분산 트레이스", feature: "monitoring.traces.internal" },
  { href: "/monitoring/logs", label: "로그·이벤트" },
  { href: "/monitoring/alerts", label: "알람" },
];

const RANGES = ["지난 15분", "지난 1시간", "지난 6시간", "지난 24시간"];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const visible = useScope((s) => s.visible);
  // 포털 형상에서 숨긴 메뉴는 탭에서도 뺀다 (사이드바와 같은 기준)
  const tabs = TABS.filter((t) => !t.feature || isFeatureVisible(visible, t.feature));
  const tracesOn = isFeatureVisible(visible, "monitoring.traces.internal");
  const [range, setRange] = React.useState(1);
  // 자동 새로고침 = 포털 폴링 주기 스토어(실제 쿼리 refetchInterval 을 구동)
  const qc = useQueryClient();
  const intervalMs = usePollingInterval((s) => s.intervalMs);
  const setIntervalMs = usePollingInterval((s) => s.setIntervalMs);
  const auto = intervalMs > 0;
  const autoSecs = auto ? Math.round(intervalMs / 1000) : 30;
  return (
    <div className="space-y-6">
      <PageHeader
        title="옵저버빌리티"
        description={`인프라·서비스 지표와 로그${tracesOn ? "·트레이싱" : ""}·알람 통합 분석`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { const next = (range + 1) % RANGES.length; setRange(next); toast.success(`조회 구간 ${RANGES[next]}`); }} title="누를 때마다 조회 구간이 바뀐다">
              <Clock className="size-3.5" /> {RANGES[range]}
            </Button>
            <Button
              variant={auto ? "outline" : "ghost"}
              size="sm"
              onClick={() => {
                if (auto) {
                  setIntervalMs(0);
                  toast.success("자동 새로고침 중지");
                } else {
                  setIntervalMs(30000);
                  qc.invalidateQueries({ queryKey: ["obs-accel-summary"] });
                  toast.success("자동 새로고침 30s 재개");
                }
              }}
            >
              <RefreshCw className={cn("size-3.5", auto && "text-brand-mint-600")} /> {auto ? `자동 새로고침 ${autoSecs}s` : "자동 새로고침 꺼짐"}
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
