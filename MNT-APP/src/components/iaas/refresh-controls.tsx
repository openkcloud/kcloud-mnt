"use client";
import * as React from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePollingInterval, POLL_OPTIONS } from "@/lib/polling";

/** 자동 폴링 주기 선택 + 수동 새로고침 — IaaS 목록 화면 공용. */
export function RefreshControls({ queryKeys }: { queryKeys: QueryKey[] }) {
  const qc = useQueryClient();
  const intervalMs = usePollingInterval((s) => s.intervalMs);
  const setIntervalMs = usePollingInterval((s) => s.setIntervalMs);
  const [spinning, setSpinning] = React.useState(false);

  function refresh() {
    setSpinning(true);
    Promise.all(queryKeys.map((k) => qc.invalidateQueries({ queryKey: k }))).finally(() =>
      setTimeout(() => setSpinning(false), 500),
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={String(intervalMs)} onValueChange={(v) => setIntervalMs(Number(v))}>
        <SelectTrigger className="h-8 w-[104px] text-xs" title="자동 새로고침 주기">
          <RefreshCw className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {POLL_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon-sm" title="새로고침" onClick={refresh}>
        <RefreshCw className={spinning ? "size-4 animate-spin" : "size-4"} />
      </Button>
    </div>
  );
}
