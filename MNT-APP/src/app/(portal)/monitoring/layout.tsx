"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Clock, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/monitoring", label: "인프라 모니터링" },
  { href: "/monitoring/insights", label: "AI 모델 분석" },
  { href: "/monitoring/traces", label: "분산 트레이스" },
  { href: "/monitoring/logs", label: "로그·이벤트" },
  { href: "/monitoring/alerts", label: "알람·SLO" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <PageHeader
        title="옵저버빌리티"
        description="kcloud-opt — 메트릭·로그·트레이싱·비용 통합 분석"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Clock className="size-3.5" /> 지난 1시간
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="size-3.5" /> 자동 새로고침 30s
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
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
