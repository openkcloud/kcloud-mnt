"use client";
import * as React from "react";
import {
  Network,
  Search,
  Plus,
  Copy,
  ExternalLink,
  Globe,
  Server,
  Lock,
  Activity,
  Trash2,
  Edit,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { KService } from "@/lib/types";

// 샘플 endpoint pod 데이터
const ENDPOINT_PODS: Record<string, { name: string; ip: string; node: string; ready: boolean }[]> = {
  default: [
    { name: "vllm-solar-10b-7f9b8", ip: "10.244.1.42", node: "gpu-node-01", ready: true },
    { name: "vllm-solar-10b-9c2da", ip: "10.244.2.18", node: "gpu-node-02", ready: true },
    { name: "vllm-solar-10b-3e8f1", ip: "10.244.3.07", node: "atom-node-01", ready: true },
  ],
};

export default function ServicesPage() {
  const { data, isLoading } = api.paas.services() as {
    data: { items: KService[] } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<KService | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const items = data.items.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="서비스 이름·네임스페이스…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              <SelectItem value="ClusterIP">ClusterIP</SelectItem>
              <SelectItem value="NodePort">NodePort</SelectItem>
              <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
              <SelectItem value="Ingress">Ingress</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.success("Service 매니페스트 YAML 다운로드")}>
            <Download className="size-3.5" /> YAML 내보내기
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> 서비스 생성
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>서비스</TableHead>
              <TableHead>네임스페이스</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>포트</TableHead>
              <TableHead>External IP</TableHead>
              <TableHead>엔드포인트</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Network className="size-4 text-sky-600" />
                    <span className="font-medium hover:text-primary">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{s.namespace}</TableCell>
                <TableCell>
                  <Badge variant={s.type === "LoadBalancer" ? "default" : s.type === "Ingress" ? "success" : "outline"}>
                    {s.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {s.ports.map((p) => `${p.port}→${p.targetPort}/${p.protocol}`).join(", ")}
                </TableCell>
                <TableCell className="font-mono text-xs">{s.externalIp ?? "—"}</TableCell>
                <TableCell className="font-mono tabular-nums">{s.endpoints}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelected(s); }}>
                        <Activity className="size-3.5" /> 상세 보기
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${s.name} 매니페스트 편집기 열림`)}>
                        <Edit className="size-3.5" /> YAML 편집
                      </DropdownMenuItem>
                      {s.externalIp && (
                        <DropdownMenuItem onClick={() => toast.success(`https://${s.externalIp} 열림`)}>
                          <ExternalLink className="size-3.5" /> 엔드포인트 열기
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${s.name} 삭제 요청`)}>
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
          {selected && <ServiceDetailPanel svc={selected} />}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <CreateServiceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function ServiceDetailPanel({ svc }: { svc: KService }) {
  const copy = (t: string, l: string) => {
    navigator.clipboard.writeText(t);
    toast.success(`${l} 복사됨`);
  };
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Network className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{svc.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {svc.namespace}/{svc.id} · Service
            </SheetDescription>
          </div>
          <Badge variant={svc.type === "LoadBalancer" ? "default" : svc.type === "Ingress" ? "success" : "outline"}>
            {svc.type}
          </Badge>
        </div>
      </SheetHeader>

      <div className="space-y-4 p-6">
        {/* Quick info */}
        <div className="grid grid-cols-3 gap-3">
          <InfoBox label="ClusterIP" value="10.96.142.18" onCopy={() => copy("10.96.142.18", "ClusterIP")} />
          <InfoBox label="External IP" value={svc.externalIp ?? "—"} onCopy={svc.externalIp ? () => copy(svc.externalIp!, "External IP") : undefined} />
          <InfoBox label="DNS" value={`${svc.name}.${svc.namespace}.svc.cluster.local`} small onCopy={() => copy(`${svc.name}.${svc.namespace}.svc.cluster.local`, "DNS")} />
        </div>

        <Tabs defaultValue="ports">
          <TabsList>
            <TabsTrigger value="ports">포트 ({svc.ports.length})</TabsTrigger>
            <TabsTrigger value="endpoints">엔드포인트 ({svc.endpoints})</TabsTrigger>
            <TabsTrigger value="selector">셀렉터</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
          </TabsList>

          <TabsContent value="ports" className="space-y-2 pt-3">
            {svc.ports.map((p, i) => (
              <Card key={i} className="p-3">
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <KV label="이름" value={`port-${i + 1}`} />
                  <KV label="포트" value={p.port.toString()} mono />
                  <KV label="Target Port" value={p.targetPort.toString()} mono />
                  <KV label="프로토콜" value={p.protocol} mono />
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-2 pt-3">
            <div className="text-xs text-muted-foreground mb-2">
              이 Service가 라우팅하는 Pod의 IP 주소 목록
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pod</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>노드</TableHead>
                    <TableHead>준비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ENDPOINT_PODS.default.slice(0, svc.endpoints).map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-mono text-xs">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.ip}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.node}</TableCell>
                      <TableCell>
                        <Badge variant={p.ready ? "success" : "warning"} className="text-[10px]">
                          {p.ready ? "Ready" : "NotReady"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="selector" className="space-y-2 pt-3">
            <Card className="p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-2">Pod Selector</div>
              <div className="space-y-1.5 font-mono text-xs">
                <div>
                  <span className="text-sky-600">app</span>={svc.name.split("-")[0]}
                </div>
                <div>
                  <span className="text-sky-600">tier</span>=serving
                </div>
                <div>
                  <span className="text-sky-600">team</span>={svc.namespace}
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                이 selector와 매칭되는 Pod {svc.endpoints}개가 자동 endpoint로 등록됩니다.
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="yaml" className="pt-3">
            <Card className="overflow-hidden bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
              <pre className="overflow-x-auto">
{`apiVersion: v1
kind: Service
metadata:
  name: ${svc.name}
  namespace: ${svc.namespace}
spec:
  type: ${svc.type === "Ingress" ? "ClusterIP" : svc.type}
  selector:
    app: ${svc.name.split("-")[0]}
  ports:
${svc.ports.map((p) => `    - port: ${p.port}
      targetPort: ${p.targetPort}
      protocol: ${p.protocol}`).join("\n")}
${svc.externalIp ? `  externalIPs:
    - ${svc.externalIp}` : ""}`}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success("YAML 편집기 열림")}>
            <Edit className="size-3.5" /> 편집
          </Button>
          {svc.externalIp && (
            <Button variant="outline" size="sm" onClick={() => toast.success(`https://${svc.externalIp} 열림`)}>
              <ExternalLink className="size-3.5" /> 엔드포인트 열기
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => toast.success("포트 포워딩 시작 — kubectl port-forward")}>
            <Globe className="size-3.5" /> 포트포워딩
          </Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${svc.name} 삭제 요청 전송`)}>
            <Trash2 className="size-3.5" /> 삭제
          </Button>
        </div>
      </div>
    </>
  );
}

function CreateServiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("ClusterIP");
  const [port, setPort] = React.useState("80");
  const [targetPort, setTargetPort] = React.useState("8080");
  const [namespace, setNamespace] = React.useState("default");

  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`Service ${namespace}/${name} 생성됨`, {
      description: `${type} · ${port}→${targetPort}`,
    });
    onClose();
    setName(""); setPort("80"); setTargetPort("8080");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>서비스 생성</DialogTitle>
          <DialogDescription>K8s Service 리소스를 생성합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">이름</Label>
            <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-service" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>네임스페이스</Label>
              <Select value={namespace} onValueChange={setNamespace}>
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
              <Label>유형</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ClusterIP">ClusterIP</SelectItem>
                  <SelectItem value="NodePort">NodePort</SelectItem>
                  <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Port</Label>
              <Input value={targetPort} onChange={(e) => setTargetPort(e.target.value)} />
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

function InfoBox({ label, value, small, onCopy }: { label: string; value: string; small?: boolean; onCopy?: () => void }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5">
      <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
        {label}
        {onCopy && (
          <button onClick={onCopy} className="hover:text-foreground">
            <Copy className="size-3" />
          </button>
        )}
      </div>
      <div className={`mt-0.5 font-mono font-semibold ${small ? "text-[10px]" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}
