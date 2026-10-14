"use client";
/**
 * 서비스 클러스터 — 사용자 관점(내 K8s 클러스터를 어떻게 쓰나). Magnum 라이브.
 * 생성·삭제는 자원 요청 메뉴(관리자 승인 → Magnum) — 여기엔 신청 버튼을 두지 않는다.
 * 레이아웃·폰트는 IaaS 목록 화면 규약(툴바 Card + 테이블 Card, font-mono 셀)과 동일.
 */
import * as React from "react";
import { Boxes, Download, Search, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/lib/auth";
import { useMyProjectIds } from "@/lib/member-api";

/** Magnum 상태 → 배지 톤. *_IN_PROGRESS 는 진행 중(폴링 대상). */
function stVariant(s: string): "success" | "warning" | "destructive" | "secondary" {
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
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const myUsername = useAuth((s) => s.user?.username);
  const { data: myProjectIds } = useMyProjectIds(isAdmin ? undefined : myUsername);
  const clusters = useClusters();
  const projects = useProjects();
  const flavors = useFlavors();
  const [q, setQ] = React.useState("");
  const [projFilter, setProjFilter] = React.useState("all");
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const projName = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects.data?.items ?? []) m[p.id] = p.name;
    return (id: string) => m[id] || id.slice(0, 8) || "—";
  }, [projects.data]);

  /** flavor 이름 → 가속기 표기(dp-rngd 등). IaaS flavors 의 extra_spec 매핑 재사용. */
  const flavorAccel = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const f of flavors.data ?? []) if (f.accelerator) m.set(f.name, f.accelerator);
    return m;
  }, [flavors.data]);

  // 내가 볼 수 있는 클러스터 = 관리자 전체 / 사용자는 내 프로젝트 멤버십에 속한 것만
  const visible = React.useMemo(
    () => (clusters.data ?? []).filter((c) => isAdmin || myProjectIds?.has(c.projectId)),
    [clusters.data, isAdmin, myProjectIds],
  );

  const projOptions = React.useMemo(() => {
    const ids = Array.from(new Set(visible.map((c) => c.projectId).filter(Boolean)));
    return ids.map((id) => ({ id, name: projName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [visible, projName]);

  if (clusters.isLoading) return <Skeleton className="h-96" />;

  const items = visible.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q.toLowerCase())) &&
      (projFilter === "all" || c.projectId === projFilter),
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Select value={projFilter} onValueChange={setProjFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="프로젝트 필터" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 프로젝트</SelectItem>
              {projOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="클러스터 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-52 pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">총 {items.length}개</span>
          <div className="ml-auto"><RefreshControls queryKeys={[["paas-clusters"]]} /></div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>프로젝트</TableHead>
              <TableHead>클러스터</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>K8s 버전</TableHead>
              <TableHead>노드(마스터+워커)</TableHead>
              <TableHead>워커 사양</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clusters.isError && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  클러스터 목록 조회 실패 — MNT-PAAS 응답 오류.
                </TableCell>
              </TableRow>
            )}
            {!clusters.isError && items.map((c) => (
              <ClusterRow
                key={c.id}
                c={c}
                projectName={projName(c.projectId)}
                accel={flavorAccel.get(c.flavorId) ?? null}
                onDetail={() => setDetailId(c.id)}
              />
            ))}
            {!clusters.isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  서비스 클러스터가 없습니다. 클러스터가 필요하면 자원 요청 메뉴에서 신청하세요.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
      <TableCell className="text-xs font-medium">{projectName}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Boxes className="size-3.5 text-brand-indigo-600" />
          <span className="max-w-[200px] truncate font-mono text-sm font-semibold">{c.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge variant={stVariant(c.status)} className="text-[10px]">
            {c.status.endsWith("_IN_PROGRESS") && <Loader2 className="size-3 animate-spin" />}
            {c.status}
          </Badge>
          {c.healthStatus && c.healthStatus !== "HEALTHY" && (
            <Badge variant="outline" className="text-[10px]">{c.healthStatus}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{c.k8sVersion || "—"}</TableCell>
      <TableCell className="font-mono text-xs">{c.masterCount} + {c.nodeCount}</TableCell>
      <TableCell>
        <span className="font-mono text-xs">{c.flavorId}</span>
        {accel && <Badge variant="default" className="ml-1.5 font-mono text-[10px]">{accel}</Badge>}
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">{fmtDateTime(c.createdAt)}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        {ready ? (
          <Button asChild variant="ghost" size="icon-sm" title="kubeconfig 다운로드">
            <a href={kubeconfigUrl(c.id)} download><Download className="size-3.5" /></a>
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" disabled title="클러스터가 준비되면 받을 수 있습니다">
            <Download className="size-3.5" />
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
      {/* grid 자식이 min-content 로 모달을 뚫지 않게 max-h+세로 스크롤, 노드풀 표 여유폭 3xl */}
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {isLoading || !d ? (
          isError ? (
            <div className="py-10 text-center text-sm text-muted-foreground">상세 조회 실패</div>
          ) : (
            <Skeleton className="h-72" />
          )
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Boxes className="size-4 text-brand-indigo-600" />
                <span className="font-mono">{d.name}</span>
                <Badge variant={stVariant(d.status)} className="text-[10px]">{d.status}</Badge>
                {d.healthStatus && (
                  <Badge variant={d.healthStatus === "HEALTHY" ? "success" : "outline"} className="text-[10px]">
                    {d.healthStatus}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{d.id}</DialogDescription>
            </DialogHeader>

            <Card className="min-w-0 space-y-2.5 p-4 text-xs">
              <Field label="K8s 버전" value={d.k8sVersion || "—"} mono />
              <Field label="API 주소" value={d.apiAddress || "—"} mono />
              <Field label="생성일" value={fmtDateTime(d.createdAt)} mono />
              <Field label="변경일" value={fmtDateTime(d.updatedAt)} mono />
              {d.statusReason && <Field label="상태 사유" value={d.statusReason} />}
              {Object.keys(d.healthReason).length > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">헬스 체크</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {Object.entries(d.healthReason).map(([k, v]) => (
                      <Badge key={k} variant={v === "Ready" ? "success" : "outline"} className="font-mono text-[10px]">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="min-w-0">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">노드풀</div>
              <Card className="overflow-hidden">
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
                        <TableCell className="text-xs font-medium">{g.name}</TableCell>
                        <TableCell>
                          <Badge variant={g.role === "master" ? "secondary" : "outline"} className="text-[10px]">{g.role}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{g.nodeCount}</TableCell>
                        <TableCell className="font-mono text-xs">{g.flavorId}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">{g.imageId}</TableCell>
                        <TableCell>
                          <Badge variant={stVariant(g.status)} className="text-[10px]">{g.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
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
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "min-w-0 truncate font-mono" : "min-w-0 truncate"}>{value}</span>
    </div>
  );
}
