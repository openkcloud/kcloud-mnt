"use client";
import * as React from "react";
import { Plus, Copy, Edit, Trash2, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Nova 플레이버(VM 사양 규격). 생성·편집은 관리자 권한.
const FLAVORS = [
  { name: "m1.tiny", vcpu: 1, ramMb: 512, diskGb: 5, isPublic: true, vms: 0 },
  { name: "m1.small", vcpu: 1, ramMb: 2048, diskGb: 20, isPublic: true, vms: 4 },
  { name: "m1.medium", vcpu: 2, ramMb: 4096, diskGb: 40, isPublic: true, vms: 8 },
  { name: "m1.large", vcpu: 4, ramMb: 8192, diskGb: 80, isPublic: true, vms: 12 },
  { name: "m1.xlarge", vcpu: 8, ramMb: 16384, diskGb: 160, isPublic: true, vms: 6 },
  { name: "g1.gpu", vcpu: 32, ramMb: 131072, diskGb: 1000, isPublic: true, vms: 3 },
  { name: "g1.gpu-4x", vcpu: 64, ramMb: 262144, diskGb: 2000, isPublic: false, vms: 1 },
  { name: "n1.npu-2", vcpu: 16, ramMb: 65536, diskGb: 500, isPublic: true, vms: 2 },
];

export default function FlavorsPage() {
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">VM 사양 정의 (vCPU·RAM·Disk)</span>
          <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> Flavor 생성
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {FLAVORS.map((f) => (
            <Card key={f.name} className="p-4 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono font-semibold">{f.name}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {f.isPublic ? "public" : "private"} · 사용 중 {f.vms} VM
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm"><MoreVertical className="size-3.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toast.success(`${f.name} 편집`)}>
                      <Edit className="size-3.5" /> 편집
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.success(`${f.name} 복제됨`)}>
                      <Copy className="size-3.5" /> 복제
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${f.name} 삭제 — VM 사용 중이라 거부됨`)}>
                      <Trash2 className="size-3.5" /> 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <Pair label="vCPU" value={`${f.vcpu}`} />
                <Pair label="RAM" value={`${(f.ramMb / 1024).toFixed(0)} GB`} />
                <Pair label="Disk" value={`${f.diskGb} GB`} />
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <CreateFlavorDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateFlavorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [vcpu, setVcpu] = React.useState("4");
  const [ramMb, setRamMb] = React.useState("8192");
  const [diskGb, setDiskGb] = React.useState("80");
  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`Flavor ${name} 생성됨`, { description: `${vcpu} vCPU · ${ramMb}MB RAM · ${diskGb}GB` });
    onClose();
    setName("");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flavor 생성</DialogTitle>
          <DialogDescription>VM 사양 템플릿을 정의합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="m2.large" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>vCPU</Label>
              <Input type="number" value={vcpu} onChange={(e) => setVcpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>RAM (MB)</Label>
              <Input type="number" value={ramMb} onChange={(e) => setRamMb(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Disk (GB)</Label>
              <Input type="number" value={diskGb} onChange={(e) => setDiskGb(e.target.value)} />
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

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
