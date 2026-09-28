"use client";
import * as React from "react";
import { ChangeMark } from "@/components/change-mark";
import {
  Database,
  HardDrive,
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Camera,
  Download,
  MoreVertical,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PVC = {
  id: string; name: string; namespace: string; status: "Bound" | "Pending"; volume: string; capacity: string; access: "RWO" | "RWX" | "ROX"; storageClass: string; age: string;
};
type PV = {
  name: string; capacity: string; access: string; reclaim: string; status: string; claim: string; storageClass: string; age: string; source: string;
};
type StorageClass = {
  name: string; provisioner: string; reclaim: string; binding: string; default: boolean; params: string;
};

const STORAGE_CLASSES: StorageClass[] = [
  { name: "nvme-fast-rwo", provisioner: "csi.openstack.org", reclaim: "Delete", binding: "WaitForFirstConsumer", default: true, params: "type=nvme-ssd, iops=10000" },
  { name: "ssd-balanced-rwo", provisioner: "csi.openstack.org", reclaim: "Delete", binding: "WaitForFirstConsumer", default: false, params: "type=ssd, iops=5000" },
  { name: "hdd-archive-rwo", provisioner: "csi.openstack.org", reclaim: "Retain", binding: "Immediate", default: false, params: "type=hdd" },
  { name: "nfs-shared-rwx", provisioner: "nfs.csi.k8s.io", reclaim: "Retain", binding: "Immediate", default: false, params: "server=nfs.openkcloud.local" },
];

const PVCS: PVC[] = [
  { id: "pvc-1", name: "vllm-solar-cache", namespace: "llm-serving", status: "Bound", volume: "pv-001", capacity: "100Gi", access: "RWO", storageClass: "nvme-fast-rwo", age: "12d" },
  { id: "pvc-2", name: "research-llama-data", namespace: "ai-research", status: "Bound", volume: "pv-002", capacity: "500Gi", access: "RWO", storageClass: "nvme-fast-rwo", age: "23d" },
  { id: "pvc-3", name: "research-notebook-vol", namespace: "ai-research", status: "Bound", volume: "pv-003", capacity: "200Gi", access: "RWO", storageClass: "ssd-balanced-rwo", age: "18d" },
  { id: "pvc-4", name: "ckpt-shared", namespace: "ai-research", status: "Bound", volume: "pv-004", capacity: "2Ti", access: "RWX", storageClass: "nfs-shared-rwx", age: "30d" },
  { id: "pvc-5", name: "edge-atom-cache", namespace: "edge-inference", status: "Bound", volume: "pv-005", capacity: "100Gi", access: "RWO", storageClass: "ssd-balanced-rwo", age: "8d" },
  { id: "pvc-6", name: "katib-exp-volume", namespace: "ai-research", status: "Pending", volume: "—", capacity: "50Gi", access: "RWO", storageClass: "ssd-balanced-rwo", age: "1m" },
];

const PVS: PV[] = PVCS.filter((p) => p.volume !== "—").map((p) => ({
  name: p.volume,
  capacity: p.capacity,
  access: p.access,
  reclaim: "Delete",
  status: "Bound",
  claim: `${p.namespace}/${p.name}`,
  storageClass: p.storageClass,
  age: p.age,
  source: "cinder.csi.openstack.org",
}));

const PVC_EVENTS = [
  { ts: "14:22", reason: "ProvisioningSucceeded", msg: "Successfully provisioned volume pvc-d7e3...c4a8", type: "Normal" },
  { ts: "14:21", reason: "Provisioning", msg: "External provisioner is provisioning volume", type: "Normal" },
  { ts: "14:21", reason: "ExternalProvisioning", msg: "waiting for a volume to be created", type: "Normal" },
];

export default function PaasStoragePage() {
  const [tab, setTab] = React.useState("pvc");
  const [selectedPvc, setSelectedPvc] = React.useState<PVC | undefined>();
  const [selectedSc, setSelectedSc] = React.useState<StorageClass | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createPvOpen, setCreatePvOpen] = React.useState(false);
  const [createScOpen, setCreateScOpen] = React.useState(false);
  const [snapshotOpen, setSnapshotOpen] = React.useState<PVC | undefined>();
  const [q, setQ] = React.useState("");

  const filteredPvcs = PVCS.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="StorageClass" value={STORAGE_CLASSES.length} icon={Database} accent="indigo" />
        <StatCard label="PV (Provisioned)" value={PVS.length} icon={HardDrive} accent="mint" />
        <StatCard label="PVC (Claimed)" value={PVCS.filter((p) => p.status === "Bound").length} icon={HardDrive} accent="mint" />
        <StatCard label="총 용량" value="3.0 Ti" icon={HardDrive} accent="amber" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pvc">PVC ({PVCS.length})</TabsTrigger>
          <TabsTrigger value="pv">PV ({PVS.length})</TabsTrigger>
          <TabsTrigger value="sc">StorageClass ({STORAGE_CLASSES.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pvc">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="PVC 이름·네임스페이스…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-56 pl-9"
                />
              </div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.success("PVC 목록 CSV 다운로드")}>
                <Download className="size-3.5" /> 내보내기
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" /> PVC 생성
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>네임스페이스</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>볼륨</TableHead>
                  <TableHead>용량</TableHead>
                  <TableHead>접근모드</TableHead>
                  <TableHead>StorageClass</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPvcs.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedPvc(p)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HardDrive className="size-4 text-brand-mint-600" />
                        <span className="font-medium hover:text-primary">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.namespace}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "Bound" ? "success" : "warning"} className="gap-1">
                        {p.status === "Bound" && <span className="size-1.5 rounded-full bg-brand-mint-500" />}
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.volume}</TableCell>
                    <TableCell className="font-mono tabular-nums">{p.capacity}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[10px]">{p.access}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{p.storageClass}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.age}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedPvc(p)}>
                            <Activity className="size-3.5" /> 상세 보기
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSnapshotOpen(p)}>
                            <Camera className="size-3.5" /> 스냅샷 생성
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`${p.name} 크기 변경 다이얼로그`)}>
                            <Edit className="size-3.5" /> 크기 확장
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${p.name} 삭제 요청 — finalizer 검증 중`)}>
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

        <TabsContent value="pv">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              PersistentVolume은 보통 StorageClass가 자동 프로비저닝하지만, 관리자가 직접 등록할 수도 있다.
            </div>
            <ChangeMark ids={["CR-PAAS-04", "CR-DOC-03"]} inline><Button size="sm" onClick={() => setCreatePvOpen(true)}>
              <Plus className="size-3.5" /> PV 생성 (관리자)
            </Button></ChangeMark>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>용량</TableHead>
                  <TableHead>접근모드</TableHead>
                  <TableHead>Reclaim Policy</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>StorageClass</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {PVS.map((p) => (
                  <TableRow key={p.name} className="cursor-pointer" onClick={() => toast.info(`${p.name} PV 정보 — Cinder backend, csi-driver v3.2.1`)}>
                    <TableCell className="font-mono">{p.name}</TableCell>
                    <TableCell className="font-mono tabular-nums">{p.capacity}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[10px]">{p.access}</Badge></TableCell>
                    <TableCell className="text-xs">{p.reclaim}</TableCell>
                    <TableCell>
                      <Badge variant="success" className="gap-1">
                        <span className="size-1.5 rounded-full bg-brand-mint-500" /> {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.claim}</TableCell>
                    <TableCell className="font-mono text-xs">{p.storageClass}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{p.source}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" onClick={() => toast.success(`PV ${p.name} YAML 보기`)}>
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sc">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              StorageClass는 관리자만 생성·수정할 수 있다. 사용자는 PVC 생성 시 선택만 가능.
            </div>
            <ChangeMark ids={["CR-PAAS-04", "CR-DOC-03"]} inline><Button size="sm" onClick={() => setCreateScOpen(true)}>
              <Plus className="size-3.5" /> StorageClass 생성 (관리자)
            </Button></ChangeMark>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>Provisioner</TableHead>
                  <TableHead>Reclaim</TableHead>
                  <TableHead>Binding</TableHead>
                  <TableHead>Parameters</TableHead>
                  <TableHead>기본</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {STORAGE_CLASSES.map((s) => (
                  <TableRow key={s.name} className="cursor-pointer" onClick={() => setSelectedSc(s)}>
                    <TableCell className="font-mono font-semibold hover:text-primary">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.provisioner}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{s.reclaim}</Badge></TableCell>
                    <TableCell className="text-xs">{s.binding}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{s.params}</TableCell>
                    <TableCell>
                      {s.default && <Badge variant="success" className="text-[10px]">default</Badge>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreVertical className="size-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedSc(s)}>상세</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`${s.name} 기본 설정 변경`)}>기본으로 설정</DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${s.name} 삭제 — PVC 사용 중이라 거부됨`)}>삭제</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PVC Detail Sheet */}
      <Sheet open={!!selectedPvc} onOpenChange={(o) => !o && setSelectedPvc(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedPvc && <PvcDetailPanel pvc={selectedPvc} />}
        </SheetContent>
      </Sheet>

      {/* StorageClass Detail Sheet */}
      <Sheet open={!!selectedSc} onOpenChange={(o) => !o && setSelectedSc(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedSc && <ScDetailPanel sc={selectedSc} />}
        </SheetContent>
      </Sheet>

      {/* Create PVC Dialog */}
      <CreatePVCDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CreatePVDialog open={createPvOpen} onClose={() => setCreatePvOpen(false)} />
      <CreateStorageClassDialog open={createScOpen} onClose={() => setCreateScOpen(false)} />

      {/* Snapshot Dialog */}
      <SnapshotDialog pvc={snapshotOpen} onClose={() => setSnapshotOpen(undefined)} />
    </div>
  );
}

function PvcDetailPanel({ pvc }: { pvc: PVC }) {
  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast.success(`${l} 복사됨`); };
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-mint-50 text-brand-mint-700">
            <HardDrive className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{pvc.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{pvc.namespace}/{pvc.id} · PersistentVolumeClaim</SheetDescription>
          </div>
          <Badge variant={pvc.status === "Bound" ? "success" : "warning"}>{pvc.status}</Badge>
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-3 gap-3">
          <InfoBox label="용량" value={pvc.capacity} onCopy={() => copy(pvc.capacity, "용량")} />
          <InfoBox label="접근모드" value={pvc.access} />
          <InfoBox label="볼륨" value={pvc.volume} onCopy={() => copy(pvc.volume, "PV name")} />
        </div>
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">정보</TabsTrigger>
            <TabsTrigger value="events">이벤트 ({PVC_EVENTS.length})</TabsTrigger>
            <TabsTrigger value="pods">사용 중 Pod</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-2 pt-3">
            <Card className="p-4 space-y-2 text-xs">
              <KV label="StorageClass" value={pvc.storageClass} mono />
              <KV label="Volume Mode" value="Filesystem" mono />
              <KV label="Reclaim Policy" value="Delete" mono />
              <KV label="Provisioner" value="cinder.csi.openstack.org" mono />
              <KV label="Backend" value="OpenStack Cinder (NVMe pool)" mono />
              <KV label="생성" value={`${pvc.age} 전`} />
              <KV label="UID" value={`pvc-${pvc.id}-d7e3...c4a8`} mono />
            </Card>
          </TabsContent>
          <TabsContent value="events" className="space-y-1 pt-3">
            {PVC_EVENTS.map((e, i) => (
              <Card key={i} className="flex items-center gap-3 p-2 text-xs">
                <span className="font-mono text-muted-foreground">{e.ts}</span>
                <Badge variant="ghost" className="text-[10px]">{e.type}</Badge>
                <span className="font-medium">{e.reason}</span>
                <span className="text-muted-foreground">{e.msg}</span>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="pods" className="space-y-2 pt-3">
            <Card className="p-3 text-xs">
              <div className="font-mono">vllm-solar-10b-7f9b8 <span className="text-muted-foreground ml-2">(mounted at /data)</span></div>
              <div className="font-mono">vllm-solar-10b-9c2da <span className="text-muted-foreground ml-2">(mounted at /data)</span></div>
            </Card>
          </TabsContent>
          <TabsContent value="yaml" className="pt-3">
            <Card className="overflow-hidden bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
              <pre>
{`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${pvc.name}
  namespace: ${pvc.namespace}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: ${pvc.capacity}
  storageClassName: ${pvc.storageClass}
  volumeName: ${pvc.volume}`}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${pvc.name} 크기 확장 다이얼로그`)}><Edit className="size-3.5" /> 크기 확장</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(`${pvc.name} 스냅샷 생성됨`)}><Camera className="size-3.5" /> 스냅샷</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${pvc.name} 삭제 요청`)}><Trash2 className="size-3.5" /> 삭제</Button>
        </div>
      </div>
    </>
  );
}

function ScDetailPanel({ sc }: { sc: StorageClass }) {
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <Database className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{sc.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">StorageClass · {sc.provisioner}</SheetDescription>
          </div>
          {sc.default && <Badge variant="success">default</Badge>}
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6 text-sm">
        <Card className="p-4 space-y-2 text-xs">
          <KV label="Provisioner" value={sc.provisioner} mono />
          <KV label="Reclaim Policy" value={sc.reclaim} mono />
          <KV label="Volume Binding Mode" value={sc.binding} mono />
          <KV label="Allow Volume Expansion" value="true" mono />
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Parameters</div>
          <div className="font-mono text-xs">{sc.params}</div>
        </Card>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <div className="font-semibold">사용 중인 PVC</div>
          <div className="mt-1 text-muted-foreground">{PVCS.filter((p) => p.storageClass === sc.name).length}개의 PVC가 이 StorageClass를 사용 중입니다.</div>
        </div>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${sc.name} 편집 다이얼로그`)}>편집</Button>
          {!sc.default && <Button variant="outline" size="sm" onClick={() => toast.success(`${sc.name} 기본으로 설정됨`)}>기본으로 설정</Button>}
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${sc.name} 삭제 — 사용 중인 PVC가 있어 거부됨`)}>삭제</Button>
        </div>
      </div>
    </>
  );
}

function CreatePVCDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [ns, setNs] = React.useState("default");
  const [size, setSize] = React.useState("10");
  const [access, setAccess] = React.useState<"RWO" | "RWX" | "ROX">("RWO");
  const [sc, setSc] = React.useState(STORAGE_CLASSES[0].name);

  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`PVC ${ns}/${name} 생성 요청됨`, { description: `${size}Gi · ${access} · ${sc}` });
    onClose();
    setName(""); setSize("10");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PVC 생성</DialogTitle>
          <DialogDescription>PersistentVolumeClaim 리소스를 생성합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-pvc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>네임스페이스</Label>
              <Select value={ns} onValueChange={setNs}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">default</SelectItem>
                  <SelectItem value="ai-research">ai-research</SelectItem>
                  <SelectItem value="llm-serving">llm-serving</SelectItem>
                  <SelectItem value="edge-inference">edge-inference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>크기 (Gi)</Label>
              <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>접근모드</Label>
              <Select value={access} onValueChange={(v) => setAccess(v as "RWO" | "RWX" | "ROX")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RWO">ReadWriteOnce</SelectItem>
                  <SelectItem value="RWX">ReadWriteMany</SelectItem>
                  <SelectItem value="ROX">ReadOnlyMany</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>StorageClass</Label>
              <Select value={sc} onValueChange={setSc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORAGE_CLASSES.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}{s.default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

function CreatePVDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [capacity, setCapacity] = React.useState("50");
  const [access, setAccess] = React.useState<"RWO" | "RWX" | "ROX">("RWO");
  const [reclaim, setReclaim] = React.useState<"Retain" | "Delete" | "Recycle">("Retain");
  const [sc, setSc] = React.useState(STORAGE_CLASSES[0].name);
  const [source, setSource] = React.useState("cinder://vol-001");

  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`PV ${name} 생성 요청됨`, {
      description: `${capacity}Gi · ${access} · ${reclaim} · ${sc}`,
    });
    setName("");
    setCapacity("50");
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PV 생성 (관리자)</DialogTitle>
          <DialogDescription>
            PersistentVolume은 보통 StorageClass가 동적 프로비저닝한다. 특수 케이스에만 직접 생성.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="pv-shared-data-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>용량 (Gi)</Label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>StorageClass</Label>
              <Select value={sc} onValueChange={setSc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STORAGE_CLASSES.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>접근모드</Label>
              <Select value={access} onValueChange={(v) => setAccess(v as "RWO" | "RWX" | "ROX")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RWO">ReadWriteOnce</SelectItem>
                  <SelectItem value="RWX">ReadWriteMany</SelectItem>
                  <SelectItem value="ROX">ReadOnlyMany</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reclaim Policy</Label>
              <Select value={reclaim} onValueChange={(v) => setReclaim(v as "Retain" | "Delete" | "Recycle")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retain">Retain (수동 정리)</SelectItem>
                  <SelectItem value="Delete">Delete (자동 삭제)</SelectItem>
                  <SelectItem value="Recycle">Recycle (재사용, deprecated)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source (백엔드 볼륨 ID)</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="font-mono text-xs" />
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

function CreateStorageClassDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [provisioner, setProvisioner] = React.useState("cinder.csi.openstack.org");
  const [reclaim, setReclaim] = React.useState<"Retain" | "Delete">("Delete");
  const [binding, setBinding] = React.useState<"Immediate" | "WaitForFirstConsumer">("WaitForFirstConsumer");
  const [params, setParams] = React.useState("type=high-iops-ssd");
  const [isDefault, setIsDefault] = React.useState(false);
  const [expansion, setExpansion] = React.useState(true);

  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`StorageClass ${name} 생성 요청됨`, {
      description: `${provisioner} · ${reclaim} · ${binding}${isDefault ? " · default" : ""}`,
    });
    setName("");
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>StorageClass 생성 (관리자)</DialogTitle>
          <DialogDescription>
            PVC가 자동으로 프로비저닝될 때 사용할 스토리지 종류를 정의한다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="nvme-high-iops" />
          </div>
          <div className="space-y-1.5">
            <Label>Provisioner</Label>
            <Select value={provisioner} onValueChange={setProvisioner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cinder.csi.openstack.org">cinder.csi.openstack.org (블록)</SelectItem>
                <SelectItem value="manila.csi.openstack.org">manila.csi.openstack.org (NFS)</SelectItem>
                <SelectItem value="rook-ceph.rbd.csi.ceph.com">rook-ceph.rbd.csi.ceph.com (Ceph RBD)</SelectItem>
                <SelectItem value="rook-ceph.cephfs.csi.ceph.com">rook-ceph.cephfs.csi.ceph.com (CephFS)</SelectItem>
                <SelectItem value="kubernetes.io/no-provisioner">no-provisioner (수동 PV)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reclaim Policy</Label>
              <Select value={reclaim} onValueChange={(v) => setReclaim(v as "Retain" | "Delete")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Delete">Delete</SelectItem>
                  <SelectItem value="Retain">Retain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Volume Binding Mode</Label>
              <Select value={binding} onValueChange={(v) => setBinding(v as "Immediate" | "WaitForFirstConsumer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Immediate">Immediate</SelectItem>
                  <SelectItem value="WaitForFirstConsumer">WaitForFirstConsumer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Parameters (key=value, 쉼표 구분)</Label>
            <Input value={params} onChange={(e) => setParams(e.target.value)} className="font-mono text-xs" placeholder="type=ssd,fsType=ext4" />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-3.5" />
              기본 StorageClass로 설정
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={expansion} onChange={(e) => setExpansion(e.target.checked)} className="size-3.5" />
              AllowVolumeExpansion
            </label>
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

function SnapshotDialog({ pvc, onClose }: { pvc?: PVC; onClose: () => void }) {
  const [name, setName] = React.useState("");
  function submit() {
    toast.success(`스냅샷 ${name || `${pvc?.name}-snap`} 생성 요청됨`);
    onClose();
    setName("");
  }
  return (
    <Dialog open={!!pvc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>스냅샷 생성 — {pvc?.name}</DialogTitle>
          <DialogDescription>VolumeSnapshot CRD를 생성합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>스냅샷 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${pvc?.name}-snap-001`} />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
            💡 스냅샷은 ReadWriteOnce 볼륨의 즉시 복사본입니다. 원본 PVC와 동일 크기({pvc?.capacity})로 생성됩니다.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>스냅샷 생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; accent: "indigo" | "mint" | "amber" }) {
  const map = { indigo: "bg-brand-indigo-100 text-brand-indigo-700", mint: "bg-brand-mint-50 text-brand-mint-700", amber: "bg-amber-100 text-amber-700" };
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </div>
      <div className={cn("flex size-10 items-center justify-center rounded-md", map[accent])}><Icon className="size-5" /></div>
    </Card>
  );
}

function InfoBox({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
        {label}
        {onCopy && <button onClick={onCopy} className="hover:text-foreground"><Copy className="size-3" /></button>}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
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
