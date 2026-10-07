"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import {
  AlertTriangle, Bell, Plus, Edit, Trash2, MoreVertical, Mail, MessageSquare, Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn, relativeTime } from "@/lib/utils";

type AlertsResponse = {
  items: { id: string; severity: "critical" | "warning" | "info"; ts: string; source: string; message: string; acknowledged: boolean }[];
  counts: { critical: number; warning: number; info: number };
};

interface AlertPolicy {
  id: string;
  name: string;
  metric: string;
  condition: ">" | "<" | ">=" | "<=" | "==";
  threshold: number;
  duration: string;
  severity: "critical" | "warning" | "info";
  channels: ("email" | "slack" | "webhook")[];
  enabled: boolean;
  target: string;
  /** 규칙 성격 설명 */
  scenario?: string;
  /** 평가에 쓰는 모니터링 API 경로 */
  source: string;
}

const INITIAL_POLICIES: AlertPolicy[] = [
  {
    id: "pol-001", name: "가속기 온도 임계 근접",
    metric: "temperature_celsius", condition: ">=", threshold: 80, duration: "5m",
    severity: "warning", channels: ["email", "slack"], enabled: true,
    target: "가속기 전체", source: "/clusters/{c}/nodes/{n}/accelerators/{id}/metrics",
  },
  {
    id: "pol-002", name: "가속기 사용률 포화",
    metric: "utilization_percent", condition: ">=", threshold: 95, duration: "10m",
    severity: "warning", channels: ["slack"], enabled: true,
    target: "cluster=l40s", source: "/clusters/{c}/nodes/{n}/accelerators/{id}/metrics",
  },
  {
    id: "pol-003", name: "가속기 메모리 포화",
    metric: "memory_used_bytes / memory_total_bytes", condition: ">=", threshold: 90, duration: "10m",
    severity: "warning", channels: ["slack"], enabled: true,
    target: "가속기 전체", source: "/clusters/{c}/nodes/{n}/accelerators/{id}/metrics",
  },
  {
    id: "pol-004", name: "노드 NotReady",
    metric: "resources.nodes.not_ready", condition: ">=", threshold: 1, duration: "2m",
    severity: "critical", channels: ["email", "slack", "webhook"], enabled: true,
    target: "cluster=mgmt", source: "/clusters/{c}/resource",
  },
  {
    id: "pol-005", name: "노드 디스크 사용률",
    metric: "disk_usage_percent", condition: ">=", threshold: 85, duration: "30m",
    severity: "info", channels: ["email"], enabled: true,
    target: "노드 전체", source: "/clusters/{c}/nodes/{n}/metrics",
  },
  {
    id: "pol-006", name: "TDP 대비 전력 과다",
    metric: "tdp_ratio_pct", condition: ">=", threshold: 90, duration: "10m",
    severity: "warning", channels: ["slack"], enabled: false,
    target: "벤더 전체", source: "/monitoring/power/efficiency",
  },
  {
    id: "pol-007", name: "오류 로그 급증",
    metric: "log_level=error 건수 / 5m", condition: ">=", threshold: 20, duration: "5m",
    severity: "warning", channels: ["slack"], enabled: true,
    target: "cluster 전체", source: "/logs/search",
  },
  // ── 이상감지 시나리오 6종 (CR-OBS-11) — 평가 가능한 필드로 표현 ──
  {
    id: "pol-008", name: "알림 묶기 — 같은 노드의 동시 이상을 하나로",
    metric: "healthy=false + error 로그 동시 발생", condition: ">=", threshold: 2, duration: "5m",
    severity: "critical", channels: ["slack", "webhook"], enabled: true,
    target: "노드 단위", source: "/…/accelerators/{id}/metrics + /logs/search",
    scenario: "가속기 비정상과 오류 로그가 같은 노드에서 함께 뜨면 하나의 사건으로 묶어 한 번만 알린다.",
  },
  {
    id: "pol-009", name: "상대 비교 — 같은 클러스터 중앙값 이탈",
    metric: "utilization_percent 중앙값 대비 편차(%p)", condition: ">", threshold: 30, duration: "10m",
    severity: "warning", channels: ["slack"], enabled: true,
    target: "cluster 단위", source: "/clusters/{c}/nodes/{n}/accelerators",
    scenario: "임계값 대신 같은 묶음 안의 다른 카드와 비교해 혼자 튀는 것을 잡는다.",
  },
  {
    id: "pol-010", name: "알람 억제 — 노드가 죽으면 하위 알림 정지",
    metric: "resources.nodes.not_ready", condition: ">=", threshold: 1, duration: "1m",
    severity: "critical", channels: ["email", "slack"], enabled: true,
    target: "노드 하위 전체", source: "/clusters/{c}/resource",
    scenario: "노드가 NotReady면 그 노드에 속한 가속기·Pod 알림은 억제해 한 사건만 남긴다.",
  },
  {
    id: "pol-011", name: "시간대별 정상 범위 이탈",
    metric: "utilization_percent 시계열 표준편차", condition: ">", threshold: 2, duration: "15m",
    severity: "warning", channels: ["email"], enabled: false,
    target: "가속기 전체", source: "/monitoring/metrics/timeseries",
    scenario: "같은 요일·시간대의 평소 범위를 기준선으로 두고 벗어날 때만 알린다.",
  },
  {
    id: "pol-012", name: "spike 무시 — 지속될 때만 알림",
    metric: "temperature_celsius", condition: ">=", threshold: 80, duration: "5m",
    severity: "warning", channels: ["slack"], enabled: true,
    target: "가속기 전체", source: "/…/accelerators/{id}/metrics",
    scenario: "순간 튐은 무시하고 임계값 초과가 지속 시간 동안 이어질 때만 올린다.",
  },
  {
    id: "pol-013", name: "NPU 신규 지표 — 규칙 기반 시작",
    metric: "healthy", condition: "==", threshold: 0, duration: "2m",
    severity: "critical", channels: ["slack"], enabled: true,
    target: "vendor=furiosa | rebellions", source: "/…/accelerators/{id}/metrics",
    scenario: "기준선을 쌓기 전까지는 정상 여부 규칙으로 시작하고, 데이터가 모이면 baseline으로 옮긴다.",
  },
];

interface Channel {
  id: string;
  type: "email" | "slack" | "webhook";
  name: string;
  destination: string;
  active: boolean;
}

const INITIAL_CHANNELS: Channel[] = [
  { id: "ch-1", type: "email", name: "운영팀 이메일", destination: "ops@okestro.com", active: true },
  { id: "ch-2", type: "slack", name: "#openkcloud-alerts", destination: "hooks.slack.com/services/T00/B00/xxx", active: true },
  { id: "ch-3", type: "webhook", name: "PagerDuty Incidents", destination: "events.pagerduty.com/v2/enqueue", active: true },
  { id: "ch-4", type: "email", name: "야간 당직", destination: "oncall@okestro.com", active: false },
];

export default function AlertsPage() {
  const { data, isLoading } = api.dashboard.alerts() as { data: AlertsResponse | undefined; isLoading: boolean };
  const [policies, setPolicies] = React.useState<AlertPolicy[]>(INITIAL_POLICIES);
  const [channels, setChannels] = React.useState<Channel[]>(INITIAL_CHANNELS);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AlertPolicy | null>(null);

  return (
    <div className="space-y-4">
      <ChangeMark ids={["CR-OBS-10", "CR-OBS-11", "CR-OBS-09"]}>
      <PageHeader
        title="알람"
        description="임계 규칙 평가 · 채널 설정 · 활성 알람 조회"
      />
      </ChangeMark>

      <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] text-sky-900">
        <strong>구성 기준</strong> — 모니터링 API v2는 지표·로그 조회까지 제공하고 알람 자체는 제공하지 않는다. 그래서 포털이
        <span className="mx-1 font-mono">/monitoring/metrics/query</span>·<span className="mx-1 font-mono">/clusters/…/accelerators/{"{id}"}/metrics</span>·<span className="mx-1 font-mono">/logs/search</span>를 주기 조회해
        <strong>임계 규칙을 직접 평가</strong>하고, 정책·채널·발생 이력은 포털에 저장한다. 정책 조건은 API가 실제로 주는 필드만 쓴다.
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            활성 알람 ({(data?.counts.critical ?? 0) + (data?.counts.warning ?? 0) + (data?.counts.info ?? 0)})
          </TabsTrigger>
          <TabsTrigger value="policies">알람 정책 ({policies.length})</TabsTrigger>
          <TabsTrigger value="channels">채널 ({channels.length})</TabsTrigger>
        </TabsList>

        {/* 활성 알람 */}
        <TabsContent value="active">
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
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={a.severity === "critical" ? "destructive" : a.severity === "warning" ? "warning" : "default"}
                      >
                        {a.severity}
                      </Badge>
                      {!a.acknowledged && (
                        <Button size="sm" variant="outline" onClick={() => toast.success(`알람 ${a.id} 확인 처리됨`)}>
                          확인
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 알람 정책 CRUD */}
        <TabsContent value="policies">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              포털이 조회 API를 주기 호출해 조건을 평가하고 지정 채널로 보낸다. pol-008~013은 이상감지 시나리오 6종을 평가 가능한 필드로 옮긴 것이다. 기록 → 이벤트 → 알림 3단계 승격. SLO는 이번 과제에서 제외.
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> 정책 생성
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">활성</TableHead>
                  <TableHead>정책 이름</TableHead>
                  <TableHead>조건</TableHead>
                  <TableHead>평가 경로</TableHead>
                  <TableHead>대상</TableHead>
                  <TableHead>지속</TableHead>
                  <TableHead>심각도</TableHead>
                  <TableHead>채널</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Switch
                        checked={p.enabled}
                        onCheckedChange={(v) => {
                          setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled: v } : x)));
                          toast.success(`${p.name} ${v ? "활성화" : "비활성화"}`);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.scenario && <div className="mt-0.5 max-w-md text-[10px] leading-snug text-muted-foreground">{p.scenario}</div>}
                      <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {p.metric} <span className="text-brand-indigo-600">{p.condition}</span> {p.threshold}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-mono text-[10px] text-muted-foreground" title={p.source}>{p.source}</TableCell>
                    <TableCell className="font-mono text-xs">{p.target}</TableCell>
                    <TableCell className="font-mono text-xs">{p.duration}</TableCell>
                    <TableCell>
                      <Badge
                        variant={p.severity === "critical" ? "destructive" : p.severity === "warning" ? "warning" : "default"}
                        className="text-[10px]"
                      >
                        {p.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {p.channels.map((c) => (
                          <span key={c} className="flex size-5 items-center justify-center rounded bg-secondary text-muted-foreground" title={c}>
                            {c === "email" && <Mail className="size-3" />}
                            {c === "slack" && <MessageSquare className="size-3" />}
                            {c === "webhook" && <Webhook className="size-3" />}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(p)}>
                            <Edit className="size-3.5" /> 편집
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`${p.name} 테스트 알람 발송`)}>
                            <Bell className="size-3.5" /> 테스트 발송
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600"
                            onClick={() => {
                              setPolicies((prev) => prev.filter((x) => x.id !== p.id));
                              toast.success(`${p.name} 삭제됨`);
                            }}
                          >
                            <Trash2 className="size-3.5" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* 채널 */}
        <TabsContent value="channels">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              알람을 받을 대상 채널을 정의한다 — 이메일·Slack·Webhook 지원.
            </div>
            <Button size="sm" onClick={() => toast.success("채널 추가 다이얼로그")}>
              <Plus className="size-3.5" /> 채널 추가
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">활성</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>종류</TableHead>
                  <TableHead>대상</TableHead>
                  <TableHead className="w-24">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Switch
                        checked={c.active}
                        onCheckedChange={(v) => {
                          setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: v } : x)));
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="ghost" className="gap-1 text-[10px]">
                        {c.type === "email" && <Mail className="size-2.5" />}
                        {c.type === "slack" && <MessageSquare className="size-2.5" />}
                        {c.type === "webhook" && <Webhook className="size-2.5" />}
                        {c.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.destination}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toast.success(`${c.name}으로 테스트 발송`)}>
                          테스트
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <PolicyDialog
        open={createOpen || !!editing}
        editing={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        onSave={(p) => {
          if (editing) {
            setPolicies((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            toast.success(`${p.name} 수정됨`);
          } else {
            setPolicies((prev) => [...prev, p]);
            toast.success(`${p.name} 생성됨`);
          }
          setCreateOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function PolicyDialog({
  open, editing, onClose, onSave,
}: {
  open: boolean;
  editing: AlertPolicy | null;
  onClose: () => void;
  onSave: (p: AlertPolicy) => void;
}) {
  const [form, setForm] = React.useState<AlertPolicy>(
    editing ?? {
      id: `pol-${Date.now()}`,
      name: "",
      metric: "",
      condition: ">",
      threshold: 0,
      duration: "5m",
      severity: "warning",
      channels: ["email"],
      enabled: true,
      target: "",
      source: "/monitoring/metrics/query",
    },
  );

  React.useEffect(() => {
    if (editing) setForm(editing);
    else
      setForm({
        id: `pol-${Date.now()}`,
        name: "",
        metric: "",
        condition: ">",
        threshold: 0,
        duration: "5m",
        severity: "warning",
        channels: ["email"],
        enabled: true,
        target: "",
        source: "/monitoring/metrics/query",
      });
  }, [editing, open]);

  const toggleChannel = (c: "email" | "slack" | "webhook") => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "정책 편집" : "알람 정책 생성"}</DialogTitle>
          <DialogDescription>
            메트릭이 임계값을 특정 기간 동안 만족하면 알람을 발송한다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>정책 이름</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vLLM 추론 지연 초과" />
          </div>
          <div>
            <Label>메트릭</Label>
            <Input
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              className="font-mono text-xs"
              placeholder="inference_latency_p99_ms"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px]">조건</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as AlertPolicy["condition"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=">">&gt;</SelectItem>
                  <SelectItem value=">=">&gt;=</SelectItem>
                  <SelectItem value="<">&lt;</SelectItem>
                  <SelectItem value="<=">&lt;=</SelectItem>
                  <SelectItem value="==">==</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">임계값</Label>
              <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[11px]">지속 시간</Label>
              <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="font-mono text-xs" placeholder="5m" />
            </div>
          </div>
          <div>
            <Label>대상 필터 (label selector)</Label>
            <Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="font-mono text-xs" placeholder="namespace=llm-serving,kind=GPU" />
          </div>
          <div>
            <Label>심각도</Label>
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as AlertPolicy["severity"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>알림 채널</Label>
            <div className="flex gap-2 pt-1">
              {(["email", "slack", "webhook"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    form.channels.includes(c)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {c === "email" && <Mail className="size-3" />}
                  {c === "slack" && <MessageSquare className="size-3" />}
                  {c === "webhook" && <Webhook className="size-3" />}
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || !form.metric}>
            {editing ? "저장" : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
