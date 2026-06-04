"use client";
import * as React from "react";
import {
  HardDrive,
  Plus,
  Search,
  Camera,
  Link2,
  Link2Off,
  Trash2,
  Edit,
  MoreVertical,
  Activity,
  Download,
  Copy,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Volume } from "@/lib/types";

export default function VolumesPage() {
  const { data, isLoading } = api.iaas.volumes() as {
    data: { items: Volume[] } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<Volume | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const items = data.items.filter((v) => !q || v.name.toLowerCase().includes(q.toLowerCase()));
  const totalGb = data.items.reduce((s, v) => s + v.sizeGb, 0);
  const inUse = data.items.filter((v) => v.status === "in-use").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatChip label="전체 볼륨" value={data.items.length} />
        <StatChip label="사용 중" value={inUse} />
        <StatChip label="총 용량" value={`${(totalGb / 1024).toFixed(1)} TB`} />
        <StatChip label="평균 크기" value={`${Math.round(totalGb / data.items.length)} GB`} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="볼륨 이름·테넌트…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-32"><SelectValue placeholder="상태" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="in-use">사용 중</SelectItem>
              <SelectItem value="available">유휴</SelectItem>
              <SelectItem value="error">에러</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => toast.success("볼륨 목록 CSV 내보내기")}>
            <Download className="size-3.5" /> 내보내기
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> 볼륨 생성
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>테넌트</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>크기</TableHead>
              <TableHead>부팅</TableHead>
              <TableHead>연결 VM</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((v) => (
              <TableRow key={v.id} className="cursor-pointer" onClick={() => setSelected(v)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <HardDrive className="size-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium hover:text-primary">{v.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{v.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{v.tenantId}</TableCell>
                <TableCell>
                  <Badge variant={v.type === "nvme" ? "success" : v.type === "ssd" ? "default" : "outline"}>
                    {v.type.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{v.sizeGb} GB</TableCell>
                <TableCell>{v.bootable ? <Badge variant="warning">Boot</Badge> : "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {v.attachedVmId ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={v.status === "in-use" ? "success" : v.status === "error" ? "destructive" : "secondary"}>
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm"><MoreVertical className="size-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(v)}>
                        <Activity className="size-3.5" /> 상세 보기
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${v.name} 스냅샷 ${v.name}-snap-001 생성됨`)}>
                        <Camera className="size-3.5" /> 스냅샷 생성
                      </DropdownMenuItem>
                      {v.attachedVmId ? (
                        <DropdownMenuItem onClick={() => toast.success(`${v.name} ↛ ${v.attachedVmId} 분리됨`)}>
                          <Link2Off className="size-3.5" /> VM 분리
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => toast.success(`${v.name} VM 연결 다이얼로그`)}>
                          <Link2 className="size-3.5" /> VM 연결
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => toast.success(`${v.name} 크기 확장`)}>
                        <Edit className="size-3.5" /> 크기 확장
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${v.name} 삭제 요청`)}>
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

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && <VolumeDetailPanel volume={selected} />}
        </SheetContent>
      </Sheet>

      <CreateVolumeDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function VolumeDetailPanel({ volume: v }: { volume: Volume }) {
  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast.success(`${l} 복사됨`); };
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-mint-50 text-brand-mint-700">
            <HardDrive className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{v.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{v.id} · OpenStack Cinder Volume</SheetDescription>
          </div>
          <Badge variant={v.status === "in-use" ? "success" : v.status === "error" ? "destructive" : "secondary"}>{v.status}</Badge>
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-3 gap-3">
          <InfoBox label="크기" value={`${v.sizeGb} GB`} onCopy={() => copy(`${v.sizeGb}GB`, "크기")} />
          <InfoBox label="유형" value={v.type.toUpperCase()} />
          <InfoBox label="부팅 가능" value={v.bootable ? "Yes" : "No"} />
        </div>

        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">정보</TabsTrigger>
            <TabsTrigger value="snapshots">스냅샷</TabsTrigger>
            <TabsTrigger value="actions">액션</TabsTrigger>
            <TabsTrigger value="yaml">메타</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-2 pt-3">
            <Card className="p-4 space-y-2 text-xs">
              <KV label="ID" value={v.id} mono />
              <KV label="이름" value={v.name} mono />
              <KV label="테넌트" value={v.tenantId} mono />
              <KV label="자원풀" value={v.poolId} mono />
              <KV label="볼륨 유형" value={`${v.type} (cinder volume_type)`} mono />
              <KV label="크기" value={`${v.sizeGb} GB`} mono />
              <KV label="부팅 가능" value={v.bootable ? "Yes (image-backed)" : "No"} mono />
              <KV label="연결된 VM" value={v.attachedVmId ?? "—"} mono />
              <KV label="Device" value={v.attachedVmId ? "/dev/vdb" : "—"} mono />
              <KV label="IOPS 한도" value={v.type === "nvme" ? "10,000" : v.type === "ssd" ? "5,000" : "1,500"} mono />
              <KV label="Throughput" value={v.type === "nvme" ? "1 GB/s" : "500 MB/s"} mono />
            </Card>
          </TabsContent>

          <TabsContent value="snapshots" className="space-y-2 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">최근 스냅샷</span>
              <Button size="sm" onClick={() => toast.success(`${v.name}-snap-002 생성됨`)}>
                <Camera className="size-3.5" /> 새 스냅샷
              </Button>
            </div>
            {[
              { name: `${v.name}-snap-001`, created: "3일 전", size: v.sizeGb, status: "available" },
              { name: `${v.name}-backup-w24`, created: "1주 전", size: v.sizeGb, status: "available" },
            ].map((s) => (
              <Card key={s.name} className="flex items-center gap-3 p-3">
                <Camera className="size-4 text-brand-indigo-600" />
                <div className="flex-1 text-xs">
                  <div className="font-mono">{s.name}</div>
                  <div className="text-muted-foreground">{s.created} · {s.size} GB</div>
                </div>
                <Badge variant="success" className="text-[10px]">{s.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => toast.success(`${s.name} 으로 복원 시작`)}>복원</Button>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="actions" className="space-y-2 pt-3">
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => toast.success(`${v.name} 크기 확장 다이얼로그`)}>
                  <Edit className="size-3.5" /> 크기 확장
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast.success(`${v.name} 스냅샷 생성됨`)}>
                  <Camera className="size-3.5" /> 스냅샷
                </Button>
                {v.attachedVmId ? (
                  <Button variant="outline" size="sm" onClick={() => toast.success(`${v.attachedVmId}에서 분리됨`)}>
                    <Link2Off className="size-3.5" /> VM 분리
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => toast.success(`연결 대상 VM 선택`)}>
                    <Link2 className="size-3.5" /> VM 연결
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => toast.success(`${v.name} 새 이미지로 변환`)}>
                  복제
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="yaml" className="pt-3">
            <Card className="overflow-hidden bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
              <pre>
{`Volume:
  id: ${v.id}
  name: ${v.name}
  size: ${v.sizeGb}
  status: ${v.status}
  volume_type: ${v.type}
  bootable: ${v.bootable}
  multiattach: false
  availability_zone: nova
  source_volid: null
  consistencygroup_id: null
  user_id: ${v.tenantId}-admin
  attachments:
${v.attachedVmId ? `    - server_id: ${v.attachedVmId}
      device: /dev/vdb
      attached_at: 2026-05-31T14:22:18Z` : "    []"}`}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${v.name} 크기 확장`)}><Edit className="size-3.5" /> 확장</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(`${v.name} 스냅샷 생성됨`)}><Camera className="size-3.5" /> 스냅샷</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${v.name} 삭제 요청 (in-use면 거부됨)`)}><Trash2 className="size-3.5" /> 삭제</Button>
        </div>
      </div>
    </>
  );
}

function CreateVolumeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [size, setSize] = React.useState("100");
  const [type, setType] = React.useState("ssd");
  const [bootable, setBootable] = React.useState(false);
  const [source, setSource] = React.useState("empty");
  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`볼륨 ${name} 생성 요청됨`, { description: `${size}GB ${type.toUpperCase()} · ${bootable ? "bootable" : "data"} · source=${source}` });
    onClose();
    setName("");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>볼륨 생성</DialogTitle>
          <DialogDescription>OpenStack Cinder Volume을 생성합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-volume" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>크기 (GB)</Label>
              <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>유형</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nvme">NVMe (10K IOPS, 1GB/s)</SelectItem>
                  <SelectItem value="ssd">SSD (5K IOPS, 500MB/s)</SelectItem>
                  <SelectItem value="hdd">HDD (1.5K IOPS, 200MB/s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>소스</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">빈 볼륨</SelectItem>
                <SelectItem value="image">Glance 이미지로부터</SelectItem>
                <SelectItem value="snapshot">스냅샷으로부터 복원</SelectItem>
                <SelectItem value="clone">기존 볼륨 복제</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
            <input type="checkbox" id="boot" checked={bootable} onChange={(e) => setBootable(e.target.checked)} />
            <Label htmlFor="boot" className="cursor-pointer text-xs">부팅 가능 볼륨으로 생성 (VM이 직접 부팅)</Label>
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

function StatChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
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
