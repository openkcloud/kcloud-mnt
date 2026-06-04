"use client";
import * as React from "react";
import { Search, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOGS = [
  { ts: "14:32:18.412", level: "INFO", svc: "vllm-solar-10b", msg: "Generated 87 tokens in 980ms (p_attention_kv_miss=0.41)" },
  { ts: "14:32:17.984", level: "WARN", svc: "vllm-solar-10b", msg: "KV cache miss rate exceeded 35% threshold (current: 41%)" },
  { ts: "14:32:17.612", level: "INFO", svc: "stt-rngd-prod", msg: "Transcribed 12.3s audio in 412ms via Furiosa RNGD" },
  { ts: "14:32:17.118", level: "INFO", svc: "kserve-furiosa-rngd", msg: "Model loaded: korean-stt-large v3.1 (4.2GB)" },
  { ts: "14:32:16.804", level: "ERROR", svc: "neutron-server", msg: "Connection to RabbitMQ timed out (attempt 3/5)" },
  { ts: "14:32:16.412", level: "INFO", svc: "vllm-solar-10b", msg: "Batch processed: 8 requests, avg 124ms/token" },
  { ts: "14:32:15.998", level: "INFO", svc: "stt-atom-edge", msg: "Rebellions ATOM device atom-1 acquired by pod stt-atom-edge-7f9b" },
  { ts: "14:32:15.612", level: "WARN", svc: "acc-a100-1-2", msg: "GPU temperature 78°C — approaching throttle threshold (80°C)" },
  { ts: "14:32:15.214", level: "INFO", svc: "kubelet-gpu-01", msg: "Pod kfp-runner-01 GPU 1/1 attached (acc-a100-1-3)" },
  { ts: "14:32:14.812", level: "INFO", svc: "vllm-solar-10b", msg: "Generated 124 tokens in 1042ms (slo_breach=true)" },
  { ts: "14:32:14.412", level: "INFO", svc: "kfp-controller", msg: "Pipeline run llama-3-finetune-pipeline-run-014 started" },
  { ts: "14:32:13.998", level: "DEBUG", svc: "katib-controller", msg: "Trial llama-lr-search-024 metric=0.847, target=0.88" },
  { ts: "14:32:13.612", level: "INFO", svc: "harbor-core", msg: "Image openkcloud/vllm:0.6.5 pulled by gpu-node-02" },
  { ts: "14:32:13.214", level: "INFO", svc: "prometheus-server", msg: "Scraped 247 targets in 1.2s" },
  { ts: "14:32:12.998", level: "WARN", svc: "neutron-server", msg: "Slow query: SELECT * FROM ports WHERE ... 1.4s" },
];

export default function LogsPage() {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder='Loki LogQL — {svc="vllm-solar-10b"} |= "WARN"' className="w-96 pl-9 font-mono text-xs" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 레벨</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="DEBUG">DEBUG</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">실시간</Button>
          <span className="ml-auto text-xs text-muted-foreground">15개 항목 · 지난 30s</span>
        </div>
      </Card>

      <Card className="overflow-hidden bg-slate-950 text-slate-100">
        <div className="divide-y divide-slate-800">
          {LOGS.map((log, i) => (
            <div key={i} className="grid grid-cols-[120px_70px_180px_1fr] items-start gap-3 px-4 py-1.5 font-mono text-[11px] hover:bg-slate-900">
              <span className="text-slate-500 tabular-nums">{log.ts}</span>
              <LevelBadge level={log.level} />
              <span className="text-brand-mint-400">{log.svc}</span>
              <span className="text-slate-200 whitespace-pre-wrap">{log.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    ERROR: "bg-rose-500/20 text-rose-300",
    WARN: "bg-amber-500/20 text-amber-300",
    INFO: "bg-sky-500/20 text-sky-300",
    DEBUG: "bg-slate-700 text-slate-400",
  };
  return (
    <span className={cn("rounded px-1.5 py-0 text-center text-[9px] font-semibold uppercase tracking-wider", map[level])}>
      {level}
    </span>
  );
}
