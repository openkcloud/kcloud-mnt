"use client";
import * as React from "react";
import {
  Users,
  FolderKanban,
  Edit,
  Trash2,
  Settings,
  UserPlus,
  Activity,
  Search,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Tenant } from "@/lib/types";

const MEMBERS: Record<string, { name: string; role: "admin" | "member" | "viewer"; email: string }[]> = {
  default: [
    { name: "윤호영", role: "admin", email: "hy.yun@okestro.com" },
    { name: "박의규", role: "member", email: "ek.park@okestro.com" },
    { name: "최현화", role: "member", email: "hhchoi@etri.re.kr" },
    { name: "김대원", role: "viewer", email: "dw.kim@etri.re.kr" },
  ],
};

export default function ProjectsPage() {
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const myEmail = useAuth((s) => s.user?.email ?? "");
  const { data, isLoading } = api.iaas.projects() as {
    data: { items: Tenant[] } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<Tenant | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  if (isLoading || !data) return <Skeleton className="h-96" />;
  // 사용자는 자신이 속한 프로젝트만 (관리자는 전체)
  const mine = isAdmin
    ? data.items
    : data.items.filter((t) => (MEMBERS[t.id] ?? MEMBERS.default).some((m) => m.email === myEmail));
  const items = mine.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="프로젝트 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
          </div>
          {isAdmin && (
            <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> 프로젝트 생성
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((t) => {
          const cpuPct = Math.round((t.usedVcpu / t.quotaVcpu) * 100);
          const ramPct = Math.round((t.usedRamGb / t.quotaRamGb) * 100);
          const accPct = t.quotaAcc ? Math.round((t.usedAcc / t.quotaAcc) * 100) : 0;
          return (
            <Card key={t.id} className="cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" onClick={() => setSelected(t)}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
                      <FolderKanban className="size-5" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold hover:text-primary">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">{t.orgId}</Badge>
                </div>

                <div className="grid grid-cols-4 gap-2 rounded-lg bg-secondary/40 p-3">
                  <Stat label="vCPU" value={`${t.usedVcpu}/${t.quotaVcpu}`} pct={cpuPct} />
                  <Stat label="RAM (GB)" value={`${t.usedRamGb}/${t.quotaRamGb}`} pct={ramPct} />
                  <Stat label="Disk (TB)" value={`${t.usedDiskTb}/${t.quotaDiskTb}`} />
                  <Stat label="AI반도체" value={`${t.usedAcc}/${t.quotaAcc}`} pct={accPct} />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    <strong className="text-foreground">{t.members}</strong>명 참여
                  </span>
                  <span>생성 {t.createdAt}</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(t); }}>
                      <Settings className="size-3.5" /> {isAdmin ? "관리" : "보기"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && <ProjectDetailPanel project={selected} isAdmin={isAdmin} />}
        </SheetContent>
      </Sheet>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ProjectDetailPanel({ project: t, isAdmin }: { project: Tenant; isAdmin: boolean }) {
  const cpuPct = Math.round((t.usedVcpu / t.quotaVcpu) * 100);
  const ramPct = Math.round((t.usedRamGb / t.quotaRamGb) * 100);
  const accPct = t.quotaAcc ? Math.round((t.usedAcc / t.quotaAcc) * 100) : 0;
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <FolderKanban className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg font-mono">{t.name}</SheetTitle>
            <SheetDescription>{t.description}</SheetDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">{t.orgId}</Badge>
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="quota">쿼터</TabsTrigger>
            <TabsTrigger value="members">멤버 ({t.members})</TabsTrigger>
            <TabsTrigger value="resources">자원</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 pt-3">
            <Card className="space-y-2 p-4 text-xs">
              <KV label="프로젝트 ID" value={t.id} mono />
              <KV label="이름" value={t.name} mono />
              <KV label="조직" value={t.orgId} mono />
              <KV label="생성일" value={t.createdAt} />
              <KV label="멤버 수" value={t.members.toString()} />
              <KV label="설명" value={t.description} />
            </Card>
          </TabsContent>

          <TabsContent value="quota" className="space-y-3 pt-3">
            <Card className="space-y-3 p-4">
              <QuotaRow label="vCPU" used={t.usedVcpu} max={t.quotaVcpu} pct={cpuPct} unit="cores" />
              <QuotaRow label="메모리" used={t.usedRamGb} max={t.quotaRamGb} pct={ramPct} unit="GB" />
              <QuotaRow label="디스크" used={t.usedDiskTb} max={t.quotaDiskTb} pct={Math.round(t.usedDiskTb / t.quotaDiskTb * 100)} unit="TB" />
              <QuotaRow label="AI 가속기" used={t.usedAcc} max={t.quotaAcc} pct={accPct} unit="장" />
            </Card>
            <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 쿼터 변경 요청 — 승인 대기`)}>
              <Edit className="size-3.5" /> 쿼터 변경 요청
            </Button>
          </TabsContent>

          <TabsContent value="members" className="space-y-2 pt-3">
            {isAdmin && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => toast.success(`${t.name}에 멤버 초대 다이얼로그`)}>
                  <UserPlus className="size-3.5" /> 멤버 초대
                </Button>
              </div>
            )}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MEMBERS.default.map((m) => (
                    <TableRow key={m.email}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="bg-brand-indigo-100 text-[10px] text-brand-indigo-700">{m.name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.role === "admin" ? "default" : m.role === "member" ? "success" : "outline"}>{m.role}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{m.email}</TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button variant="ghost" size="icon-sm" onClick={() => toast.error(`${m.name} 제거`)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-2 pt-3">
            <Card className="p-4 text-xs space-y-1.5">
              <div className="font-semibold mb-1">현재 자원</div>
              <KV label="가상서버" value={`${Math.round(t.usedVcpu / 8)} 대`} />
              <KV label="볼륨" value="14 개" />
              <KV label="네트워크" value="3 개" />
              <KV label="Floating IP" value="2 / 5" />
              <KV label="K8s 클러스터" value="1 개" />
              <KV label="Profile (Kubeflow)" value={`${t.name} (active)`} />
            </Card>
          </TabsContent>
        </Tabs>

        {isAdmin && (
          <div className="flex gap-2 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 편집`)}><Edit className="size-3.5" /> 편집</Button>
            <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 활동 로그`)}><Activity className="size-3.5" /> 감사 로그</Button>
            <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${t.name} 삭제 — 자원 정리 후 가능`)}><Trash2 className="size-3.5" /> 삭제</Button>
          </div>
        )}
      </div>
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

function Stat({ label, value, pct }: { label: string; value: string; pct?: number }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
      {pct !== undefined && (
        <Progress value={pct} className="h-1" indicatorClassName={pct > 80 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-brand-mint-500"} />
      )}
    </div>
  );
}

function QuotaRow({ label, used, max, pct, unit }: { label: string; used: number; max: number; pct: number; unit: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums">
          <strong>{used}</strong> / {max} {unit} ({pct}%)
        </span>
      </div>
      <Progress value={pct} indicatorClassName={pct > 80 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-brand-mint-500"} />
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
