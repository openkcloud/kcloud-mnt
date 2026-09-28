"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import {
  Shield, Plus, Search, MoreVertical, Trash2, Edit, Copy, Download, ArrowDown, ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";

type Direction = "ingress" | "egress";
type Proto = "TCP" | "UDP" | "ICMP" | "ALL";

interface SGRule {
  id: string;
  direction: Direction;
  proto: Proto;
  portRange: string;
  cidr: string;
  desc: string;
}

interface SecurityGroup {
  id: string;
  name: string;
  project: string;
  rules: SGRule[];
  attachedTo: number;
  createdAt: string;
}

const INITIAL: SecurityGroup[] = [
  {
    id: "sg-001",
    name: "default",
    project: "proj-ai-research",
    rules: [
      { id: "r-1", direction: "egress", proto: "ALL", portRange: "-", cidr: "0.0.0.0/0", desc: "모든 아웃바운드 허용" },
      { id: "r-2", direction: "ingress", proto: "TCP", portRange: "22", cidr: "10.0.0.0/8", desc: "관리자 SSH" },
    ],
    attachedTo: 12,
    createdAt: "2026-04-11",
  },
  {
    id: "sg-002",
    name: "web-tier",
    project: "proj-llm-serving",
    rules: [
      { id: "r-1", direction: "ingress", proto: "TCP", portRange: "80", cidr: "0.0.0.0/0", desc: "HTTP" },
      { id: "r-2", direction: "ingress", proto: "TCP", portRange: "443", cidr: "0.0.0.0/0", desc: "HTTPS" },
      { id: "r-3", direction: "egress", proto: "ALL", portRange: "-", cidr: "0.0.0.0/0", desc: "아웃바운드" },
    ],
    attachedTo: 5,
    createdAt: "2026-05-02",
  },
  {
    id: "sg-003",
    name: "inference-node",
    project: "proj-llm-serving",
    rules: [
      { id: "r-1", direction: "ingress", proto: "TCP", portRange: "8000-8080", cidr: "172.16.0.0/12", desc: "vLLM API" },
      { id: "r-2", direction: "ingress", proto: "TCP", portRange: "9090", cidr: "10.10.0.0/16", desc: "Prometheus scrape" },
      { id: "r-3", direction: "egress", proto: "TCP", portRange: "443", cidr: "0.0.0.0/0", desc: "HuggingFace 모델 다운로드" },
    ],
    attachedTo: 8,
    createdAt: "2026-05-15",
  },
  {
    id: "sg-004",
    name: "k8s-control-plane",
    project: "proj-platform-ops",
    rules: [
      { id: "r-1", direction: "ingress", proto: "TCP", portRange: "6443", cidr: "10.10.0.0/16", desc: "kube-apiserver" },
      { id: "r-2", direction: "ingress", proto: "TCP", portRange: "2379-2380", cidr: "10.10.1.0/24", desc: "etcd" },
      { id: "r-3", direction: "ingress", proto: "TCP", portRange: "10250", cidr: "10.10.0.0/16", desc: "kubelet" },
    ],
    attachedTo: 3,
    createdAt: "2026-03-20",
  },
];

export default function SecurityGroupsPage() {
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [items, setItems] = React.useState<SecurityGroup[]>(INITIAL);
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<SecurityGroup | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const filtered = items.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  const totals = {
    total: items.length,
    rules: items.reduce((s, x) => s + x.rules.length, 0),
    attached: items.reduce((s, x) => s + x.attachedTo, 0),
  };

  return (
    <div className="space-y-6">
      <ChangeMark ids={["CR-IAAS-06"]}>
      <PageHeader
        title="보안 그룹"
        description={isAdmin ? "OpenStack Neutron 보안 그룹 — 규칙 생성·수정·삭제는 관리자 권한" : "OpenStack Neutron 보안 그룹 — 관리자가 만든 보안 그룹을 VM 신청 시 선택한다. 생성·수정은 관리자 권한"}
        actions={
          isAdmin && <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 보안 그룹 생성
          </Button>
        }
      />
      </ChangeMark>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="보안 그룹" value={totals.total} unit="개" icon={Shield} accent="indigo" />
        <StatCard label="전체 규칙" value={totals.rules} unit="건" icon={ArrowDown} accent="mint" />
        <StatCard label="적용된 인스턴스" value={totals.attached} unit="대" icon={Shield} accent="amber" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="보안 그룹 이름 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length}/{items.length}개 표시
          </span>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>프로젝트</TableHead>
              <TableHead className="text-center">규칙 수</TableHead>
              <TableHead className="text-center">적용 인스턴스</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((sg) => (
              <TableRow key={sg.id} className="cursor-pointer" onClick={() => setSelected(sg)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="size-3.5 text-brand-indigo-600" />
                    <span className="font-medium">{sg.name}</span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">{sg.id}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{sg.project}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="ghost">
                    <ArrowDown className="size-2.5 text-brand-mint-600" />
                    {sg.rules.filter((r) => r.direction === "ingress").length}
                    <span className="mx-1 text-muted-foreground">·</span>
                    <ArrowUp className="size-2.5 text-rose-600" />
                    {sg.rules.filter((r) => r.direction === "egress").length}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono">{sg.attachedTo}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{sg.createdAt}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(sg)}>
                        <Edit className="size-3.5" /> 편집
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const clone = { ...sg, id: `sg-${Date.now()}`, name: `${sg.name}-copy`, attachedTo: 0 };
                          setItems((prev) => [...prev, clone]);
                          toast.success(`${sg.name} 복제됨`);
                        }}
                      >
                        <Copy className="size-3.5" /> 복제
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${sg.name} YAML 다운로드`)}>
                        <Download className="size-3.5" /> YAML 내보내기
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-600"
                        onClick={() => {
                          if (sg.attachedTo > 0) {
                            toast.error(`${sg.name} 삭제 거부됨 — ${sg.attachedTo}개 인스턴스에 적용 중`);
                            return;
                          }
                          setItems((prev) => prev.filter((x) => x.id !== sg.id));
                          toast.success(`${sg.name} 삭제됨`);
                        }}
                      >
                        <Trash2 className="size-3.5" /> 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <SGDetailSheet
        sg={selected}
        onClose={() => setSelected(null)}
        onUpdate={(updated) => {
          setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        }}
      />

      <CreateSGDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(sg) => {
          setItems((prev) => [...prev, sg]);
          toast.success(`${sg.name} 생성됨`);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 상세 Sheet — 규칙 CRUD
// ─────────────────────────────────────────────────────────────
function SGDetailSheet({
  sg, onClose, onUpdate,
}: {
  sg: SecurityGroup | null;
  onClose: () => void;
  onUpdate: (sg: SecurityGroup) => void;
}) {
  const [addOpen, setAddOpen] = React.useState(false);

  if (!sg) return null;

  const removeRule = (rid: string) => {
    onUpdate({ ...sg, rules: sg.rules.filter((r) => r.id !== rid) });
    toast.success("규칙 삭제됨");
  };

  return (
    <>
      <Sheet open={!!sg} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-lg">{sg.name}</SheetTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{sg.id}</span>
              <span>·</span>
              <span className="font-mono">{sg.project}</span>
              <span>·</span>
              <span>{sg.attachedTo}개 인스턴스</span>
            </div>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">규칙 ({sg.rules.length})</div>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" /> 규칙 추가
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">방향</TableHead>
                    <TableHead className="w-16">프로토콜</TableHead>
                    <TableHead>포트</TableHead>
                    <TableHead>Remote CIDR</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sg.rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant={r.direction === "ingress" ? "success" : "warning"} className="text-[10px]">
                          {r.direction === "ingress" ? "IN" : "OUT"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.proto}</TableCell>
                      <TableCell className="font-mono text-xs">{r.portRange}</TableCell>
                      <TableCell className="font-mono text-xs">{r.cidr}</TableCell>
                      <TableCell className="text-xs">{r.desc}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeRule(r.id)}>
                          <Trash2 className="size-3.5 text-rose-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => toast.success(`${sg.name} 이름·설명 편집`)}>
              <Edit className="size-3.5" /> 정보 편집
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.success(`${sg.name} YAML 내보내기`)}>
              <Download className="size-3.5" /> YAML
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={() => {
                if (sg.attachedTo > 0) {
                  toast.error(`삭제 거부 — ${sg.attachedTo}개 인스턴스에 적용 중`);
                  return;
                }
                toast.success(`${sg.name} 삭제됨`);
                onClose();
              }}
            >
              <Trash2 className="size-3.5" /> 삭제
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AddRuleDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(rule) => {
          onUpdate({ ...sg, rules: [...sg.rules, { ...rule, id: `r-${Date.now()}` }] });
          toast.success("규칙 추가됨");
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 규칙 추가 다이얼로그
// ─────────────────────────────────────────────────────────────
function AddRuleDialog({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (r: Omit<SGRule, "id">) => void;
}) {
  const [direction, setDirection] = React.useState<Direction>("ingress");
  const [proto, setProto] = React.useState<Proto>("TCP");
  const [portRange, setPortRange] = React.useState("22");
  const [cidr, setCidr] = React.useState("0.0.0.0/0");
  const [desc, setDesc] = React.useState("");

  const submit = () => {
    onAdd({ direction, proto, portRange, cidr, desc });
    setPortRange("22");
    setCidr("0.0.0.0/0");
    setDesc("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>규칙 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>방향</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingress">Ingress (인바운드)</SelectItem>
                  <SelectItem value="egress">Egress (아웃바운드)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>프로토콜</Label>
              <Select value={proto} onValueChange={(v) => setProto(v as Proto)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["TCP", "UDP", "ICMP", "ALL"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>포트 범위 (예: 22, 8000-8080, - )</Label>
            <Input value={portRange} onChange={(e) => setPortRange(e.target.value)} />
          </div>
          <div>
            <Label>Remote CIDR</Label>
            <Input value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="0.0.0.0/0" />
          </div>
          <div>
            <Label>설명</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="이 규칙의 용도" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>추가</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 보안 그룹 생성 다이얼로그
// ─────────────────────────────────────────────────────────────
function CreateSGDialog({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (sg: SecurityGroup) => void;
}) {
  const [name, setName] = React.useState("");
  const [project, setProject] = React.useState("proj-ai-research");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      id: `sg-${Date.now()}`,
      name: name.trim(),
      project,
      rules: [
        { id: "r-default", direction: "egress", proto: "ALL", portRange: "-", cidr: "0.0.0.0/0", desc: "기본 아웃바운드 허용" },
      ],
      attachedTo: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>보안 그룹 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-security-group" />
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
          <p className="text-xs text-muted-foreground">
            생성 후 상세 화면에서 규칙(Ingress/Egress)을 추가할 수 있다.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
