"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import {
  Disc,
  Cpu,
  Search,
  Plus,
  Download,
  Upload,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  Server,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FeatureGate } from "@/components/feature-gate";
import { useFeatureVisible } from "@/lib/scope";
import { toast } from "sonner";
import type { Image } from "@/lib/types";

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

export default function ImagesPage() {
  const { data, isLoading } = api.iaas.images() as {
    data: { items: Image[] } | undefined;
    isLoading: boolean;
  };
  const [tab, setTab] = React.useState("images");
  const [selectedImage, setSelectedImage] = React.useState<Image | undefined>();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [createFlavorOpen, setCreateFlavorOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const packagingVisible = useFeatureVisible("iaas.images.packaging");
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const filteredImages = data.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="images">이미지 ({data.items.length})</TabsTrigger>
          <TabsTrigger value="flavors">Flavor ({FLAVORS.length})</TabsTrigger>
          {packagingVisible && <TabsTrigger value="packaging">패키징</TabsTrigger>}
        </TabsList>

        <TabsContent value="packaging">
          <ChangeMark ids={["CR-IAAS-09"]}>
          <FeatureGate id="iaas.images.packaging">
            <Card className="p-6">
              <div className="space-y-2 text-sm">
                <div className="font-semibold">이미지 패키징 — 멀티레벨 이미지 빌더 연동 자리</div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  외부 멀티레벨 이미지 빌더가 준비되면 이 메뉴에 연동한다.
                  현재 포털은 Glance 업로드·동기화까지 제공한다. 연동 시 소스(Dockerfile·모델 아티팩트) 선택 → 베이스 이미지(AI반도체 런타임) 선택 → 빌드 → Glance/Harbor 등록 흐름을 이 탭에 배치한다.
                </p>
                <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
                  {["소스 선택", "베이스 이미지(런타임)", "빌드 · 검증", "Glance/Harbor 등록"].map((t, i) => (
                    <div key={t} className="rounded-md border border-dashed border-border p-3 text-center text-muted-foreground">
                      <div className="font-mono text-[10px]">STEP {i + 1}</div>
                      <div className="mt-1 text-foreground">{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </FeatureGate>
          </ChangeMark>
        </TabsContent>

        <TabsContent value="images">
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input placeholder="이미지 이름·OS…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-32"><SelectValue placeholder="가시성" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => toast.success("Glance 이미지 카탈로그 동기화 완료")}>
                <Download className="size-3.5" /> 카탈로그 동기화
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-3.5" /> 이미지 업로드
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredImages.map((img) => (
              <button key={img.id} type="button" onClick={() => setSelectedImage(img)} className="text-left">
                <Card className="group relative transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-md bg-brand-indigo-100 text-brand-indigo-700">
                          <Disc className="size-4" />
                        </div>
                        <div>
                          <div className="font-mono text-sm font-semibold group-hover:text-primary">{img.name}</div>
                          <div className="text-xs text-muted-foreground">{img.os}</div>
                        </div>
                      </div>
                      <Badge variant={img.visibility === "public" ? "success" : img.visibility === "shared" ? "default" : "outline"}>
                        {img.visibility}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Pair label="아키텍처" value={img.arch} />
                      <Pair label="포맷" value={img.format} />
                      <Pair label="크기" value={`${(img.sizeMb / 1024).toFixed(2)} GB`} />
                      <Pair label="배포일" value={img.createdAt} />
                    </div>
                    {img.hasAcceleratorRuntime && (
                      <div className="flex items-center gap-1.5 rounded-md bg-brand-mint-50 px-2.5 py-1.5 text-xs text-brand-mint-700">
                        <Cpu className="size-3.5" />
                        AI 가속기 런타임 포함
                      </div>
                    )}
                    <div className="flex items-center gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
                      <span className="font-mono">{img.id}</span>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flavors">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs text-muted-foreground">VM 사양 정의 (vCPU·RAM·Disk)</span>
              <Button size="sm" className="ml-auto" onClick={() => setCreateFlavorOpen(true)}>
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
        </TabsContent>
      </Tabs>

      {/* Image Detail Sheet */}
      <Sheet open={!!selectedImage} onOpenChange={(o) => !o && setSelectedImage(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedImage && <ImageDetailPanel image={selectedImage} />}
        </SheetContent>
      </Sheet>

      <UploadImageDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <CreateFlavorDialog open={createFlavorOpen} onClose={() => setCreateFlavorOpen(false)} />
    </div>
  );
}

function ImageDetailPanel({ image }: { image: Image }) {
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <Disc className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{image.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{image.id} · Glance Image</SheetDescription>
          </div>
          <Badge variant={image.visibility === "public" ? "success" : image.visibility === "shared" ? "default" : "outline"}>
            {image.visibility}
          </Badge>
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6">
        <Card className="space-y-2 p-4 text-xs">
          <KV label="OS" value={image.os} mono />
          <KV label="아키텍처" value={image.arch} mono />
          <KV label="포맷" value={image.format} mono />
          <KV label="크기" value={`${image.sizeMb} MB (${(image.sizeMb / 1024).toFixed(2)} GB)`} mono />
          <KV label="배포" value={image.createdAt} mono />
          <KV label="가속기 런타임" value={image.hasAcceleratorRuntime ? "Yes (CUDA/RBLN/Furiosa SDK)" : "No"} mono />
          <KV label="체크섬" value="a3f7d8e2c4b5..." mono />
          <KV label="container_format" value="bare" mono />
          <KV label="disk_format" value={image.format} mono />
        </Card>

        {image.hasAcceleratorRuntime && (
          <Card className="border-brand-mint-200 bg-brand-mint-50/40 p-3 text-xs">
            <div className="mb-1 flex items-center gap-1 font-semibold">
              <Cpu className="size-3.5 text-brand-mint-700" /> 포함된 SDK
            </div>
            <div className="space-y-0.5 font-mono">
              {image.name.includes("cuda") && <div>NVIDIA CUDA 12.4 + cuDNN 9 + NCCL</div>}
              {image.name.includes("rbln") && <div>Rebellions RBLN SDK 1.4.0 + Compiler</div>}
              {image.name.includes("furiosa") && <div>Furiosa SDK 2.1.0 + npu-tools</div>}
              {image.name.includes("vllm") && <div>vLLM 0.6.5 + Triton Inference Server</div>}
              {image.name.includes("kubeflow") && <div>Code Server + Kubeflow Notebook</div>}
            </div>
          </Card>
        )}

        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${image.name}로 VM 생성 위저드`)}>
            <Server className="size-3.5" /> 이 이미지로 VM 생성
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(`${image.name} 다운로드 시작`)}>
            <Download className="size-3.5" /> 다운로드
          </Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${image.name} 삭제 요청`)}>
            <Trash2 className="size-3.5" /> 삭제
          </Button>
        </div>
      </div>
    </>
  );
}

function UploadImageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState("qcow2");
  const [vis, setVis] = React.useState("private");
  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`이미지 ${name} 업로드 시작 (Glance)`, { description: `${format} · ${vis} · 시간 소요 약 3분` });
    onClose();
    setName("");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이미지 업로드</DialogTitle>
          <DialogDescription>로컬 또는 URL로부터 OpenStack Glance에 이미지 업로드</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이미지 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ubuntu-24.04-cuda-12.4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>포맷</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qcow2">qcow2</SelectItem>
                  <SelectItem value="raw">raw</SelectItem>
                  <SelectItem value="iso">iso</SelectItem>
                  <SelectItem value="vmdk">vmdk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>가시성</Label>
              <Select value={vis} onValueChange={setVis}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>소스</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => toast.success("파일 선택")}>
                <Upload className="size-3.5" /> 파일 선택
              </Button>
              <Input placeholder="또는 https://... URL" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>업로드 시작</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-right" : "text-right"}>{value}</span>
    </div>
  );
}
