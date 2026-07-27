"use client";
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
}

const INITIAL_POLICIES: AlertPolicy[] = [
  {
    id: "pol-001",
    name: "vLLM 추론 지연 초과",
    metric: "inference_latency_p99_ms",
    condition: ">",
    threshold: 1000,
    duration: "5m",
    severity: "critical",
    channels: ["email", "slack"],
    enabled: true,
    target: "namespace=llm-serving",
  },
  {
    id: "pol-002",
    name: "GPU 가동률 임계 초과",
    metric: "gpu_utilization_pct",
    condition: ">=",
    threshold: 95,
    duration: "10m",
    severity: "warning",
    channels: ["slack"],
    enabled: true,
    target: "kind=GPU",
  },
  {
    id: "pol-003",
    name: "Pod 재시작 반복",
    metric: "pod_restart_count",
    condition: ">",
    threshold: 5,
    duration: "15m",
    severity: "warning",
    channels: ["email"],
    enabled: true,
    target: "cluster=svc-ai-prod",
  },
  {
    id: "pol-004",
    name: "노드 오프라인",
    metric: "node_ready",
    condition: "==",
    threshold: 0,
    duration: "2m",
    severity: "critical",
    channels: ["email", "slack", "webhook"],
    enabled: true,
    target: "pool=pool-2",
  },
  {
    id: "pol-005",
    name: "볼륨 사용률 경고",
    metric: "volume_used_pct",
    condition: ">=",
    threshold: 85,
    duration: "30m",
    severity: "info",
    channels: ["email"],
    enabled: false,
    target: "type=SSD",
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
      <PageHeader
        title="알람"
        description="알람 정책 관리 · 채널 설정 · 활성 알람 조회"
      />

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
              메트릭 임계값 초과 시 지정된 채널로 알림을 발송한다.
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
                      <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {p.metric} <span className="text-brand-indigo-600">{p.condition}</span> {p.threshold}
                      </span>
                    </TableCell>
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
