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
import { useProjects, useProject } from "@/lib/iaas-api";
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
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-md bg-brand-indigo-100 text-brand-indigo-700">
                      <FolderKanban className="size-4" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{t.description || "—"}</div>
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
          {selected && <ProjectDetailBody project={selected} isAdmin={isAdmin} />}
        </DialogContent>
      </Dialog>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ProjectDetailBody({ project, isAdmin }: { project: Tenant; isAdmin: boolean }) {
  // 선택된 프로젝트의 쿼터·사용량을 그때 조회 (목록에선 안 불러옴)
  const { data: detail, isLoading, isError } = useProject(project.id);
  const t = detail ?? project; // 로딩 중엔 목록 메타로 헤더 먼저 표시

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3 pr-8">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <FolderKanban className="size-5" />
          </div>
          <div className="flex-1">
            <DialogTitle className="font-mono text-lg">{t.name}</DialogTitle>
            <DialogDescription>{t.description || "—"}</DialogDescription>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{t.orgId || "—"}</Badge>
        </div>
      </DialogHeader>

      <div className="max-h-[70vh] overflow-y-auto">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="quota">쿼터</TabsTrigger>
            <TabsTrigger value="members">멤버 ({t.members})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 pt-3">
            <Card className="space-y-2 p-4 text-xs">
              <KV label="프로젝트 ID" value={t.id} mono />
              <KV label="이름" value={t.name} mono />
              <KV label="조직(도메인)" value={t.orgId || "—"} mono />
              <KV label="상태" value={t.enabled === false ? "비활성" : "활성"} />
              <KV label="설명" value={t.description || "—"} />
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
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 쿼터 변경 요청 — 승인 대기`)}>
                    <Edit className="size-3.5" /> 쿼터 변경 요청
                  </Button>
                )}
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
          <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 편집`)}><Edit className="size-3.5" /> 편집</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${t.name} 삭제 — 자원 정리 후 가능`)}><Trash2 className="size-3.5" /> 삭제</Button>
        </DialogFooter>
      )}
    </>
  );
}

function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [vcpu, setVcpu] = React.useState("64");
  const [ram, setRam] = React.useState("256");
  const [acc, setAcc] = React.useState("2");
  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`프로젝트 ${name} 생성됨`, { description: `vCPU ${vcpu} / RAM ${ram}GB / 가속기 ${acc}장` });
    onClose();
    setName(""); setDesc("");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로젝트 생성</DialogTitle>
          <DialogDescription>OpenStack Keystone Project + Kubeflow Profile 자동 생성</DialogDescription>
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>vCPU</Label>
                <Input type="number" value={vcpu} onChange={(e) => setVcpu(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>RAM (GB)</Label>
                <Input type="number" value={ram} onChange={(e) => setRam(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>가속기</Label>
                <Input type="number" value={acc} onChange={(e) => setAcc(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>생성</Button>
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

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-right" : "text-right"}>{value}</span>
    </div>
  );
}
