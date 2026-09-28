"use client";
/* 워크스페이스 신청·승인 (CR-AID-12 임시 창구)
 * 일반 사용자: 신청 → 내 신청 확인·취소
 * 관리자: 신청 목록에서 승인(한도 조정 가능)·반려 → 승인 즉시 워크스페이스 생성, 신청자 소속 등록
 * 포털의 정식 자원 요청 관리(대전팀)가 실제로 구현되면 승인은 그쪽으로 옮긴다. */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CheckCircle2, Clock, Inbox, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KF_BASE, KF_ENABLED } from "@/lib/kf";
import { ensureBackendSession, useAuth } from "@/lib/auth";

type Status = "pending" | "approved" | "rejected" | "cancelled";
interface Resources { cpu: number; memoryGi: number; acceleratorCount: number; storageGi: number }
export interface WorkspaceRequest {
  id: string;
  name: string;
  purpose: string;
  requester: string;
  ownerEmail: string;
  resources: Resources;
  status: Status;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string;
}

const NAME_RE = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureBackendSession();   // 포털 로그인은 됐는데 백엔드 세션만 없는 경우 조용히 재발급
  const res = await fetch(`${KF_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useWorkspaceRequests() {
  const user = useAuth((s) => s.user);
  return useQuery({
    queryKey: ["ws-requests", user?.username],
    queryFn: () => call<{ items: WorkspaceRequest[]; pending: number }>("/api/v1/workspace-requests"),
    enabled: KF_ENABLED && !!user,
    refetchInterval: 15000,
    retry: false,
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["ws-requests"] });
    qc.invalidateQueries({ queryKey: ["kf", "profiles"] });
    qc.invalidateQueries({ queryKey: ["auth", "me"] });
  };
}

const STATUS: Record<Status, { label: string; variant: "warning" | "success" | "destructive" | "ghost"; icon: React.ElementType }> = {
  pending: { label: "승인 대기", variant: "warning", icon: Clock },
  approved: { label: "승인·생성됨", variant: "success", icon: CheckCircle2 },
  rejected: { label: "반려", variant: "destructive", icon: XCircle },
  cancelled: { label: "취소", variant: "ghost", icon: Ban },
};

function resText(r: Resources) {
  return `vCPU ${r.cpu} · 메모리 ${r.memoryGi}GB · 가속기 ${r.acceleratorCount}장 · 저장 ${r.storageGi}GB`;
}

/* ── 신청 창 (일반 사용자) ─────────────────────────────────── */
export function WorkspaceRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useAuth((s) => s.user);
  const refresh = useRefresh();
  const [name, setName] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [cpu, setCpu] = React.useState("4");
  const [mem, setMem] = React.useState("16");
  const [acc, setAcc] = React.useState("1");
  const [sto, setSto] = React.useState("50");

  const submit = useMutation({
    mutationFn: () =>
      call<WorkspaceRequest>("/api/v1/workspace-requests", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          purpose,
          ownerEmail: user?.email,
          cpu: Number(cpu),
          memoryGi: Number(mem),
          acceleratorCount: Number(acc),
          storageGi: Number(sto),
        }),
      }),
    onSuccess: (r) => {
      toast.success(`"${r.name}" 워크스페이스를 신청했습니다 — 관리자가 승인하면 바로 만들어집니다`);
      refresh();
      onOpenChange(false);
      setName("");
      setPurpose("");
    },
    onError: (e: Error) => toast.error(`신청 실패: ${e.message}`),
  });

  const nameOk = NAME_RE.test(name.trim());
  const numsOk = [cpu, mem, sto].every((v) => Number(v) > 0) && Number(acc) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>워크스페이스 신청</DialogTitle>
          <DialogDescription>
            워크스페이스는 프로젝트와 1:1입니다. 관리자가 승인하면 같은 이름으로 바로 만들어지고, 내 프로젝트 목록에 추가됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="wr-name">워크스페이스 이름 (= 프로젝트 이름)</Label>
            <Input id="wr-name" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="예: vision-team (영문 소문자·숫자·하이픈)" aria-invalid={!!name && !nameOk} />
            {name && !nameOk && (
              <p className="mt-1 text-[11px] text-rose-600">영문 소문자·숫자·하이픈(-)만, 63자 이내로 적어 주세요</p>
            )}
          </div>
          <div>
            <Label htmlFor="wr-purpose">사용 목적</Label>
            <Input id="wr-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}
                   placeholder="예: DM코드 판독 모델 학습·배포" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><Label>vCPU</Label><Input type="number" min={1} value={cpu} onChange={(e) => setCpu(e.target.value)} /></div>
            <div><Label>메모리 (GB)</Label><Input type="number" min={1} value={mem} onChange={(e) => setMem(e.target.value)} /></div>
            <div><Label>가속기 (장)</Label><Input type="number" min={0} value={acc} onChange={(e) => setAcc(e.target.value)} /></div>
            <div><Label>저장 (GB)</Label><Input type="number" min={1} value={sto} onChange={(e) => setSto(e.target.value)} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            적은 값은 워크스페이스가 쓸 수 있는 최대 한도입니다. 관리자가 승인하면서 조정할 수 있습니다.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => submit.mutate()} disabled={!nameOk || !numsOk || submit.isPending}>
            <Send className="size-4" /> {submit.isPending ? "신청 중…" : "신청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── 승인 창 (관리자) ──────────────────────────────────────── */
function ApproveDialog({ req, onClose }: { req: WorkspaceRequest | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [cpu, setCpu] = React.useState("");
  const [mem, setMem] = React.useState("");
  const [acc, setAcc] = React.useState("");
  const [sto, setSto] = React.useState("");
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (!req) return;
    setCpu(String(req.resources.cpu));
    setMem(String(req.resources.memoryGi));
    setAcc(String(req.resources.acceleratorCount));
    setSto(String(req.resources.storageGi));
    setNote("");
  }, [req]);

  const approve = useMutation({
    mutationFn: () =>
      call<WorkspaceRequest>(`/api/v1/workspace-requests/${req!.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          cpu: Number(cpu), memoryGi: Number(mem), acceleratorCount: Number(acc), storageGi: Number(sto), note,
        }),
      }),
    onSuccess: (r) => {
      toast.success(`"${r.name}" 승인 — 워크스페이스를 만드는 중입니다 (1분 안에 목록에 나타남)`);
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(`승인 실패: ${e.message}`),
  });
  const numsOk = [cpu, mem, sto].every((v) => Number(v) > 0) && Number(acc) >= 0;

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>승인 — {req?.name}</DialogTitle>
          <DialogDescription>
            승인하면 워크스페이스가 바로 만들어지고 신청자({req?.requester})의 프로젝트 목록에 추가됩니다. 한도는 여기서 조정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        {req?.purpose && <p className="rounded-md bg-secondary/40 p-2 text-xs">목적: {req.purpose}</p>}
        <div className="grid grid-cols-4 gap-2">
          <div><Label>vCPU</Label><Input type="number" min={1} value={cpu} onChange={(e) => setCpu(e.target.value)} /></div>
          <div><Label>메모리 (GB)</Label><Input type="number" min={1} value={mem} onChange={(e) => setMem(e.target.value)} /></div>
          <div><Label>가속기 (장)</Label><Input type="number" min={0} value={acc} onChange={(e) => setAcc(e.target.value)} /></div>
          <div><Label>저장 (GB)</Label><Input type="number" min={1} value={sto} onChange={(e) => setSto(e.target.value)} /></div>
        </div>
        <div>
          <Label htmlFor="wr-note">메모 (선택)</Label>
          <Input id="wr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 가속기는 1장으로 조정" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={() => approve.mutate()} disabled={!numsOk || approve.isPending}>
            <CheckCircle2 className="size-4" /> {approve.isPending ? "승인 중…" : "승인하고 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── 반려 창 (관리자) ──────────────────────────────────────── */
function RejectDialog({ req, onClose }: { req: WorkspaceRequest | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [reason, setReason] = React.useState("");
  React.useEffect(() => setReason(""), [req]);
  const reject = useMutation({
    mutationFn: () =>
      call<WorkspaceRequest>(`/api/v1/workspace-requests/${req!.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (r) => {
      toast.success(`"${r.name}" 신청을 반려했습니다`);
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(`반려 실패: ${e.message}`),
  });
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>반려 — {req?.name}</DialogTitle>
          <DialogDescription>반려 사유는 신청자 화면에 그대로 보입니다.</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="wr-reason">반려 사유</Label>
          <Input id="wr-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder="예: 가속기 여유가 없어 다음 주에 다시 신청해 주세요" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button variant="destructive" onClick={() => reject.mutate()} disabled={!reason.trim() || reject.isPending}>
            <XCircle className="size-4" /> {reject.isPending ? "처리 중…" : "반려"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── 신청 목록 (관리자: 전체·승인/반려, 사용자: 내 신청·취소) ─────── */
export function WorkspaceRequestsPanel({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading, isError, error } = useWorkspaceRequests();
  const refresh = useRefresh();
  const [approving, setApproving] = React.useState<WorkspaceRequest | null>(null);
  const [rejecting, setRejecting] = React.useState<WorkspaceRequest | null>(null);
  const cancel = useMutation({
    mutationFn: (id: string) => call<WorkspaceRequest>(`/api/v1/workspace-requests/${id}`, { method: "DELETE" }),
    onSuccess: (r) => { toast.success(`"${r.name}" 신청을 취소했습니다`); refresh(); },
    onError: (e: Error) => toast.error(`취소 실패: ${e.message}`),
  });
  if (!KF_ENABLED) return null;

  const items = data?.items ?? [];
  // 관리자는 대기 중인 것이 없으면 최근 5건만, 사용자는 자기 신청 전부
  const shown = isAdmin ? items.filter((r, i) => r.status === "pending" || i < 5) : items;
  const pending = data?.pending ?? 0;
  if (!isAdmin && !isLoading && !isError && items.length === 0) return null;

  return (
    <Card className={pending > 0 && isAdmin ? "border-amber-300" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="size-4 text-brand-indigo-600" />
          {isAdmin ? "워크스페이스 신청" : "내 워크스페이스 신청"}
          {pending > 0 && <Badge variant="warning">승인 대기 {pending}건</Badge>}
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? "사용자가 신청한 워크스페이스입니다. 승인하면 바로 만들어지고 신청자의 프로젝트 목록에 추가됩니다."
            : "승인되면 워크스페이스가 만들어지고 화면 왼쪽 위 프로젝트 목록에 추가됩니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isError && (
          <div className="px-5 py-4 text-xs text-rose-700">신청 목록을 불러오지 못했습니다: {(error as Error).message}</div>
        )}
        {isLoading && <div className="px-5 py-4 text-xs text-muted-foreground">불러오는 중…</div>}
        {!isLoading && !isError && shown.length === 0 && (
          <div className="px-5 py-4 text-xs text-muted-foreground">신청 내역이 없습니다.</div>
        )}
        {shown.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>신청 일시</TableHead>
                <TableHead>워크스페이스</TableHead>
                {isAdmin && <TableHead>신청자</TableHead>}
                <TableHead>요청 자원</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const s = STATUS[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{r.createdAt}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold">{r.name}</div>
                      {r.purpose && <div className="max-w-[220px] truncate text-[11px] text-muted-foreground">{r.purpose}</div>}
                    </TableCell>
                    {isAdmin && <TableCell className="text-xs">{r.requester}</TableCell>}
                    <TableCell className="whitespace-nowrap text-[11px]">{resText(r.resources)}</TableCell>
                    <TableCell>
                      <Badge variant={s.variant} className="gap-1 text-[10px]"><s.icon className="size-3" />{s.label}</Badge>
                      {r.status !== "pending" && r.decidedAt && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {r.decidedBy} · {r.decidedAt.slice(5, 16)}{r.reason ? ` · ${r.reason}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && isAdmin && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => setApproving(r)}>승인</Button>
                          <Button size="sm" variant="outline" onClick={() => setRejecting(r)}>반려</Button>
                        </div>
                      )}
                      {r.status === "pending" && !isAdmin && (
                        <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>
                          신청 취소
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ApproveDialog req={approving} onClose={() => setApproving(null)} />
      <RejectDialog req={rejecting} onClose={() => setRejecting(null)} />
    </Card>
  );
}
