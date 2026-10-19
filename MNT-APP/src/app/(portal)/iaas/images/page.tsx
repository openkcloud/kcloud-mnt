"use client";
import * as React from "react";
import { Disc, Search, Trash2, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm";
import { RefreshControls } from "@/components/iaas/refresh-controls";
import { useImages, useSetImageVisibility, useDeleteImage, useProjects, byProjectThenName, type ImageSummary } from "@/lib/iaas-api";

const VIS_VARIANT: Record<string, "success" | "secondary" | "warning" | "outline"> = {
  public: "success", shared: "warning", private: "outline", community: "secondary",
};

// 이미지 — OpenStack Glance 실연동(라이브 조회, 포털 DB 캐시 없음). 관리자 전용.
export default function ImagesPage() {
  const { data, isLoading } = useImages();
  const { data: projData } = useProjects();
  const del = useDeleteImage();
  const confirm = useConfirm();
  const [q, setQ] = React.useState("");
  const [projFilter, setProjFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<ImageSummary | undefined>();

  const projName = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projData?.items ?? []) m[p.id] = p.name;
    return (id: string) => m[id] || id.slice(0, 8) || "—";
  }, [projData]);
  const projOptions = React.useMemo(() => {
    const ids = Array.from(new Set((data ?? []).map((i) => i.tenantId).filter(Boolean)));
    return ids.map((id) => ({ id, name: projName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, projName]);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const items = data.filter(
    (i) => (!q || i.name.toLowerCase().includes(q.toLowerCase())) && (projFilter === "all" || i.tenantId === projFilter),
  ).sort(byProjectThenName(projName));

  async function remove(img: ImageSummary) {
    if (img.protected) {
      await confirm({ title: "삭제 불가", confirmLabel: "확인", description: "보호(protected) 이미지입니다. 보호 해제 후 삭제할 수 있습니다." });
      return;
    }
    if (!(await confirm({ title: "이미지 삭제", destructive: true, confirmLabel: "삭제", description: `${img.name} 을(를) 삭제할까요? 되돌릴 수 없습니다.` }))) return;
    del.mutate(img.id, {
      onSuccess: () => toast.success(`이미지 ${img.name} 삭제됨`),
      onError: (e) => toast.error("삭제 실패", { description: String((e as Error).message) }),
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Select value={projFilter} onValueChange={setProjFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="프로젝트 필터" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 프로젝트</SelectItem>
              {projOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="이미지 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">총 {items.length}개</span>
          <div className="ml-auto"><RefreshControls queryKeys={[["iaas-images"]]} /></div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>프로젝트</TableHead>
              <TableHead>이미지</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>포맷</TableHead>
              <TableHead className="text-center">크기</TableHead>
              <TableHead>가시성</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelected(i)}>
                <TableCell className="text-xs font-medium">{i.tenantId ? projName(i.tenantId) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Disc className="size-3.5 text-brand-indigo-600" />
                    <span className="max-w-[220px] truncate font-mono text-sm font-semibold">{i.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{i.os || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{i.diskFormat}</TableCell>
                <TableCell className="text-center font-mono tabular-nums">{i.sizeGb}GB</TableCell>
                <TableCell><Badge variant={VIS_VARIANT[i.visibility] ?? "secondary"} className="text-[10px]">{i.visibility}</Badge></TableCell>
                <TableCell><Badge variant={i.status === "active" ? "success" : "secondary"} className="text-[10px]">{i.status}</Badge></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(i)}><Settings className="size-3.5" /> 관리</Button>
                    <Button variant="ghost" size="icon-sm" title="삭제" disabled={del.isPending} onClick={() => remove(i)}>
                      <Trash2 className="size-3.5 text-rose-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">이미지가 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(undefined)}>
        <DialogContent className="max-w-xl">
          {selected && <ImageDetailBody image={selected} projectLabel={projName(selected.tenantId)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageDetailBody({ image, projectLabel }: { image: ImageSummary; projectLabel: string }) {
  const setVis = useSetImageVisibility();
  const [vis, setVis_] = React.useState(image.visibility);

  function applyVis(v: string) {
    setVis_(v);
    setVis.mutate({ id: image.id, visibility: v }, {
      onSuccess: () => toast.success(`가시성 → ${v}`),
      onError: (e) => { setVis_(image.visibility); toast.error("가시성 변경 실패", { description: String((e as Error).message) }); },
    });
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3 pr-8">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <Disc className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate font-mono text-lg">{image.name}</DialogTitle>
            <DialogDescription className="truncate text-xs"><span className="font-mono">{image.id}</span> · 프로젝트 {projectLabel}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <Card className="space-y-2.5 p-4 text-xs">
        <KV label="OS" value={image.os || "—"} />
        <KV label="디스크 포맷" value={image.diskFormat} mono />
        <KV label="컨테이너 포맷" value={image.containerFormat || "—"} mono />
        <KV label="크기" value={`${image.sizeGb} GB`} />
        <KV label="최소 디스크/RAM" value={`${image.minDisk}GB / ${image.minRam}MB`} />
        <KV label="상태" value={image.status} />
        <KV label="보호(protected)" value={image.protected ? "예" : "아니오"} />
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-muted-foreground">가시성</span>
          <Select value={vis} onValueChange={applyVis}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">public</SelectItem>
              <SelectItem value="private">private</SelectItem>
              <SelectItem value="shared">shared</SelectItem>
              <SelectItem value="community">community</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {setVis.isPending && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" /> 변경 중…</div>}
      </Card>
    </>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "min-w-0 break-all text-right font-mono" : "min-w-0 break-words text-right"}>{value}</span>
    </div>
  );
}
