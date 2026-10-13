"use client";
/**
 * 설정 관리 — 선택한 서비스 클러스터의 ConfigMap·Secret 라이브 조회.
 * 값은 표시하지 않는다(키 목록만) — 값 열람·편집은 다음 단계에서 권한과 함께.
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
import { useK8sConfigs } from "@/lib/paas-api";

export default function ConfigPage() {
  const { clusterId } = useClusterScope();
  const [namespace, setNamespace] = React.useState("all");
  const [q, setQ] = React.useState("");

  const data = useK8sConfigs(clusterId, namespace === "all" ? undefined : namespace);
  const cms = (data.data?.configmaps ?? []).filter((c) => !q || c.name.includes(q));
  const secrets = (data.data?.secrets ?? []).filter((s) => !q || s.name.includes(q));

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <ClusterScopeBar
          queryKeys={[["paas-configs"], ["paas-namespaces"]]}
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
          <Empty error text="설정 조회 실패 — 클러스터 API 응답 오류." />
        ) : (
          <Tabs defaultValue="cm">
            <TabsList>
              <TabsTrigger value="cm">ConfigMap ({cms.length})</TabsTrigger>
              <TabsTrigger value="secret">Secret ({secrets.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>네임스페이스</TableHead>
                    <TableHead>키</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cms.map((c) => (
                    <TableRow key={`${c.namespace}/${c.name}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.namespace}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[420px] flex-wrap gap-1">
                          {c.keys.slice(0, 6).map((k) => (
                            <Badge key={k} variant="outline" className="font-mono text-[10px]">{k}</Badge>
                          ))}
                          {c.keys.length > 6 && (
                            <span className="text-[11px] text-muted-foreground">+{c.keys.length - 6}</span>
                          )}
                          {c.keys.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cms.length === 0 && <EmptyRow colSpan={3} />}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="secret">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> 값은 포털에 표시하지 않습니다(키 목록만).
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>네임스페이스</TableHead>
                    <TableHead>타입</TableHead>
                    <TableHead>키</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((s) => (
                    <TableRow key={`${s.namespace}/${s.name}`}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.namespace}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">{s.type}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[360px] flex-wrap gap-1">
                          {s.keys.slice(0, 5).map((k) => (
                            <Badge key={k} variant="outline" className="font-mono text-[10px]">{k}</Badge>
                          ))}
                          {s.keys.length > 5 && (
                            <span className="text-[11px] text-muted-foreground">+{s.keys.length - 5}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {secrets.length === 0 && <EmptyRow colSpan={4} />}
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
