"use client";
import * as React from "react";
import {
  Users,
  FolderKanban,
  Edit,
  Trash2,
  Settings,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject } from "@/lib/iaas-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Tenant } from "@/lib/types";

const PAGE_SIZE = 20;

// 멤버는 포털 DB(MNT-CORE) 관리 예정 — OpenStack과 별개. 현재는 목업.
const MEMBERS: Record<string, { name: string; role: "admin" | "member" | "viewer"; email: string }[]> = {
  default: [
    { name: "윤호영", role: "admin", email: "hy.yun@okestro.com" },
    { name: "박의규", role: "member", email: "ek.park@okestro.com" },
    { name: "최현화", role: "member", email: "hhchoi@etri.re.kr" },
    { name: "김대원", role: "viewer", email: "dw.kim@etri.re.kr" },
  ],
};

const pct = (used: number, max: number) => (max > 0 ? Math.round((used / max) * 100) : 0);

export default function ProjectsPage() {
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const myEmail = useAuth((s) => s.user?.email ?? "");
  const { data, isLoading } = useProjects() as {
    data: { items: Tenant[]; live: boolean } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<Tenant | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [q]); // 검색 바뀌면 첫 페이지로

  if (isLoading || !data) return <Skeleton className="h-96" />;

  // 사용자는 자신이 속한 프로젝트만 (관리자는 전체) — 멤버십은 추후 MNT-CORE DB
  const mine = isAdmin
    ? data.items
    : data.items.filter((t) => (MEMBERS[t.id] ?? MEMBERS.default).some((m) => m.email === myEmail));
  const filtered = mine.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const pageItems = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="프로젝트 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">총 {filtered.length}개</span>
          {isAdmin && (
            <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> 프로젝트 생성
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>프로젝트</TableHead>
              <TableHead>조직(도메인)</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>멤버</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer"
                onClick={() => setSelected(t)}
              >
                <TableCell className="max-w-[360px]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-indigo-100 text-brand-indigo-700">
                      <FolderKanban className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.description || "—"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.orgId || "—"}</TableCell>
                <TableCell>
                  <Badge variant={t.enabled === false ? "outline" : "success"}>
                    {t.enabled === false ? "비활성" : "활성"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="size-3.5" />{t.members}</span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(t)}>
                    <Settings className="size-3.5" /> {isAdmin ? "관리" : "보기"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  프로젝트가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="tabular-nums">{cur} / {totalPages}</span>
              <Button variant="outline" size="icon-sm" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 상세 — 가운데 모달. 쿼터는 여기서 on-demand 라이브 조회 */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(undefined)}>
        <DialogContent className="max-w-3xl">
          {selected && (
            <ProjectDetailBody
              project={selected}
              isAdmin={isAdmin}
              onClose={() => setSelected(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ProjectDetailBody({ project, isAdmin, onClose }: { project: Tenant; isAdmin: boolean; onClose: () => void }) {
  // 선택된 프로젝트의 쿼터·사용량을 그때 조회 (목록에선 안 불러옴)
  const { data: detail, isLoading, isError } = useProject(project.id);
  const t = detail ?? project; // 로딩 중엔 목록 메타로 헤더 먼저 표시
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <>
      <DialogHeader className="min-w-0">
        <div className="flex items-center gap-3 pr-8">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <FolderKanban className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate font-mono text-lg">{t.name}</DialogTitle>
            <DialogDescription className="truncate">{t.description || "—"}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="max-h-[70vh] min-w-0 overflow-y-auto">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="quota">쿼터</TabsTrigger>
            <TabsTrigger value="members">멤버 ({t.members})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 pt-3">
            <Card className="space-y-2.5 p-4 text-xs">
              <KV label="프로젝트 ID" value={t.id} mono />
              <KV label="이름" value={t.name} mono />
              <KV label="조직(도메인)" value={t.orgId || "—"} mono />
              <KV
                label="상태"
                value={
                  <Badge variant={t.enabled === false ? "outline" : "success"}>
                    {t.enabled === false ? "비활성" : "활성"}
                  </Badge>
                }
              />
              <div className="space-y-1.5">
                <span className="text-muted-foreground">설명</span>
                <div className="h-24 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 leading-relaxed">
                  {t.description || "—"}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="quota" className="space-y-3 pt-3">
            {isLoading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> OpenStack 쿼터 조회 중…
              </div>
            ) : isError ? (
              <div className="p-6 text-sm text-rose-600">쿼터 조회 실패 (OpenStack 연결 확인)</div>
            ) : (
              <>
                <Card className="space-y-3 p-4">
                  <QuotaRow label="vCPU" used={t.usedVcpu} max={t.quotaVcpu} unit="cores" />
                  <QuotaRow label="메모리" used={t.usedRamGb} max={t.quotaRamGb} unit="GB" />
                  <QuotaRow label="디스크" used={t.usedDiskTb} max={t.quotaDiskTb} unit="TB" />
                  <QuotaRow label="AI 가속기" used={t.usedAcc} max={t.quotaAcc} unit="장" />
                </Card>
                <p className="text-[11px] text-muted-foreground">
                  * 쿼터·사용량은 OpenStack(Nova·Cinder) 실시간 조회. AI 가속기는 Cyborg 연동 시 반영.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="members" className="pt-3">
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <Users className="size-8 text-muted-foreground/40" />
              <div className="text-sm text-muted-foreground">멤버 정보 준비 중</div>
              <p className="max-w-sm text-[11px] text-muted-foreground">
                프로젝트 멤버는 포털(MNT-CORE)에서 관리합니다 — OpenStack 멤버와 별개.
                멤버 관리 기능 연동 후 표시됩니다.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {isAdmin && (
        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Edit className="size-3.5" /> 편집</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirmOpen(true)}><Trash2 className="size-3.5" /> 삭제</Button>
        </DialogFooter>
      )}

      {isAdmin && (
        <>
          <EditProjectDialog project={t} open={editOpen} onClose={() => setEditOpen(false)} />
          <DeleteProjectDialog
            project={t}
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onDeleted={() => { setConfirmOpen(false); onClose(); }}
          />
        </>
      )}
    </>
  );
}

function EditProjectDialog({ project, open, onClose }: { project: Tenant; open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState(project.name);
  const [desc, setDesc] = React.useState(project.description);
  const [enabled, setEnabled] = React.useState(project.enabled !== false);
  const [vcpu, setVcpu] = React.useState(String(project.quotaVcpu));
  const [ram, setRam] = React.useState(String(project.quotaRamGb));
  const [disk, setDisk] = React.useState(String(Math.round(project.quotaDiskTb * 1024)));
  const update = useUpdateProject();

  // 다른 프로젝트로 모달이 다시 열릴 때 폼을 현재 값으로 초기화
  React.useEffect(() => {
    if (open) {
      setName(project.name);
      setDesc(project.description);
      setEnabled(project.enabled !== false);
      setVcpu(String(project.quotaVcpu));
      setRam(String(project.quotaRamGb));
      setDisk(String(Math.round(project.quotaDiskTb * 1024)));
    }
  }, [open, project]);

  function submit() {
    if (!name.trim()) return toast.error("이름을 입력하세요");
    update.mutate(
      {
        id: project.id,
        name: name.trim(),
        description: desc,
        enabled,
        quotaVcpu: Number(vcpu),
        quotaRamGb: Number(ram),
        quotaDiskGb: Number(disk),
      },
      {
        onSuccess: () => { toast.success(`${name} 수정됨`); onClose(); },
        onError: (e) => toast.error("수정 실패", { description: String((e as Error).message) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-mono">프로젝트 편집</DialogTitle>
          <DialogDescription>OpenStack Keystone 메타 + Nova/Cinder 쿼터 수정</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>프로젝트 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>설명</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="프로젝트 용도 설명" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 cursor-pointer" />
            활성 상태
          </label>
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 text-[10px] uppercase text-muted-foreground">쿼터</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>vCPU</Label>
                <Input type="number" value={vcpu} onChange={(e) => setVcpu(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>RAM (GB)</Label>
                <Input type="number" value={ram} onChange={(e) => setRam(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>디스크 (GB)</Label>
                <Input type="number" value={disk} onChange={(e) => setDisk(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">가속기</Label>
                <Input type="number" value="-1" disabled title="가속기 쿼터는 포털에서 관리 예정 (OpenStack 미지원)" />
                <p className="text-[10px] text-muted-foreground">포털 관리 예정 (OpenStack 쿼터 없음)</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>취소</Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({
  project, open, onClose, onDeleted,
}: { project: Tenant; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = React.useState("");
  const del = useDeleteProject();
  React.useEffect(() => { if (open) setConfirm(""); }, [open]);

  function submit() {
    del.mutate(project.id, {
      onSuccess: () => { toast.success(`프로젝트 ${project.name} 삭제됨`); onDeleted(); },
      onError: (e) => toast.error("삭제 실패", { description: String((e as Error).message) }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !del.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-rose-600">프로젝트 삭제</DialogTitle>
          <DialogDescription>
            이 작업은 되돌릴 수 없습니다. 프로젝트 안의 OpenStack 자원(가상서버·볼륨 등)은 사전에 정리되어 있어야 합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 text-sm">
          <p>
            삭제하려면 프로젝트 이름 <strong className="font-mono">{project.name}</strong> 을(를) 입력하세요.
          </p>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={project.name} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={del.isPending}>취소</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={del.isPending || confirm !== project.name}
          >
            {del.isPending ? "삭제 중…" : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [vcpu, setVcpu] = React.useState("8");
  const [ram, setRam] = React.useState("32");
  const [disk, setDisk] = React.useState("100");
  const acc = "-1"; // 가속기 쿼터는 OpenStack 미지원 → 비활성(-1, 포털 DB 관리 예정)
  const create = useCreateProject();

  function reset() { setName(""); setDesc(""); setVcpu("8"); setRam("32"); setDisk("100"); }

  function submit() {
    if (!name.trim()) return toast.error("이름을 입력하세요");
    create.mutate(
      {
        name: name.trim(),
        description: desc,
        quotaVcpu: Number(vcpu),
        quotaRamGb: Number(ram),
        quotaDiskGb: Number(disk),
        quotaAcc: -1,
      },
      {
        onSuccess: (t) => {
          toast.success(`프로젝트 ${t.name} 생성됨`, { description: `vCPU ${vcpu} / RAM ${ram}GB / Disk ${disk}GB` });
          reset();
          onClose();
        },
        onError: (e) => toast.error("프로젝트 생성 실패", { description: String((e as Error).message) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로젝트 생성</DialogTitle>
          <DialogDescription>OpenStack Keystone Project 생성</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>프로젝트 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" />
          </div>
          <div className="space-y-1.5">
            <Label>설명</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="프로젝트 용도 설명" />
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 text-[10px] uppercase text-muted-foreground">초기 쿼터</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>vCPU</Label>
                <Input type="number" value={vcpu} onChange={(e) => setVcpu(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>RAM (GB)</Label>
                <Input type="number" value={ram} onChange={(e) => setRam(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>디스크 (GB)</Label>
                <Input type="number" value={disk} onChange={(e) => setDisk(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">가속기</Label>
                <Input type="number" value={acc} disabled title="가속기 쿼터는 포털에서 관리 예정 (OpenStack 미지원)" />
                <p className="text-[10px] text-muted-foreground">포털 관리 예정 (OpenStack 쿼터 없음)</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>취소</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "생성 중…" : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotaRow({ label, used, max, unit }: { label: string; used: number; max: number; unit: string }) {
  const p = pct(used, max);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums">
          <strong>{used}</strong> / {max} {unit} ({p}%)
        </span>
      </div>
      <Progress value={p} indicatorClassName={p > 80 ? "bg-rose-500" : p > 60 ? "bg-amber-500" : "bg-brand-mint-500"} />
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "min-w-0 break-all text-right font-mono" : "min-w-0 break-words text-right"}>{value}</span>
    </div>
  );
}
