"use client";
import * as React from "react";
import { toast } from "sonner";
import { Clock, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePollingInterval } from "@/lib/polling";

const RANGES = ["지난 15분", "지난 1시간", "지난 6시간", "지난 24시간"];

export default function Layout({ children }: { children: React.ReactNode }) {
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
        description="인프라·가속기 지표와 전력·클러스터 현황 통합 분석"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = (range + 1) % RANGES.length;
                setRange(next);
                toast.success(`조회 구간 ${RANGES[next]}`);
              }}
              title="누를 때마다 조회 구간이 바뀐다"
            >
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
      {children}
    </div>
  );
}
