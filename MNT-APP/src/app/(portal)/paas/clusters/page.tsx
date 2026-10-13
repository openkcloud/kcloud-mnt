"use client";
/**
 * 서비스 클러스터 — 사용자 관점(내 K8s 클러스터를 어떻게 쓰나).
 *
 * 데이터: MNT-PAAS(/api/paas/clusters) ← Magnum 라이브. 동기화 버튼 없음(폴링).
 * 생성·삭제는 자원 요청 메뉴(관리자 승인 → Magnum) — 여기엔 신청 버튼을 두지 않는다.
 * 관리 클러스터(물리·전력·계층)는 사용자 관심 밖 → 토폴로지·모니터링 화면 영역.
 */
import * as React from "react";
import { Boxes, Download, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshControls } from "@/components/iaas/refresh-controls";
import { useProjects, useFlavors } from "@/lib/iaas-api";
import { useClusters, useCluster, kubeconfigUrl, type ClusterSummary } from "@/lib/paas-api";

/** Magnum 상태 → 배지 톤. *_IN_PROGRESS 는 진행 중(폴링 대상). */
function statusVariant(s: string): "success" | "warning" | "destructive" | "secondary" {
  if (s.endsWith("_COMPLETE")) return "success";
  if (s.endsWith("_IN_PROGRESS")) return "warning";
  if (s.endsWith("_FAILED")) return "destructive";
  return "secondary";
}

/** UTC ISO → 로컬(KST) 표기 */
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour12: false });
}

export default function ClustersPage() {
  const clusters = useClusters();
  const projects = useProjects();
  const flavors = useFlavors();
  const [projFilter, setProjFilter] = React.useState("all");
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const projName = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects.data?.items ?? []) m.set(p.id, p.name);
    return m;
  }, [projects.data]);

  /** flavor 이름 → 가속기 표기(dp-rngd 등). IaaS flavors 의 extra_spec 매핑 재사용. */
  const flavorAccel = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const f of flavors.data ?? []) if (f.accelerator) m.set(f.name, f.accelerator);
    return m;
  }, [flavors.data]);

  const rows = (clusters.data ?? []).filter(
    (c) => projFilter === "all" || c.projectId === projFilter,
  );

  if (clusters.isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Boxes className="size-4 text-brand-indigo-700" />
          <span className="text-sm font-semibold">서비스 클러스터</span>
          <Badge variant="ghost" className="font-mono text-[10px]">Magnum /v1/clusters</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Select value={projFilter} onValueChange={setProjFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="프로젝트 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 프로젝트</SelectItem>
                {(projects.data?.items ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RefreshControls queryKeys={[["paas-clusters"]]} />
          </div>
        </div>

        {clusters.isError ? (
          <div className="flex items-center gap-2 py-8 text-sm text-rose-500">
            <AlertCircle className="size-4" /> 클러스터 목록 조회 실패 — MNT-PAAS 응답 오류.
          </div>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>프로젝트</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>K8s 버전</TableHead>
                <TableHead>노드(마스터+워커)</TableHead>
                <TableHead>워커 사양</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <ClusterRow
                  key={c.id}
                  c={c}
                  projectName={projName.get(c.projectId) ?? (c.projectId || "—").slice(0, 8)}
                  accel={flavorAccel.get(c.flavorId) ?? null}
                  onDetail={() => setDetailId(c.id)}
                />
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    서비스 클러스터가 없습니다. 클러스터가 필요하면 자원 요청 메뉴에서 신청하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {detailId && <ClusterDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function ClusterRow({
  c, projectName, accel, onDetail,
}: {
  c: ClusterSummary; projectName: string; accel: string | null; onDetail: () => void;
}) {
  const ready = c.status.endsWith("_COMPLETE") && !!c.apiAddress;
  return (
    <TableRow className="cursor-pointer" onClick={onDetail}>
      <TableCell className="text-xs">{projectName}</TableCell>
      <TableCell className="font-medium">{c.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge variant={statusVariant(c.status)} className="text-[10px]">
            {c.status.endsWith("_IN_PROGRESS") && <Loader2 className="size-3 animate-spin" />}
            {c.status}
          </Badge>
          {c.healthStatus && (
            <Badge variant={c.healthStatus === "HEALTHY" ? "outline" : "destructive"} className="text-[10px]">
              {c.healthStatus}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{c.k8sVersion || "—"}</TableCell>
      <TableCell className="font-mono text-xs">{c.masterCount} + {c.nodeCount}</TableCell>
      <TableCell>
        <span className="font-mono text-xs">{c.flavorId}</span>
        {accel && <Badge variant="secondary" className="ml-1.5 text-[10px]">{accel}</Badge>}
      </TableCell>
      <TableCell className="font-mono text-xs">{fmtDateTime(c.createdAt)}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {ready ? (
          <Button asChild size="sm" variant="outline" title="kubeconfig 다운로드">
            <a href={kubeconfigUrl(c.id)} download>
              <Download className="size-3.5" /> kubeconfig
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled title="클러스터가 준비되면 받을 수 있습니다">
            <Download className="size-3.5" /> kubeconfig
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function ClusterDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: d, isLoading, isError } = useCluster(id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {isLoading || !d ? (
          isError ? (
            <div className="py-10 text-center text-sm text-rose-500">상세 조회 실패</div>
          ) : (
            <Skeleton className="h-72" />
          )
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {d.name}
                <Badge variant={statusVariant(d.status)} className="text-[10px]">{d.status}</Badge>
                {d.healthStatus && (
                  <Badge variant={d.healthStatus === "HEALTHY" ? "outline" : "destructive"} className="text-[10px]">
                    {d.healthStatus}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{d.id}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="K8s 버전" value={d.k8sVersion || "—"} mono />
              <Field label="API 주소" value={d.apiAddress || "—"} mono />
              <Field label="생성일" value={fmtDateTime(d.createdAt)} mono />
              <Field label="변경일" value={fmtDateTime(d.updatedAt)} mono />
              {d.statusReason && <Field label="상태 사유" value={d.statusReason} />}
            </div>

            {Object.keys(d.healthReason).length > 0 && (
              <div className="rounded-md border border-border p-3">
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">헬스 체크</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(d.healthReason).map(([k, v]) => (
                    <Badge key={k} variant={v === "Ready" ? "outline" : "destructive"} className="font-mono text-[10px]">
                      {k}: {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">노드풀</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>노드 수</TableHead>
                    <TableHead>Flavor</TableHead>
                    <TableHead>이미지</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.nodegroups.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="text-xs">{g.name}</TableCell>
                      <TableCell>
                        <Badge variant={g.role === "master" ? "secondary" : "outline"} className="text-[10px]">{g.role}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{g.nodeCount}</TableCell>
                      <TableCell className="font-mono text-xs">{g.flavorId}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">{g.imageId}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(g.status)} className="text-[10px]">{g.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              {d.apiAddress ? (
                <Button asChild size="sm">
                  <a href={kubeconfigUrl(d.id)} download>
                    <Download className="size-3.5" /> kubeconfig 다운로드
                  </a>
                </Button>
              ) : (
                <Button size="sm" disabled>
                  <Download className="size-3.5" /> kubeconfig 다운로드
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-xs" : "truncate text-xs"}>{value}</span>
    </div>
  );
}
