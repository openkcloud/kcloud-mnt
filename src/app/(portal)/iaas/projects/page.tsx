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
import { ChangeMark } from "@/components/change-mark";
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
import { useRouter } from "next/navigation";
import { useProjectContext } from "@/lib/project-context";
import { useFeatureVisible } from "@/lib/scope";
import { useProjectAIData } from "@/lib/project-ai-data";
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
  const { data, isLoading } = api.iaas.projects() as {
    data: { items: Tenant[] } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<Tenant | undefined>();
  const [initialTab, setInitialTab] = React.useState("overview");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  // ?open=<프로젝트 ID>&tab=<탭> 으로 상세 시트를 바로 연다 (AI 노트북 화면에서 넘어올 때). 가속기 쿼터가 없으면 AI 탭이 없다
  React.useEffect(() => {
    if (!data) return;
    const sp = new URLSearchParams(window.location.search);
    const t = data.items.find((x) => x.id === sp.get("open"));
    if (t) {
      const tab = sp.get("tab");
      setInitialTab(tab === "ai" && !t.quotaAcc ? "resources" : tab ?? "overview");
      setSelected(t);
    }
  }, [data]);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const items = data.items.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="프로젝트 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
          </div>
          <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> 프로젝트 생성
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((t) => {
          const cpuPct = Math.round((t.usedVcpu / t.quotaVcpu) * 100);
          const ramPct = Math.round((t.usedRamGb / t.quotaRamGb) * 100);
          const accPct = t.quotaAcc ? Math.round((t.usedAcc / t.quotaAcc) * 100) : 0;
          return (
            <Card key={t.id} className="cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" onClick={() => { setInitialTab("overview"); setSelected(t); }}>
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
                    <Button variant="ghost" size="sm" onClick={() => { setInitialTab("overview"); setSelected(t); }}>
                      <Settings className="size-3.5" /> 관리
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
          {selected && <ProjectDetailPanel key={selected.id + initialTab} project={selected} initialTab={initialTab} />}
        </SheetContent>
      </Sheet>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ProjectDetailPanel({ project: t, initialTab = "overview" }: { project: Tenant; initialTab?: string }) {
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
        <Tabs defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="quota">쿼터</TabsTrigger>
            <TabsTrigger value="members">멤버 ({t.members})</TabsTrigger>
            <TabsTrigger value="resources">자원</TabsTrigger>
            {t.quotaAcc > 0 && <TabsTrigger value="ai">AI 워크스페이스</TabsTrigger>}
          </TabsList>

          {t.quotaAcc > 0 && (
            <TabsContent value="ai" className="space-y-3 pt-3">
              <ChangeMark ids={["CR-IAAS-10"]}>
                <ProjectAIWorkspace project={t} />
              </ChangeMark>
            </TabsContent>
          )}

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
            <div className="flex justify-end">
              <Button size="sm" onClick={() => toast.success(`${t.name}에 멤버 초대 다이얼로그`)}>
                <UserPlus className="size-3.5" /> 멤버 초대
              </Button>
            </div>
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
                        <Button variant="ghost" size="icon-sm" onClick={() => toast.error(`${m.name} 제거`)}>
                          <Trash2 className="size-3.5" />
                        </Button>
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

        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 편집`)}><Edit className="size-3.5" /> 편집</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(`${t.name} 활동 로그`)}><Activity className="size-3.5" /> 감사 로그</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${t.name} 삭제 — 자원 정리 후 가능`)}><Trash2 className="size-3.5" /> 삭제</Button>
        </div>
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

/** 프로젝트가 받은 자원 안에서 AI 노트북이 쓰는 몫을 한 화면에서 보여준다 */
function ProjectAIWorkspace({ project: t }: { project: Tenant }) {
  const router = useRouter();
  const { setCurrent } = useProjectContext();
  // AI 노트북 자원 요약 — 실백엔드면 실제 워크스페이스 값 (src/lib/project-ai-data.ts)
  const ai = useProjectAIData(t);
  const nbs = ai.notebooks;
  const experimentsOn = useFeatureVisible("ai.experiments");
  const pct = (u: number, m: number) => (m > 0 ? Math.round((u / m) * 100) : 0);
  function open(path = "/ai-development") {
    setCurrent(t.name);
    router.push(path);
  }
  return (
    <>
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">워크스페이스 <span className="font-mono">{t.name}</span></div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Kubeflow Profile · 네임스페이스 <span className="font-mono">{t.name}</span> · 라벨{" "}
              <span className="font-mono">openkcloud.io/project-id={t.id}</span>
            </div>
          </div>
          <Badge variant={ai.missing ? "outline" : "success"} className="shrink-0">{ai.missing ? "미생성" : ai.status}</Badge>
        </div>
        <div className={`grid gap-2 rounded-lg bg-secondary/40 p-3 ${experimentsOn ? "grid-cols-4" : "grid-cols-3"}`}>
          <Stat label="노트북" value={`${nbs.length}`} />
          <Stat label="파이프라인" value={`${ai.pipelines}`} />
          {experimentsOn && <Stat label="실험" value={`${ai.experiments}`} />}
          <Stat label="서비스" value={`${ai.services}`} />
        </div>
        <div className="space-y-2.5">
          <QuotaRow label={`AI가 쓰는 가속기 (${ai.accBasis} 대비)`} used={ai.accUsed} max={ai.accMax} pct={pct(ai.accUsed, ai.accMax)} unit="장" />
          <QuotaRow label={ai.real ? "스토리지 (워크스페이스 쿼터 대비)" : "노트북 볼륨 (프로젝트 디스크 대비)"} used={ai.storageUsedTb} max={ai.storageMaxTb} pct={pct(ai.storageUsedTb, ai.storageMaxTb)} unit="TB" />
          {ai.missing && (
            <p className="text-[11px] text-muted-foreground">
              이 프로젝트 이름의 워크스페이스가 아직 없다. 프로젝트 승인 연동 전까지는 AI 노트북 › 워크스페이스에서 관리자가 만든다.
            </p>
          )}
        </div>
      </Card>
      <Card className="p-0">
        <div className="border-b border-border px-4 py-2.5 text-xs font-semibold">개발환경</div>
        <div className="divide-y divide-border">
          {nbs.map((n) => (
            <button key={n.id} type="button" onClick={() => open(`/ai-development/notebooks/${n.id}`)} className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs hover:bg-secondary/40">
              <span className="font-mono">{n.name}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {n.acceleratorCount > 0 ? `${n.acceleratorKind} ${n.acceleratorCount}` : "CPU"}
                <Badge variant={n.status === "Running" ? "success" : n.status === "Stopped" ? "outline" : "warning"} className="text-[10px]">{n.status}</Badge>
              </span>
            </button>
          ))}
          {!nbs.length && <div className="px-4 py-3 text-xs text-muted-foreground">노트북이 없다.</div>}
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => open()}>AI 개발환경에서 열기</Button>
        <Button size="sm" variant="outline" onClick={() => open("/ai-development/notebooks")}>새 노트북</Button>
      </div>
    </>
  );
}
