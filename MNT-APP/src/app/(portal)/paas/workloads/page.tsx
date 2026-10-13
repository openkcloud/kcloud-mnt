"use client";
/**
 * 워크로드 — 선택한 서비스 클러스터의 Deployment·StatefulSet·DaemonSet·Job·CronJob 라이브 조회.
 * 쓰기(생성·스케일·재시작·삭제)는 다음 단계에서 실연동과 함께 붙인다.
 * 레이아웃·폰트는 IaaS 목록 화면 규약(툴바 Card + 테이블 Card)과 동일.
 */
import * as React from "react";
import { Search, Loader2, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClusterScopeBar, useClusterScope } from "@/components/paas/cluster-scope-bar";
import { useWorkloads, type WorkloadRow } from "@/lib/paas-api";

const KINDS = ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"] as const;

function stVariant(s: string): "success" | "warning" | "destructive" | "secondary" {
  if (s === "Running" || s === "Succeeded") return "success";
  if (s === "Pending") return "warning";
  if (s === "Failed") return "destructive";
  return "secondary";
}

export default function WorkloadsPage() {
  const { clusterId } = useClusterScope();
  const [namespace, setNamespace] = React.useState("all");
  const [kind, setKind] = React.useState("all");
  const [q, setQ] = React.useState("");

  const workloads = useWorkloads(clusterId, namespace === "all" ? undefined : namespace);

  const items = (workloads.data ?? []).filter(
    (w) =>
      (kind === "all" || w.kind === kind) &&
      (!q || w.name.includes(q) || w.image.includes(q)),
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ClusterScopeBar
          queryKeys={[["paas-workloads"], ["paas-namespaces"]]}
          namespace={namespace}
          onNamespaceChange={setNamespace}
        >
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-36"><SelectValue placeholder="유형" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="워크로드 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-52 pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">총 {items.length}개</span>
        </ClusterScopeBar>
      </Card>

      <Card>
        {!clusterId ? (
          <EmptyBox text="먼저 서비스 클러스터를 선택하세요." />
        ) : workloads.isLoading ? (
          <Skeleton className="h-64" />
        ) : workloads.isError ? (
          <EmptyBox text="워크로드 조회 실패 — 클러스터 API 응답 오류." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>워크로드</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>네임스페이스</TableHead>
                <TableHead>이미지</TableHead>
                <TableHead>레플리카</TableHead>
                <TableHead>요청 자원</TableHead>
                <TableHead>가속기</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => <Row key={`${w.kind}/${w.namespace}/${w.name}`} w={w} />)}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    조건에 맞는 워크로드가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Row({ w }: { w: WorkloadRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-brand-indigo-600" />
          <span className="max-w-[220px] truncate font-mono text-sm font-semibold">{w.name}</span>
        </div>
      </TableCell>
      <TableCell><Badge variant="outline" className="text-[10px]">{w.kind}</Badge></TableCell>
      <TableCell className="font-mono text-xs">{w.namespace}</TableCell>
      <TableCell className="max-w-[260px] truncate font-mono text-[11px] text-muted-foreground">{w.image}</TableCell>
      <TableCell className="font-mono text-xs">
        {w.kind === "CronJob" ? (w.schedule || "—") : `${w.ready}/${w.total}`}
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">
        {[w.requests.cpu, w.requests.memory].filter(Boolean).join(" · ") || "—"}
      </TableCell>
      <TableCell>
        {w.accelerator ? (
          <Badge variant="default" className="font-mono text-[10px]">
            {w.accelerator.kind} × {w.accelerator.count}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={stVariant(w.status)} className="text-[10px]">
          {w.status === "Pending" && <Loader2 className="size-3 animate-spin" />}
          {w.status}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}
