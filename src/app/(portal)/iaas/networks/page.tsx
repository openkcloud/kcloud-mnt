"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import {
  Network as NetworkIcon,
  Wifi,
  Plug,
  ShieldCheck,
  Globe,
  Router,
  ChevronRight,
  Search,
  Copy,
  Plus,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { IaasNetwork } from "@/lib/types";

// ────── 샘플 상세 데이터 (네트워크별) ──────
type NetworkDetail = {
  subnets: { id: string; name: string; cidr: string; gateway: string; dhcp: boolean; dns: string[]; allocationPool: string }[];
  ports: { id: string; name: string; status: "ACTIVE" | "DOWN"; mac: string; ip: string; deviceOwner: string; vm?: string }[];
  securityGroups: { id: string; name: string; rules: number; desc: string }[];
  routers: { id: string; name: string; status: "ACTIVE"; gatewayIp: string; routes: number; ha: boolean }[];
  quotas: { ports: { used: number; max: number }; floatingIps: { used: number; max: number }; subnets: { used: number; max: number } };
  bandwidth: { rxMbps: number; txMbps: number; pktDropPct: number };
  floatingIps: { ip: string; mappedTo: string; status: "ACTIVE" | "DOWN" }[];
};

const DETAILS: Record<string, NetworkDetail> = {
  "in-1": {
    subnets: [
      { id: "sn-1a", name: "ai-research-subnet-A", cidr: "192.168.100.0/25", gateway: "192.168.100.1", dhcp: true, dns: ["8.8.8.8", "168.126.63.1"], allocationPool: "192.168.100.10 ~ 192.168.100.126" },
      { id: "sn-1b", name: "ai-research-subnet-B", cidr: "192.168.100.128/25", gateway: "192.168.100.129", dhcp: true, dns: ["8.8.8.8"], allocationPool: "192.168.100.140 ~ 192.168.100.254" },
    ],
    ports: [
      { id: "p-001", name: "research-trainer-01-eth0", status: "ACTIVE", mac: "fa:16:3e:0a:5b:c1", ip: "192.168.100.12", deviceOwner: "compute:nova", vm: "vm-001" },
      { id: "p-002", name: "research-trainer-02-eth0", status: "ACTIVE", mac: "fa:16:3e:0a:5b:c2", ip: "192.168.100.14", deviceOwner: "compute:nova", vm: "vm-002" },
      { id: "p-003", name: "data-loader-01-eth0", status: "ACTIVE", mac: "fa:16:3e:0a:5b:c3", ip: "192.168.100.18", deviceOwner: "compute:nova", vm: "vm-007" },
      { id: "p-004", name: "ai-research-router-gw", status: "ACTIVE", mac: "fa:16:3e:99:01:01", ip: "192.168.100.1", deviceOwner: "network:router_gateway" },
      { id: "p-005", name: "dhcp-port", status: "ACTIVE", mac: "fa:16:3e:99:01:02", ip: "192.168.100.2", deviceOwner: "network:dhcp" },
    ],
    securityGroups: [
      { id: "sg-default", name: "default", rules: 4, desc: "프로젝트 기본 보안 그룹 (egress all, ingress same-group)" },
      { id: "sg-ssh", name: "ai-research-ssh", rules: 1, desc: "SSH 22 from 10.10.0.0/16" },
      { id: "sg-jupyter", name: "ai-research-notebook", rules: 2, desc: "Notebook 8888 from mgmt, 8080 from svc" },
      { id: "sg-nfs", name: "ai-research-nfs", rules: 1, desc: "NFS 2049 from same project" },
    ],
    routers: [
      { id: "r-001", name: "ai-research-router", status: "ACTIVE", gatewayIp: "10.20.0.5", routes: 3, ha: true },
    ],
    quotas: { ports: { used: 14, max: 50 }, floatingIps: { used: 4, max: 10 }, subnets: { used: 2, max: 5 } },
    bandwidth: { rxMbps: 240.5, txMbps: 312.8, pktDropPct: 0.02 },
    floatingIps: [
      { ip: "203.0.113.42", mappedTo: "research-trainer-01", status: "ACTIVE" },
      { ip: "203.0.113.43", mappedTo: "research-trainer-02", status: "ACTIVE" },
      { ip: "203.0.113.44", mappedTo: "(unmapped)", status: "DOWN" },
    ],
  },
  "in-2": {
    subnets: [
      { id: "sn-2a", name: "llm-serving-public", cidr: "10.20.0.0/24", gateway: "10.20.0.1", dhcp: true, dns: ["8.8.8.8", "1.1.1.1"], allocationPool: "10.20.0.10 ~ 10.20.0.250" },
    ],
    ports: [
      { id: "p-101", name: "vllm-solar-10b-eth0", status: "ACTIVE", mac: "fa:16:3e:1a:2b:01", ip: "10.20.0.21", deviceOwner: "compute:nova", vm: "vm-004" },
      { id: "p-102", name: "vllm-solar-10b-eth1", status: "ACTIVE", mac: "fa:16:3e:1a:2b:02", ip: "10.20.0.22", deviceOwner: "compute:nova", vm: "vm-005" },
      { id: "p-103", name: "kserve-furiosa-rngd-eth0", status: "ACTIVE", mac: "fa:16:3e:1a:2b:03", ip: "10.20.0.23", deviceOwner: "compute:nova", vm: "vm-006" },
      { id: "p-104", name: "external-gw", status: "ACTIVE", mac: "fa:16:3e:1a:2b:99", ip: "10.20.0.1", deviceOwner: "network:router_gateway" },
    ],
    securityGroups: [
      { id: "sg-default", name: "default", rules: 4, desc: "기본 보안 그룹" },
      { id: "sg-https", name: "llm-serving-https", rules: 1, desc: "HTTPS 443 from anywhere" },
      { id: "sg-vllm-api", name: "llm-serving-vllm", rules: 2, desc: "vLLM 8000 from API Gateway only" },
    ],
    routers: [
      { id: "r-002", name: "llm-serving-router", status: "ACTIVE", gatewayIp: "203.0.113.1", routes: 2, ha: true },
    ],
    quotas: { ports: { used: 8, max: 50 }, floatingIps: { used: 2, max: 10 }, subnets: { used: 1, max: 5 } },
    bandwidth: { rxMbps: 580.2, txMbps: 892.6, pktDropPct: 0.04 },
    floatingIps: [
      { ip: "203.0.113.50", mappedTo: "vllm-solar-10b-lb", status: "ACTIVE" },
      { ip: "203.0.113.51", mappedTo: "kserve-furiosa-lb", status: "ACTIVE" },
    ],
  },
  "in-3": {
    subnets: [
      { id: "sn-3a", name: "edge-inference-vlan-410", cidr: "172.30.10.0/24", gateway: "172.30.10.1", dhcp: false, dns: ["192.168.10.5"], allocationPool: "172.30.10.10 ~ 172.30.10.250" },
    ],
    ports: [
      { id: "p-201", name: "edge-inf-furiosa-01-eth0", status: "ACTIVE", mac: "fa:16:3e:2a:3b:01", ip: "172.30.10.12", deviceOwner: "compute:nova", vm: "vm-012" },
      { id: "p-202", name: "edge-inf-furiosa-02-eth0", status: "ACTIVE", mac: "fa:16:3e:2a:3b:02", ip: "172.30.10.13", deviceOwner: "compute:nova", vm: "vm-013" },
      { id: "p-203", name: "edge-mgmt-gw", status: "ACTIVE", mac: "fa:16:3e:2a:3b:99", ip: "172.30.10.1", deviceOwner: "network:router_gateway" },
    ],
    securityGroups: [
      { id: "sg-default", name: "default", rules: 4, desc: "기본 보안 그룹" },
      { id: "sg-edge", name: "edge-inference-only", rules: 3, desc: "엣지 전용 — VPN 게이트웨이만 허용" },
    ],
    routers: [
      { id: "r-003", name: "edge-inference-router", status: "ACTIVE", gatewayIp: "10.50.0.1", routes: 5, ha: false },
    ],
    quotas: { ports: { used: 5, max: 30 }, floatingIps: { used: 0, max: 5 }, subnets: { used: 1, max: 3 } },
    bandwidth: { rxMbps: 42.4, txMbps: 88.6, pktDropPct: 0.01 },
    floatingIps: [],
  },
  "in-4": {
    subnets: [
      { id: "sn-4a", name: "platform-shared-A", cidr: "10.50.0.0/24", gateway: "10.50.0.1", dhcp: true, dns: ["8.8.8.8"], allocationPool: "10.50.0.10 ~ 10.50.0.250" },
      { id: "sn-4b", name: "platform-shared-B", cidr: "10.50.1.0/24", gateway: "10.50.1.1", dhcp: true, dns: ["8.8.8.8"], allocationPool: "10.50.1.10 ~ 10.50.1.250" },
      { id: "sn-4c", name: "platform-shared-monitoring", cidr: "10.50.2.0/24", gateway: "10.50.2.1", dhcp: true, dns: ["8.8.8.8"], allocationPool: "10.50.2.10 ~ 10.50.2.250" },
      { id: "sn-4d", name: "platform-shared-logging", cidr: "10.50.3.0/24", gateway: "10.50.3.1", dhcp: true, dns: ["8.8.8.8"], allocationPool: "10.50.3.10 ~ 10.50.3.250" },
    ],
    ports: [
      { id: "p-301", name: "prometheus-01-eth0", status: "ACTIVE", mac: "fa:16:3e:3a:4b:01", ip: "10.50.2.10", deviceOwner: "compute:nova", vm: "vm-016" },
      { id: "p-302", name: "loki-01-eth0", status: "ACTIVE", mac: "fa:16:3e:3a:4b:02", ip: "10.50.3.10", deviceOwner: "compute:nova", vm: "vm-020" },
      { id: "p-303", name: "minio-01-eth0", status: "ACTIVE", mac: "fa:16:3e:3a:4b:03", ip: "10.50.0.22", deviceOwner: "compute:nova", vm: "vm-022" },
      { id: "p-304", name: "harbor-01-eth0", status: "ACTIVE", mac: "fa:16:3e:3a:4b:04", ip: "10.50.0.23", deviceOwner: "compute:nova", vm: "vm-023" },
      { id: "p-305", name: "platform-shared-gw", status: "ACTIVE", mac: "fa:16:3e:3a:4b:99", ip: "10.50.0.1", deviceOwner: "network:router_gateway" },
    ],
    securityGroups: [
      { id: "sg-default", name: "default", rules: 4, desc: "기본 보안 그룹" },
      { id: "sg-prom", name: "platform-prometheus", rules: 2, desc: "Prometheus 9090 from grafana-svc" },
      { id: "sg-loki", name: "platform-loki", rules: 2, desc: "Loki 3100 from internal" },
      { id: "sg-minio", name: "platform-minio", rules: 1, desc: "S3 9000 from same network" },
      { id: "sg-harbor", name: "platform-harbor", rules: 2, desc: "Registry 443 from cluster nodes" },
    ],
    routers: [
      { id: "r-004", name: "platform-shared-router", status: "ACTIVE", gatewayIp: "10.0.0.1", routes: 8, ha: true },
    ],
    quotas: { ports: { used: 22, max: 100 }, floatingIps: { used: 3, max: 15 }, subnets: { used: 4, max: 10 } },
    bandwidth: { rxMbps: 1240.8, txMbps: 894.2, pktDropPct: 0.01 },
    floatingIps: [
      { ip: "203.0.113.60", mappedTo: "harbor-01", status: "ACTIVE" },
      { ip: "203.0.113.61", mappedTo: "minio-01", status: "ACTIVE" },
      { ip: "203.0.113.62", mappedTo: "grafana-01", status: "ACTIVE" },
    ],
  },
};

export default function NetworksPage() {
  const { data, isLoading } = api.iaas.networks() as {
    data: { items: IaasNetwork[] } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<IaasNetwork | undefined>();
  const [q, setQ] = React.useState("");
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const items = data.items.filter((n) => !q || n.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="네트워크" value={data.items.length} icon={NetworkIcon} accent="indigo" />
        <StatCard label="총 서브넷" value={data.items.reduce((s, n) => s + n.subnets, 0)} icon={Wifi} accent="sky" />
        <StatCard label="총 포트" value={data.items.reduce((s, n) => s + n.ports, 0)} icon={Plug} accent="mint" />
        <StatCard label="External 네트워크" value={data.items.filter((n) => n.type === "external").length} icon={Globe} accent="amber" />
      </div>

      <ChangeMark ids={["CR-IAAS-02", "CR-IAAS-05"]}>
<Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="네트워크 이름 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
            </div>
            {isAdmin && (
              <Button size="sm" className="ml-auto" onClick={() => toast.success("네트워크 생성 다이얼로그 (관리자)")}>
                <Plus className="size-3.5" /> 네트워크 생성
              </Button>
            )}
          </div>
          <div className="rounded-md border border-brand-indigo-200 bg-brand-indigo-50/50 p-2.5 text-[11px] text-brand-indigo-900">
            <strong>생성 주체:</strong> 네트워크 생성은 <strong>관리자 기능</strong>이다. 사용자는 관리자가 만든 네트워크 중에서 선택해 자원을 신청한다.
            Floating IP 할당·해제·회수, 라우터·보안 그룹·키페어 생성도 관리자 권한이다.
            {!isAdmin && <span className="ml-1">현재 사용자 역할 — 조회와 선택만 가능.</span>}
          </div>
        </div>
      </Card>
</ChangeMark>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>네트워크</TableHead>
              <TableHead>테넌트</TableHead>
              <TableHead>자원풀</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>CIDR</TableHead>
              <TableHead>VLAN</TableHead>
              <TableHead>서브넷</TableHead>
              <TableHead>포트</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((n) => (
              <TableRow key={n.id} className="cursor-pointer" onClick={() => setSelected(n)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-sky-100 p-1 text-sky-700">
                      <NetworkIcon className="size-4" />
                    </div>
                    <div>
                      <span className="font-medium">{n.name}</span>
                      <div className="font-mono text-[10px] text-muted-foreground">{n.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{n.tenantId}</TableCell>
                <TableCell className="font-mono text-xs">{n.poolId}</TableCell>
                <TableCell>
                  <Badge variant={n.type === "external" ? "default" : n.type === "shared" ? "warning" : "outline"}>
                    {n.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{n.cidr}</TableCell>
                <TableCell className="font-mono text-xs">{n.vlan ?? "—"}</TableCell>
                <TableCell className="font-mono tabular-nums">{n.subnets}</TableCell>
                <TableCell className="font-mono tabular-nums">{n.ports}</TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          {selected && <NetworkDetailPanel network={selected} onClose={() => setSelected(undefined)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NetworkDetailPanel({ network, onClose }: { network: IaasNetwork; onClose: () => void }) {
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const detail = DETAILS[network.id] ?? DETAILS["in-1"];
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} 복사됨`);
  };

  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <NetworkIcon className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-lg">{network.name}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {network.id} · {network.tenantId} · {network.poolId}
              </SheetDescription>
            </div>
          </div>
          <Badge variant={network.type === "external" ? "default" : network.type === "shared" ? "warning" : "outline"}>
            {network.type}
          </Badge>
        </div>
      </SheetHeader>

      <div className="space-y-4 p-6">
        {/* Quick info + bandwidth */}
        <div className="grid grid-cols-3 gap-3">
          <InfoBox label="CIDR" value={network.cidr} mono onCopy={() => copy(network.cidr, "CIDR")} />
          <InfoBox label="VLAN" value={network.vlan?.toString() ?? "—"} mono />
          <InfoBox label="Provider" value="OpenStack Neutron" />
        </div>

        {/* Bandwidth band */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold">실시간 대역폭</div>
            <Badge variant="ghost" className="font-mono text-[10px]">
              <span className="mr-1 size-1.5 animate-pulse rounded-full bg-brand-mint-500" />
              live
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <BWMetric label="RX" value={`${detail.bandwidth.rxMbps.toFixed(1)} Mbps`} color="text-brand-mint-600" />
            <BWMetric label="TX" value={`${detail.bandwidth.txMbps.toFixed(1)} Mbps`} color="text-brand-indigo-600" />
            <BWMetric label="Packet Drop" value={`${detail.bandwidth.pktDropPct.toFixed(2)}%`} color="text-amber-600" />
          </div>
        </Card>

        {/* Quotas */}
        <Card className="space-y-3 p-4">
          <div className="text-xs font-semibold">테넌트 Quota</div>
          <QuotaBar label="Ports" used={detail.quotas.ports.used} max={detail.quotas.ports.max} color="indigo" />
          <QuotaBar label="Floating IPs" used={detail.quotas.floatingIps.used} max={detail.quotas.floatingIps.max} color="mint" />
          <QuotaBar label="Subnets" used={detail.quotas.subnets.used} max={detail.quotas.subnets.max} color="amber" />
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="subnets">
          <TabsList>
            <TabsTrigger value="subnets">서브넷 ({detail.subnets.length})</TabsTrigger>
            <TabsTrigger value="ports">포트 ({detail.ports.length})</TabsTrigger>
            <TabsTrigger value="security">보안 그룹 ({detail.securityGroups.length})</TabsTrigger>
            <TabsTrigger value="routers">라우터 ({detail.routers.length})</TabsTrigger>
            <TabsTrigger value="fip">Floating IP ({detail.floatingIps.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="subnets" className="mt-3 space-y-2">
            {detail.subnets.map((s) => (
              <Card key={s.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Wifi className="size-4 text-sky-600" />
                      <span className="font-mono font-semibold">{s.name}</span>
                      <Badge variant="ghost" className="font-mono text-[10px]">{s.id}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <KV label="CIDR" value={s.cidr} />
                      <KV label="Gateway" value={s.gateway} />
                      <KV label="DHCP" value={s.dhcp ? "ON" : "OFF"} />
                      <KV label="DNS" value={s.dns.join(", ")} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Allocation Pool: <span className="font-mono">{s.allocationPool}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => copy(s.cidr, "Subnet CIDR")}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="ports" className="mt-3">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>포트</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>MAC</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.ports.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Plug className="size-3.5 text-brand-mint-600" />
                          <div>
                            <div className="font-mono text-xs">{p.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.ip}</TableCell>
                      <TableCell className="font-mono text-[10px]">{p.mac}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {p.deviceOwner}
                        {p.vm && <span className="ml-1 text-brand-indigo-600">→ {p.vm}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-3 space-y-2">
            {detail.securityGroups.map((sg) => (
              <Card key={sg.id} className="p-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 text-amber-600" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{sg.name}</span>
                      <Badge variant="outline" className="text-[10px]">{sg.rules} 규칙</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{sg.desc}</div>
                  </div>
                  <Button variant="ghost" size="sm">규칙 보기</Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="routers" className="mt-3 space-y-2">
            {detail.routers.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Router className="mt-0.5 size-4 text-brand-indigo-600" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{r.name}</span>
                      <Badge variant="success" className="text-[10px]">{r.status}</Badge>
                      {r.ha && <Badge variant="default" className="text-[10px]">HA</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <KV label="External IP" value={r.gatewayIp} />
                      <KV label="라우팅" value={`${r.routes} routes`} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="fip" className="mt-3">
            {detail.floatingIps.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                할당된 Floating IP가 없습니다.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Public IP</TableHead>
                      <TableHead>매핑된 자원</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.floatingIps.map((f) => (
                      <TableRow key={f.ip}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Globe className="size-3.5 text-brand-mint-600" />
                            <span className="font-mono">{f.ip}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{f.mappedTo}</TableCell>
                        <TableCell>
                          <Badge variant={f.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
                            {f.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => copy(f.ip, "Floating IP")} title="IP 복사">
                              <Copy className="size-3.5" />
                            </Button>
                            {isAdmin && (f.status === "ACTIVE" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => toast.success(`${f.ip} 연결 해제 — ${f.mappedTo}에서 detach`)}
                                title="연결 해제 (detach)"
                              >
                                해제
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => toast.success(`${f.ip} 재할당 대상 선택`)}
                                title="자원에 할당"
                              >
                                할당
                              </Button>
                            ))}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px] text-rose-600"
                                onClick={() => {
                                  if (f.status === "ACTIVE") {
                                    toast.error(`${f.ip} 회수 거부 — 먼저 해제하기`);
                                    return;
                                  }
                                  toast.success(`${f.ip} 풀로 반환됨 (release)`);
                                }}
                                title="Floating IP 회수 (release)"
                              >
                                회수
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm">서브넷 추가</Button>
          {isAdmin && <Button variant="outline" size="sm">FIP 할당</Button>}
          <Button variant="outline" size="sm">보안 그룹 편집</Button>
          <Button variant="destructive" size="sm" className="ml-auto">네트워크 삭제</Button>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; accent: "indigo" | "mint" | "amber" | "sky" }) {
  const map = {
    indigo: "bg-brand-indigo-100 text-brand-indigo-700",
    mint: "bg-brand-mint-50 text-brand-mint-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </div>
      <div className={cn("flex size-10 items-center justify-center rounded-md", map[accent])}>
        <Icon className="size-5" />
      </div>
    </Card>
  );
}

function InfoBox({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
        {label}
        {onCopy && (
          <button onClick={onCopy} className="hover:text-foreground">
            <Copy className="size-3" />
          </button>
        )}
      </div>
      <div className={cn("mt-0.5 font-semibold", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function BWMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-base font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function QuotaBar({ label, used, max, color }: { label: string; used: number; max: number; color: "indigo" | "mint" | "amber" }) {
  const pct = Math.round((used / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{used} / {max} ({pct}%)</span>
      </div>
      <Progress value={pct} className="h-1.5" indicatorClassName={color === "indigo" ? "bg-brand-indigo-500" : color === "mint" ? "bg-brand-mint-500" : "bg-amber-500"} />
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
