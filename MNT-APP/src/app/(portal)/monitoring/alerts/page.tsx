"use client";
import * as React from "react";
import { AlertTriangle, Bell, Plus, Trash2, MoreVertical, Mail, MessageSquare, Webhook, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm";
import { cn, relativeTime } from "@/lib/utils";
import {
  useActiveAlerts, useAlertChannels, useAlertPolicies,
  useUpdatePolicy, useDeletePolicy, useCreateChannel, useUpdateChannel, useDeleteChannel,
  type AlertActive, type AlertChannel, type AlertPolicy,
} from "@/lib/obs-api";

const OPS = [">", ">=", "<", "<=", "=="];
const SEVERITIES = ["critical", "warning", "info"] as const;
const CHANNEL_TYPES = ["email", "slack", "webhook"] as const;

function sevClass(s: string) {
  return {
    critical: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    info: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  }[s] ?? "bg-slate-500/15 text-slate-500";
}
function SevBadge({ s }: { s: string }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", sevClass(s))}>{s}</span>;
}
function ChannelIcon({ type }: { type: string }) {
  const I = type === "email" ? Mail : type === "slack" ? MessageSquare : Webhook;
  return <I className="size-3.5 text-muted-foreground" />;
}
/** 조건 렌더 — 로그 기반은 window_min 포함(건수/5m >= 20), 그 외는 metric op threshold */
function ruleText(p: AlertPolicy) {
  return p.kind === "log"
    ? `건수/${p.window_min}m ${p.op} ${p.threshold}`
    : `${p.metric} ${p.op} ${p.threshold}`;
}
function targetText(selector: string) {
  return selector?.trim() ? selector : "전체";
}
function activeTargetText(t: AlertActive["target"]) {
  const parts = Object.entries(t ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join(", ") : "전체";
}

export default function AlertsPage() {
  const active = useActiveAlerts();
  const policies = useAlertPolicies();
  const channels = useAlertChannels();

  const alerts = active.data?.alerts ?? [];
  const polList = policies.data?.policies ?? [];
  const chList = channels.data?.channels ?? [];

  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();
  const confirm = useConfirm();

  const [editPolicy, setEditPolicy] = React.useState<AlertPolicy | null>(null);
  const [channelDialog, setChannelDialog] = React.useState<{ mode: "create" | "edit"; data?: AlertChannel } | null>(null);

  const counts = alerts.reduce(
    (a, x) => { const s = x.severity as "critical" | "warning" | "info"; if (s in a) a[s] += 1; return a; },
    { critical: 0, warning: 0, info: 0 } as Record<string, number>,
  );

  const onTogglePolicy = (p: AlertPolicy, enabled: boolean) =>
    updatePolicy.mutate({ id: p.id, body: { enabled } }, {
      onSuccess: () => toast.success(`${p.name} ${enabled ? "활성화" : "비활성화"}`),
      onError: (e) => toast.error(`변경 실패: ${e.message}`),
    });
  const onDeletePolicy = async (p: AlertPolicy) => {
    if (!(await confirm({ title: "정책 삭제", destructive: true, confirmLabel: "삭제", description: `'${p.name}' 정책을 삭제할까요?` }))) return;
    deletePolicy.mutate(p.id, {
      onSuccess: () => toast.success(`${p.name} 삭제됨`),
      onError: (e) => toast.error(`삭제 실패: ${e.message}`),
    });
  };

  return (
    <Tabs defaultValue="active" className="space-y-4">
      <TabsList>
        <TabsTrigger value="active">
          활성 알람 ({active.isLoading ? "…" : alerts.length})
        </TabsTrigger>
        <TabsTrigger value="policies">알람 정책 ({policies.isLoading ? "…" : polList.length})</TabsTrigger>
        <TabsTrigger value="channels">채널 ({channels.isLoading ? "…" : chList.length})</TabsTrigger>
      </TabsList>

      {/* ── 활성 알람 ── */}
      <TabsContent value="active">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> 활성 알람</span>
              <span className="flex items-center gap-2">
                <Badge className={sevClass("critical")}>심각 {counts.critical}</Badge>
                <Badge className={sevClass("warning")}>경고 {counts.warning}</Badge>
                <Badge className={sevClass("info")}>정보 {counts.info}</Badge>
                <Badge variant="ghost" className="font-mono text-[10px]">/alerts/active</Badge>
              </span>
            </CardTitle>
            <CardDescription>현재 발생 중인 알람(정책 평가 결과). 주기 새로고침으로 갱신됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {active.isError && <div className="py-6 text-center text-sm text-rose-500">활성 알람 조회 실패</div>}
            {!active.isError && alerts.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {active.isLoading ? <Loader2 className="mx-auto size-4 animate-spin" /> : "발생 중인 알람이 없습니다."}
              </div>
            )}
            {alerts.map((a) => (
              <div key={a.fingerprint} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SevBadge s={a.severity} />
                    <span className="text-sm font-medium">{a.message}</span>
                    {a.acked_at && <Badge variant="ghost" className="text-[10px]">확인됨</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                    <span>정책 {a.policy_id}</span>
                    <span>대상 {activeTargetText(a.target)}</span>
                    <span>값 {a.value}</span>
                    <span>발생 {relativeTime(a.started_at)}</span>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{a.state}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── 알람 정책 ── */}
      <TabsContent value="policies">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Bell className="size-4" /> 알람 정책</span>
              <span className="flex items-center gap-2">
                <Badge variant="ghost" className="font-mono text-[10px]">/alerts/policies</Badge>
                <Button size="sm" variant="outline" disabled title="상위 API 개발 중">
                  <Plus className="size-3.5" /> 정책 생성(제공 예정)
                </Button>
              </span>
            </CardTitle>
            <CardDescription>리소스(Prometheus)·로그(Loki)·SLO(vLLM) 기반 기본 정책. 활성 토글·수정·삭제 가능.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">활성</TableHead>
                  <TableHead>정책</TableHead>
                  <TableHead>조건</TableHead>
                  <TableHead>대상</TableHead>
                  <TableHead>지속</TableHead>
                  <TableHead>심각도</TableHead>
                  <TableHead>채널</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.isLoading && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow>
                )}
                {!policies.isLoading && polList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Switch checked={p.enabled} onCheckedChange={(v) => onTogglePolicy(p, v)} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{p.id} · {p.description}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ruleText(p)}</TableCell>
                    <TableCell className="font-mono text-xs">{targetText(p.selector)}</TableCell>
                    <TableCell className="font-mono text-xs">{p.duration}</TableCell>
                    <TableCell><SevBadge s={p.severity} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {Object.keys(p.channels ?? {}).length === 0
                          ? <span className="text-[11px] text-muted-foreground">종류 전체</span>
                          : Object.keys(p.channels).map((t) => <ChannelIcon key={t} type={t} />)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditPolicy(p)}><Pencil className="size-3.5" /> 수정</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => onDeletePolicy(p)}><Trash2 className="size-3.5" /> 삭제</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── 채널 ── */}
      <TabsContent value="channels">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Mail className="size-4" /> 알림 채널</span>
              <span className="flex items-center gap-2">
                <Badge variant="ghost" className="font-mono text-[10px]">/alerts/channels</Badge>
                <Button size="sm" onClick={() => setChannelDialog({ mode: "create" })}><Plus className="size-3.5" /> 채널 추가</Button>
              </span>
            </CardTitle>
            <CardDescription>알람은 선택한 채널 종류(email·slack·webhook)로 등록된 채널 전체에 동시 발송됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>종류</TableHead>
                  <TableHead>수신 설정</TableHead>
                  <TableHead>해제 알림</TableHead>
                  <TableHead>활성</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.isLoading && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></TableCell></TableRow>
                )}
                {!channels.isLoading && chList.map((c) => (
                  <ChannelRow key={c.id} c={c} onEdit={() => setChannelDialog({ mode: "edit", data: c })} />
                ))}
                {!channels.isLoading && chList.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">등록된 채널이 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {editPolicy && <PolicyEditDialog policy={editPolicy} onClose={() => setEditPolicy(null)} />}
      {channelDialog && <ChannelDialog mode={channelDialog.mode} data={channelDialog.data} onClose={() => setChannelDialog(null)} />}
    </Tabs>
  );
}

// ── 채널 행 (활성 토글·수정·삭제) ──
function ChannelRow({ c, onEdit }: { c: AlertChannel; onEdit: () => void }) {
  const update = useUpdateChannel();
  const del = useDeleteChannel();
  const confirm = useConfirm();
  const summary = c.type === "email"
    ? (c.config?.to as string[] | undefined)?.join(", ")
    : (c.config?.webhook_url as string) ?? (c.config?.url as string) ?? "";
  const onDelete = async () => {
    if (!(await confirm({ title: "채널 삭제", destructive: true, confirmLabel: "삭제", description: `'${c.name}' 채널을 삭제할까요?` }))) return;
    del.mutate(c.id, { onSuccess: () => toast.success(`${c.name} 삭제됨`), onError: (e) => toast.error(`삭제 실패: ${e.message}`) });
  };
  return (
    <TableRow>
      <TableCell className="font-medium">{c.name}</TableCell>
      <TableCell><span className="flex items-center gap-1.5 text-xs"><ChannelIcon type={c.type} /> {c.type}</span></TableCell>
      <TableCell className="max-w-[320px] truncate font-mono text-[11px] text-muted-foreground">{summary}</TableCell>
      <TableCell>{c.notify_resolved ? <Badge variant="outline" className="text-[10px]">켜짐</Badge> : <span className="text-[11px] text-muted-foreground">꺼짐</span>}</TableCell>
      <TableCell>
        <Switch
          checked={c.enabled}
          onCheckedChange={(v) => update.mutate({ id: c.id, body: { enabled: v } }, {
            onSuccess: () => toast.success(`${c.name} ${v ? "활성화" : "비활성화"}`),
            onError: (e) => toast.error(`변경 실패: ${e.message}`),
          })}
        />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="size-3.5" /> 수정</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600" onClick={onDelete}><Trash2 className="size-3.5" /> 삭제</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ── 정책 수정 다이얼로그 (PATCH: threshold/op/severity/window_min/enabled) ──
function PolicyEditDialog({ policy, onClose }: { policy: AlertPolicy; onClose: () => void }) {
  const update = useUpdatePolicy();
  const [op, setOp] = React.useState(policy.op);
  const [threshold, setThreshold] = React.useState(String(policy.threshold));
  const [severity, setSeverity] = React.useState(policy.severity);
  const [windowMin, setWindowMin] = React.useState(String(policy.window_min));
  const isLog = policy.kind === "log";

  const onSave = () => {
    const body: Partial<AlertPolicy> = { op, threshold: Number(threshold), severity };
    if (isLog) body.window_min = Number(windowMin);
    update.mutate({ id: policy.id, body }, {
      onSuccess: () => { toast.success(`${policy.name} 수정됨`); onClose(); },
      onError: (e) => toast.error(`수정 실패: ${e.message}`),
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{policy.name} 수정</DialogTitle>
          <DialogDescription className="font-mono text-xs">{policy.id} · {policy.metric}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>연산자</Label>
              <Select value={op} onValueChange={setOp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>임계값</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>심각도</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isLog && (
              <div className="space-y-1.5">
                <Label>집계 창(분)</Label>
                <Input type="number" value={windowMin} onChange={(e) => setWindowMin(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={onSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-3.5 animate-spin" />} 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 채널 생성/수정 다이얼로그 ──
function ChannelDialog({ mode, data, onClose }: { mode: "create" | "edit"; data?: AlertChannel; onClose: () => void }) {
  const create = useCreateChannel();
  const update = useUpdateChannel();
  const [name, setName] = React.useState(data?.name ?? "");
  const [type, setType] = React.useState<string>(data?.type ?? "email");
  const [notifyResolved, setNotifyResolved] = React.useState(data?.notify_resolved ?? true);
  const [to, setTo] = React.useState(((data?.config?.to as string[] | undefined) ?? []).join(", "));
  const [url, setUrl] = React.useState((data?.config?.webhook_url as string) ?? (data?.config?.url as string) ?? "");
  const pending = create.isPending || update.isPending;

  const buildConfig = () =>
    type === "email"
      ? { to: to.split(",").map((s) => s.trim()).filter(Boolean) }
      : type === "slack"
        ? { webhook_url: url }
        : { url };

  const onSave = () => {
    const body = { name, type, config: buildConfig(), notify_resolved: notifyResolved };
    const done = { onSuccess: () => { toast.success(`채널 ${mode === "create" ? "추가" : "수정"}됨`); onClose(); }, onError: (e: Error) => toast.error(`실패: ${e.message}`) };
    if (mode === "create") create.mutate(body, done);
    else update.mutate({ id: data!.id, body }, done);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "채널 추가" : "채널 수정"}</DialogTitle>
          <DialogDescription>알람을 받을 채널을 설정합니다.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 운영팀 메일" />
          </div>
          <div className="space-y-1.5">
            <Label>종류</Label>
            <Select value={type} onValueChange={setType} disabled={mode === "edit"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHANNEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {type === "email" ? (
            <div className="space-y-1.5">
              <Label>수신 이메일 (쉼표 구분)</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="ops@example.com, oncall@example.com" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{type === "slack" ? "Slack Webhook URL" : "Webhook URL"}</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>해제 알림</Label>
              <p className="text-[11px] text-muted-foreground">알람이 해소될 때도 알림을 보냅니다.</p>
            </div>
            <Switch checked={notifyResolved} onCheckedChange={setNotifyResolved} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={onSave} disabled={pending || !name}>
            {pending && <Loader2 className="size-3.5 animate-spin" />} 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
