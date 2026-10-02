"use client";
import * as React from "react";
import { Router as RouterIcon, Plus, Trash2, Edit, Globe, Network } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";

interface RouterInterface {
  id: string;
  subnetId: string;
  subnetCidr: string;
  ip: string;
}

interface StaticRoute {
  destinationCidr: string;
  nextHop: string;
}

interface RouterEntity {
  id: string;
  name: string;
  project: string;
  externalNetwork: string;
  externalIp: string;
  status: "ACTIVE" | "DOWN";
  interfaces: RouterInterface[];
  staticRoutes: StaticRoute[];
  createdAt: string;
}

const INITIAL: RouterEntity[] = [
  {
    id: "rtr-001",
    name: "dj-z1-edge-router",
    project: "proj-ai-research",
    externalNetwork: "public-ext",
    externalIp: "220.76.193.12",
    status: "ACTIVE",
    interfaces: [
      { id: "if-1", subnetId: "sub-mgmt-1", subnetCidr: "10.10.0.0/24", ip: "10.10.0.1" },
      { id: "if-2", subnetId: "sub-svc-1", subnetCidr: "172.16.0.0/24", ip: "172.16.0.1" },
    ],
    staticRoutes: [
      { destinationCidr: "192.168.100.0/24", nextHop: "10.10.0.254" },
    ],
    createdAt: "2026-03-11",
  },
  {
    id: "rtr-002",
    name: "pg-z1-edge-router",
    project: "proj-llm-serving",
    externalNetwork: "public-ext",
    externalIp: "220.76.193.28",
    status: "ACTIVE",
    interfaces: [
      { id: "if-1", subnetId: "sub-svc-4", subnetCidr: "172.20.0.0/24", ip: "172.20.0.1" },
      { id: "if-2", subnetId: "sub-data-4", subnetCidr: "192.168.20.0/24", ip: "192.168.20.1" },
    ],
    staticRoutes: [],
    createdAt: "2026-04-05",
  },
  {
    id: "rtr-003",
    name: "internal-only-router",
    project: "proj-platform-ops",
    externalNetwork: "-",
    externalIp: "-",
    status: "DOWN",
    interfaces: [
      { id: "if-1", subnetId: "sub-mgmt-3", subnetCidr: "10.20.0.0/24", ip: "10.20.0.1" },
    ],
    staticRoutes: [],
    createdAt: "2026-05-01",
  },
];

export default function RoutersPage() {
  const [items, setItems] = React.useState<RouterEntity[]>(INITIAL);
  const [selected, setSelected] = React.useState<RouterEntity | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const totals = {
    total: items.length,
    active: items.filter((r) => r.status === "ACTIVE").length,
    interfaces: items.reduce((s, x) => s + x.interfaces.length, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="라우터"
        description="OpenStack Neutron L3 라우터 — 서브넷 간 라우팅과 외부망 연결 관리"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 라우터 생성
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="라우터" value={totals.total} unit="개" icon={RouterIcon} accent="indigo" />
        <StatCard label="ACTIVE" value={totals.active} unit="개" icon={Globe} accent="mint" />
        <StatCard label="연결된 서브넷" value={totals.interfaces} unit="개" icon={Network} accent="amber" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>프로젝트</TableHead>
              <TableHead>외부망</TableHead>
              <TableHead>External IP</TableHead>
              <TableHead className="text-center">서브넷</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <RouterIcon className="size-3.5 text-brand-indigo-600" />
                    <span className="font-medium">{r.name}</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">{r.id}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.project}</TableCell>
                <TableCell className="text-xs">{r.externalNetwork}</TableCell>
                <TableCell className="font-mono text-xs">{r.externalIp}</TableCell>
                <TableCell className="text-center font-mono">{r.interfaces.length}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(r)}>
                        <Edit className="size-3.5" /> 편집
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${r.name} ${r.status === "ACTIVE" ? "비활성화" : "활성화"}`)}>
                        {r.status === "ACTIVE" ? "비활성화" : "활성화"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-600"
                        onClick={() => {
                          if (r.interfaces.length > 0) {
                            toast.error(`삭제 거부 — ${r.interfaces.length}개 인터페이스 연결됨`);
                            return;
                          }
                          setItems((prev) => prev.filter((x) => x.id !== r.id));
                          toast.success(`${r.name} 삭제됨`);
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

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selected.name}</SheetTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{selected.id}</span>
                  <span>·</span>
                  <Badge variant={selected.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
                    {selected.status}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">외부망</div>
                    <div className="font-medium">{selected.externalNetwork}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">External IP</div>
                    <div className="font-mono">{selected.externalIp}</div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">인터페이스 ({selected.interfaces.length})</div>
                    <Button variant="outline" size="sm" onClick={() => toast.success("서브넷 연결 다이얼로그")}>
                      <Plus className="size-3.5" /> 서브넷 연결
                    </Button>
                  </div>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>서브넷</TableHead>
                          <TableHead>CIDR</TableHead>
                          <TableHead>Gateway IP</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.interfaces.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono text-xs">{i.subnetId}</TableCell>
                            <TableCell className="font-mono text-xs">{i.subnetCidr}</TableCell>
                            <TableCell className="font-mono text-xs">{i.ip}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon-sm" onClick={() => toast.success(`인터페이스 ${i.id} 해제`)}>
                                <Trash2 className="size-3.5 text-rose-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">정적 라우트 ({selected.staticRoutes.length})</div>
                    <Button variant="outline" size="sm" onClick={() => toast.success("정적 라우트 추가")}>
                      <Plus className="size-3.5" /> 라우트 추가
                    </Button>
                  </div>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Destination CIDR</TableHead>
                          <TableHead>Next Hop</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.staticRoutes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-xs text-muted-foreground">
                              등록된 정적 라우트 없음
                            </TableCell>
                          </TableRow>
                        )}
                        {selected.staticRoutes.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{r.destinationCidr}</TableCell>
                            <TableCell className="font-mono text-xs">{r.nextHop}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => toast.success(`${selected.name} 편집`)}>
                  <Edit className="size-3.5" /> 편집
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    if (selected.interfaces.length > 0) {
                      toast.error(`삭제 거부 — 인터페이스 먼저 해제`);
                      return;
                    }
                    toast.success(`${selected.name} 삭제됨`);
                    setSelected(null);
                  }}
                >
                  <Trash2 className="size-3.5" /> 삭제
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>라우터 생성</DialogTitle>
          </DialogHeader>
          <CreateRouterForm
            onCreate={(r) => {
              setItems((prev) => [...prev, r]);
              toast.success(`${r.name} 생성됨`);
              setCreateOpen(false);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateRouterForm({
  onCreate, onCancel,
}: {
  onCreate: (r: RouterEntity) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState("");
  const [project, setProject] = React.useState("proj-ai-research");
  const [external, setExternal] = React.useState("public-ext");

  return (
    <>
      <div className="space-y-3">
        <div>
          <Label>이름</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-router" />
        </div>
        <div>
          <Label>프로젝트</Label>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="proj-ai-research">proj-ai-research</SelectItem>
              <SelectItem value="proj-llm-serving">proj-llm-serving</SelectItem>
              <SelectItem value="proj-edge-inference">proj-edge-inference</SelectItem>
              <SelectItem value="proj-platform-ops">proj-platform-ops</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>외부망 (선택 사항 — 관리자만)</Label>
          <Select value={external} onValueChange={setExternal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public-ext">public-ext</SelectItem>
              <SelectItem value="-">내부 전용 (외부망 없음)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>취소</Button>
        <Button
          onClick={() => {
            if (!name.trim()) return;
            onCreate({
              id: `rtr-${Date.now()}`,
              name: name.trim(),
              project,
              externalNetwork: external,
              externalIp: external === "-" ? "-" : `220.76.193.${Math.floor(Math.random() * 200) + 30}`,
              status: "ACTIVE",
              interfaces: [],
              staticRoutes: [],
              createdAt: new Date().toISOString().slice(0, 10),
            });
          }}
        >
          생성
        </Button>
      </DialogFooter>
    </>
  );
}
