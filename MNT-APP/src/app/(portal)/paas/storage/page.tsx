"use client";
/**
 * 스토리지 — 선택한 서비스 클러스터의 PVC·PV·StorageClass 라이브 조회.
 * 권한 정책: PVC 는 조회(추가 볼륨은 추후 '볼륨 요청' 흐름), PV 는 관리자 전용 탭,
 * StorageClass 는 전원 읽기전용(생성·수정은 관리자·인프라 영역 — Magnum 이 기본 설치).
 */
import * as React from "react";
import { AlertCircle, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClusterScopeBar, useClusterScope } from "@/components/paas/cluster-scope-bar";
import { useK8sStorage } from "@/lib/paas-api";
import { useAuth } from "@/lib/auth";

function pvcVariant(s: string): "success" | "warning" | "secondary" {
  if (s === "Bound") return "success";
  if (s === "Pending") return "warning";
  return "secondary";
}

export default function StoragePage() {
  const { clusterId } = useClusterScope();
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [namespace, setNamespace] = React.useState("all");

  const data = useK8sStorage(clusterId, namespace === "all" ? undefined : namespace);
  const pvcs = data.data?.pvcs ?? [];
  const pvs = data.data?.pvs ?? [];
  const scs = data.data?.storageClasses ?? [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <ClusterScopeBar
          queryKeys={[["paas-storage"], ["paas-namespaces"]]}
          namespace={namespace}
          onNamespaceChange={setNamespace}
        />

        {!clusterId ? (
          <Empty text="먼저 서비스 클러스터를 선택하세요." />
        ) : data.isLoading ? (
          <Skeleton className="h-64" />
        ) : data.isError ? (
          <Empty error text="스토리지 조회 실패 — 클러스터 API 응답 오류." />
        ) : (
          <Tabs defaultValue="pvc">
            <TabsList>
              <TabsTrigger value="pvc">PVC ({pvcs.length})</TabsTrigger>
              {isAdmin && <TabsTrigger value="pv">PV ({pvs.length})</TabsTrigger>}
              <TabsTrigger value="sc">StorageClass ({scs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pvc">
              <p className="mb-2 text-[11px] text-muted-foreground">
                볼륨 추가·확장은 별도 볼륨 요청으로 진행합니다(준비 중). 여기서는 현황을 확인합니다.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>네임스페이스</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>용량</TableHead>
                    <TableHead>접근 모드</TableHead>
                    <TableHead>StorageClass</TableHead>
                    <TableHead>볼륨</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pvcs.map((p) => (
                    <TableRow key={`${p.namespace}/${p.name}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.namespace}</TableCell>
                      <TableCell><Badge variant={pvcVariant(p.status)} className="text-[10px]">{p.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.capacity || "—"}</TableCell>
                      <TableCell className="font-mono text-[11px]">{p.accessModes.join(", ")}</TableCell>
                      <TableCell className="font-mono text-xs">{p.storageClass || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground">{p.volumeName || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {pvcs.length === 0 && <EmptyRow colSpan={7} />}
                </TableBody>
              </Table>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="pv">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>용량</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>Claim</TableHead>
                      <TableHead>Reclaim</TableHead>
                      <TableHead>StorageClass</TableHead>
                      <TableHead>CSI 드라이버</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pvs.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="max-w-[220px] truncate font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.capacity}</TableCell>
                        <TableCell><Badge variant={p.status === "Bound" ? "success" : "secondary"} className="text-[10px]">{p.status}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{p.claim || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reclaimPolicy}</TableCell>
                        <TableCell className="font-mono text-xs">{p.storageClass || "—"}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{p.csiDriver || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {pvs.length === 0 && <EmptyRow colSpan={7} />}
                  </TableBody>
                </Table>
              </TabsContent>
            )}

            <TabsContent value="sc">
              <p className="mb-2 text-[11px] text-muted-foreground">
                StorageClass 는 클러스터 생성 시 구성됩니다(Cinder CSI → Ceph). 조회 전용.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>Provisioner</TableHead>
                    <TableHead>Reclaim</TableHead>
                    <TableHead>Binding</TableHead>
                    <TableHead>기본</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scs.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.provisioner}</TableCell>
                      <TableCell className="font-mono text-xs">{s.reclaimPolicy}</TableCell>
                      <TableCell className="font-mono text-xs">{s.bindingMode}</TableCell>
                      <TableCell>
                        {s.isDefault && <Badge variant="success" className="gap-1 text-[10px]"><Star className="size-3" /> 기본</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {scs.length === 0 && <EmptyRow colSpan={5} />}
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
