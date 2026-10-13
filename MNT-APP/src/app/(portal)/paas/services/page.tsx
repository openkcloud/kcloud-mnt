"use client";
/**
 * 서비스·인그레스 — 선택한 서비스 클러스터의 Service·Ingress 라이브 조회.
 * 쓰기(생성·편집·삭제)는 다음 단계.
 */
import * as React from "react";
import { Search, AlertCircle, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClusterScopeBar, useClusterScope } from "@/components/paas/cluster-scope-bar";
import { useK8sServices } from "@/lib/paas-api";

export default function ServicesPage() {
  const { clusterId } = useClusterScope();
  const [namespace, setNamespace] = React.useState("all");
  const [q, setQ] = React.useState("");

  const data = useK8sServices(clusterId, namespace === "all" ? undefined : namespace);
  const services = (data.data?.services ?? []).filter((s) => !q || s.name.includes(q));
  const ingresses = (data.data?.ingresses ?? []).filter((i) => !q || i.name.includes(q));

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <ClusterScopeBar
          queryKeys={[["paas-services"], ["paas-namespaces"]]}
          namespace={namespace}
          onNamespaceChange={setNamespace}
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 검색" className="w-[240px] pl-9 text-xs" />
          </div>
        </div>

        {!clusterId ? (
          <Empty text="먼저 서비스 클러스터를 선택하세요." />
        ) : data.isLoading ? (
          <Skeleton className="h-64" />
        ) : data.isError ? (
          <Empty error text="서비스 조회 실패 — 클러스터 API 응답 오류." />
        ) : (
          <Tabs defaultValue="services">
            <TabsList>
              <TabsTrigger value="services">Service ({services.length})</TabsTrigger>
              <TabsTrigger value="ingresses">Ingress ({ingresses.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="services">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>네임스페이스</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>Cluster IP</TableHead>
                    <TableHead>External IP</TableHead>
                    <TableHead>포트</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={`${s.namespace}/${s.name}`}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.namespace}</TableCell>
                      <TableCell>
                        <Badge variant={s.type === "LoadBalancer" ? "default" : "outline"} className="text-[10px]">{s.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.clusterIp || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{s.externalIp || "—"}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {s.ports.map((p) => `${p.port}→${p.targetPort}/${p.protocol}`).join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {services.length === 0 && <EmptyRow colSpan={6} />}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="ingresses">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>네임스페이스</TableHead>
                    <TableHead>클래스</TableHead>
                    <TableHead>호스트</TableHead>
                    <TableHead>TLS</TableHead>
                    <TableHead>규칙 수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingresses.map((i) => (
                    <TableRow key={`${i.namespace}/${i.name}`}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="font-mono text-xs">{i.namespace}</TableCell>
                      <TableCell className="font-mono text-xs">{i.className || "—"}</TableCell>
                      <TableCell className="max-w-[260px] truncate font-mono text-xs">{i.hosts.join(", ") || "*"}</TableCell>
                      <TableCell>
                        {i.tls ? (
                          <Badge variant="success" className="gap-1 text-[10px]"><Lock className="size-3" /> TLS</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.ruleCount}</TableCell>
                    </TableRow>
                  ))}
                  {ingresses.length === 0 && <EmptyRow colSpan={6} />}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
}

function Empty({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={`flex items-center gap-2 py-10 text-sm ${error ? "text-rose-500" : "text-muted-foreground"}`}>
      <AlertCircle className="size-4" /> {text}
    </div>
  );
}
function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        항목이 없습니다.
      </TableCell>
    </TableRow>
  );
}
