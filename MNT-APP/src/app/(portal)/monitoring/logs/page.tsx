"use client";
import { toast } from "sonner";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import { Search, AlertCircle, Download, Radio, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 조회 범위 — 로그 API의 검색 경로에 대응 */
const SCOPES = [
  { key: "all", label: "전체", path: "/logs/search" },
  { key: "cluster", label: "클러스터", path: "/logs/clusters/{c}/search" },
  { key: "node", label: "노드 시스템", path: "/logs/clusters/{c}/nodes/{n}/logs" },
  { key: "pod", label: "Pod", path: "/logs/clusters/{c}/…/pods/{pod}/logs" },
  { key: "driver", label: "가속기 드라이버", path: "/logs/clusters/{c}/…/accelerators/{id}/logs" },
];

/** 라벨 키·값 — /logs/labels, /logs/label-values */
const LABELS: Record<string, string[]> = {
  cluster: ["mgmt", "l40s", "furiosa", "furiosa-1348", "rebellions"],
  namespace: ["kube-system", "openstack", "llm-serving", "ai-research"],
  pod: ["kube-ovn-pinger-pmzgm", "neutron-server-0", "dcgm-exporter-9v2kx"],
  container: ["pinger", "neutron-server", "dcgm-exporter"],
  job: ["loki.source.kubernetes.pods", "loki.source.journal"],
  service_name: ["pinger", "neutron-server"],
  node: ["compute1", "compute2", "innogrid-gpu", "innogrid-npu"],
};

/** 로그 볼륨 통계 — /logs/volume (라벨 조합별 bytes) */
const VOLUME = [
  { label: 'job="loki.source.kubernetes.pods"', bytes: 184_320_000 },
  { label: 'job="loki.source.journal"', bytes: 96_470_000 },
  { label: 'namespace="openstack"', bytes: 61_200_000 },
  { label: 'namespace="kube-system"', bytes: 42_900_000 },
  { label: 'namespace="llm-serving"', bytes: 12_640_000 },
];

/** 검색 결과 — /logs/search 응답 data[] 필드 그대로 */
const LOGS: {
  timestamp: string;
  log_level: "error" | "warning" | "info" | "debug";
  message: string;
  labels: Record<string, string>;
  detected_fields: Record<string, string>;
}[] = [
  {
    timestamp: "2026-09-18T16:22:43.609+09:00", log_level: "info",
    message: "I0918 16:22:43.609574 1 ping.go:151] ping node: controller 172.29.236.154, count: 3, average rtt 0.42ms",
    labels: { cluster: "mgmt", namespace: "kube-system", pod: "kube-ovn-pinger-pmzgm", container: "pinger" }, detected_fields: {},
  },
  {
    timestamp: "2026-09-18T16:22:41.118+09:00", log_level: "error",
    message: "ERROR neutron.plugins.ml2: Connection to RabbitMQ timed out (attempt 3/5)",
    labels: { cluster: "mgmt", namespace: "openstack", pod: "neutron-server-0", container: "neutron-server" }, detected_fields: {},
  },
  {
    timestamp: "2026-09-18T16:19:08.402+09:00", log_level: "error",
    message: "NVRM: Xid (PCI:0000:00:05): 43, pid=12894, Ch 00000018, engmask 00000101",
    labels: { cluster: "l40s", node: "innogrid-gpu", job: "loki.source.journal" }, detected_fields: { XID: "43" },
  },
  {
    timestamp: "2026-09-18T16:14:52.771+09:00", log_level: "warning",
    message: "furiosa-device-plugin: device npu0 temperature 79C approaching limit (80C)",
    labels: { cluster: "furiosa", node: "innogrid-npu", job: "loki.source.journal" }, detected_fields: {},
  },
  {
    timestamp: "2026-09-18T16:12:30.004+09:00", log_level: "info",
    message: "dcgm-exporter: collected 47 metrics from 1 GPU in 18ms",
    labels: { cluster: "l40s", namespace: "kube-system", pod: "dcgm-exporter-9v2kx", container: "dcgm-exporter" }, detected_fields: {},
  },
  {
    timestamp: "2026-09-18T16:08:30.552+09:00", log_level: "error",
    message: "kubelet: Memory cgroup out of memory: Killed process 20481 (python3) total-vm:18.4GB",
    labels: { cluster: "mgmt", node: "compute1", job: "loki.source.journal" }, detected_fields: { OOM: "python3" },
  },
  {
    timestamp: "2026-09-18T16:04:11.219+09:00", log_level: "debug",
    message: "rbln-stat: card 0 power 18.4W util 39% temp 47C",
    labels: { cluster: "rebellions", node: "innogrid-rbln", job: "loki.source.journal" }, detected_fields: {},
  },
  {
    timestamp: "2026-09-18T16:01:47.883+09:00", log_level: "info",
    message: "nova-compute: instance llama-trainer-01 spawned successfully on compute2",
    labels: { cluster: "mgmt", namespace: "openstack", pod: "nova-compute-2", container: "nova-compute" }, detected_fields: {},
  },
];

const LEVELS = ["error", "warning", "info", "debug"] as const;

export default function LogsPage() {
  const [scope, setScope] = React.useState("all");
  const [level, setLevel] = React.useState("all");
  const [labelKey, setLabelKey] = React.useState("cluster");
  const [labelValue, setLabelValue] = React.useState("all");
  const [live, setLive] = React.useState(false);

  const rows = LOGS.filter(
    (l) => (level === "all" || l.log_level === level)
      && (labelValue === "all" || l.labels[labelKey] === labelValue),
  );
  const scopePath = SCOPES.find((s) => s.key === scope)?.path ?? "/logs/search";
  const maxVol = Math.max(...VOLUME.map((v) => v.bytes));

  return (
    <div className="space-y-4">
      <ChangeMark ids={["CR-OBS-08"]}>
        <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] text-sky-900">
          <strong>구성 기준</strong> — 로그 API가 주는 것만 화면에 둔다. LogQL 검색 · 실시간 스트리밍(SSE) · CSV/JSON 내보내기 · 라벨 키·값 조회 · 로그 볼륨 통계와
          범위별 검색(전체 · 클러스터 · 노드 시스템 · Pod · 가속기 드라이버)이다. 별도 이벤트 API는 없어 <strong>이벤트는 로그에서 자동 추출한 구조화 필드(XID·OOM 등)</strong>로 표시한다.
          트레이스 식별자는 아직 계측 전이라 값이 비어 있다.
        </div>
      </ChangeMark>

      {/* 검색 조건 — /logs/search 쿼리 파라미터와 1:1 */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {SCOPES.map((sc) => (
              <button
                key={sc.key}
                type="button"
                onClick={() => setScope(sc.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                  scope === sc.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {sc.label}
              </button>
            ))}
            <Badge variant="ghost" className="ml-auto font-mono text-[10px]">{scopePath}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input defaultValue='{namespace="openstack"} |= "ERROR"' className="w-[380px] pl-9 font-mono text-xs" />
            </div>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 레벨</SelectItem>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select defaultValue="1h">
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["15m", "1h", "6h", "24h", "7d"].map((p) => <SelectItem key={p} value={p}>지난 {p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select defaultValue="backward">
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="backward">최신부터</SelectItem>
                <SelectItem value="forward">오래된 것부터</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="100">
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["50", "100", "500", "1000"].map((n) => <SelectItem key={n} value={n}>{n}행</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => toast.success(`로그 ${rows.length}건 조회 — ${scopePath}`)}>
              <Search className="size-3.5" /> 검색
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <Tags className="size-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">라벨 필터</span>
            <Select value={labelKey} onValueChange={(v) => { setLabelKey(v); setLabelValue("all"); }}>
              <SelectTrigger className="w-[150px] font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(LABELS).map((k) => <SelectItem key={k} value={k} className="font-mono text-xs">{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={labelValue} onValueChange={setLabelValue}>
              <SelectTrigger className="w-[220px] font-mono text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {LABELS[labelKey].map((v) => <SelectItem key={v} value={v} className="font-mono text-xs">{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={live ? "default" : "outline"} size="sm"
              onClick={() => { setLive((v) => !v); toast.success(live ? "실시간 스트리밍 중지" : "실시간 스트리밍 시작 — /logs/stream (SSE, 2초 폴링)"); }}
            >
              <Radio className={cn("size-3.5", live && "animate-pulse")} /> {live ? "실시간 중" : "실시간"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("CSV 내보내기 — /logs/export?format=csv")}>
              <Download className="size-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("JSON 내보내기 — /logs/export?format=json")}>
              <Download className="size-3.5" /> JSON
            </Button>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">{rows.length}행 · total {LOGS.length}</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 검색 결과 */}
        <Card className="overflow-hidden bg-slate-950 text-slate-100">
          <div className="divide-y divide-slate-800">
            {rows.map((log, i) => (
              <div key={i} className="px-4 py-2 font-mono text-[11px] hover:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-slate-500">{log.timestamp.slice(11, 23)}</span>
                  <LevelBadge level={log.log_level} />
                  {Object.entries(log.labels).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="rounded bg-slate-800 px-1.5 py-0 text-[10px] text-brand-mint-400">{k}={v}</span>
                  ))}
                  {Object.entries(log.detected_fields).map(([k, v]) => (
                    <span key={k} className="rounded bg-amber-500/20 px-1.5 py-0 text-[10px] font-semibold text-amber-300">{k} {v}</span>
                  ))}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-slate-200">{log.message}</div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-6 text-[11px] text-slate-400">
                <AlertCircle className="size-4" /> 조건에 맞는 로그가 없다 (warnings: NO_DATA).
              </div>
            )}
          </div>
        </Card>

        {/* 로그 볼륨 통계 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              로그 볼륨
              <Badge variant="ghost" className="font-mono text-[10px]">/logs/volume</Badge>
            </CardTitle>
            <CardDescription>라벨 조합별로 쌓인 양(bytes).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {VOLUME.map((v) => (
              <div key={v.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span className="truncate text-muted-foreground">{v.label}</span>
                  <span className="shrink-0 tabular-nums">{(v.bytes / 1_000_000).toFixed(1)} MB</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-brand-indigo-500" style={{ width: `${(v.bytes / maxVol) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    error: "bg-rose-500/20 text-rose-300",
    warning: "bg-amber-500/20 text-amber-300",
    info: "bg-sky-500/20 text-sky-300",
    debug: "bg-slate-700 text-slate-400",
  };
  return (
    <span className={cn("rounded px-1.5 py-0 text-center text-[9px] font-semibold uppercase tracking-wider", map[level])}>
      {level}
    </span>
  );
}
