"use client";
import * as React from "react";
import { Cpu, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm";
import { RefreshControls } from "@/components/iaas/refresh-controls";
import {
  useDeviceProfiles, useFlavors, useCreateDeviceProfile, useDeleteDeviceProfile,
  type DeviceProfile, type CreateDeviceProfileInput,
} from "@/lib/iaas-api";

// 디바이스 프로파일(Cyborg device-profile) — 전역(admin) 자원. 플레이버가 accel:device_profile 로 참조.
// Cyborg 는 불변이라 생성·삭제만(수정 없음).
export default function DeviceProfilesPage() {
  const { data, isLoading } = useDeviceProfiles();
  const { data: flavors } = useFlavors();
  const del = useDeleteDeviceProfile();
  const confirm = useConfirm();
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const items = data.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()));
  const linkedCount = (name: string) => (flavors ?? []).filter((f) => f.accelerator === name).length;

  async function remove(d: DeviceProfile) {
    const linked = linkedCount(d.name);
    const warn = linked > 0 ? ` 이 프로파일을 쓰는 플레이버 ${linked}개가 '사용 불가'가 됩니다.` : "";
    if (!(await confirm({
      title: "디바이스 프로파일 삭제", destructive: true, confirmLabel: "삭제",
      description: `${d.name} 을(를) 삭제할까요?${warn}`,
    }))) return;
    if (!d.uuid) return toast.error("uuid 가 없어 삭제할 수 없습니다");
    del.mutate(d.uuid, {
      onSuccess: () => toast.success(`디바이스 프로파일 ${d.name} 삭제됨`),
      onError: (e) => toast.error("삭제 실패", { description: String((e as Error).message) }),
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="프로파일 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">총 {items.length}개</span>
          <div className="ml-auto flex items-center gap-2">
            <RefreshControls queryKeys={[["iaas-device-profiles"]]} />
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> 프로파일 생성</Button>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>프로파일</TableHead>
              <TableHead>가속기</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="text-center">연결 플레이버</TableHead>
              <TableHead>UUID</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <TableRow key={d.uuid ?? d.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Cpu className="size-3.5 text-brand-indigo-600" />
                    <span className="font-mono text-sm font-semibold">{d.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {(d.accelerators ?? []).length
                    ? <div className="flex flex-wrap gap-1">{d.accelerators!.map((a) => (
                        <Badge key={a.kind} variant="default" className="font-mono text-[10px]">{a.kind} ×{a.count}</Badge>
                      ))}</div>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="max-w-56 truncate text-sm text-muted-foreground">{d.description || "—"}</TableCell>
                <TableCell className="text-center font-mono tabular-nums">{linkedCount(d.name)}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{d.uuid ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" title="삭제" disabled={del.isPending} onClick={() => remove(d)}>
                    <Trash2 className="size-3.5 text-rose-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">디바이스 프로파일이 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {createOpen && <CreateDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

// ── 생성 다이얼로그 — 이름·설명 + 그룹[](리소스·트레잇) ──
type ResRow = { cls: string; custom: string; count: string };
type TraitRow = { name: string; policy: "required" | "forbidden" };
type GroupRow = { resources: ResRow[]; traits: TraitRow[] };

const KNOWN_CLASSES = [
  { value: "PGPU", label: "PGPU (GPU)" },
  { value: "CUSTOM_AICHIP", label: "CUSTOM_AICHIP (NPU)" },
  { value: "__custom__", label: "직접 입력…" },
];
const newRes = (): ResRow => ({ cls: "PGPU", custom: "", count: "1" });
const newGroup = (): GroupRow => ({ resources: [newRes()], traits: [] });

function CreateDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateDeviceProfile();
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [groups, setGroups] = React.useState<GroupRow[]>(() => [newGroup()]);

  const patchGroup = (gi: number, fn: (g: GroupRow) => GroupRow) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? fn(g) : g)));

  function submit() {
    if (!name.trim()) return toast.error("이름을 입력하세요");
    const payloadGroups: CreateDeviceProfileInput["groups"] = [];
    for (const g of groups) {
      const resources = g.resources
        .map((r) => ({ resourceClass: (r.cls === "__custom__" ? r.custom : r.cls).trim(), count: Number(r.count) }))
        .filter((r) => r.resourceClass && r.count >= 1);
      if (!resources.length) return toast.error("각 그룹에 리소스(클래스·개수)를 하나 이상 입력하세요");
      const traits = g.traits
        .map((t) => ({ name: t.name.trim(), policy: t.policy }))
        .filter((t) => t.name);
      payloadGroups.push({ resources, traits });
    }
    create.mutate(
      { name: name.trim(), description: desc.trim() || undefined, groups: payloadGroups },
      {
        onSuccess: (d) => { toast.success(`디바이스 프로파일 ${d.name} 생성됨`); onClose(); },
        onError: (e) => toast.error("생성 실패", { description: String((e as Error).message) }),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>디바이스 프로파일 생성</DialogTitle>
          <DialogDescription>Cyborg device-profile. 그룹마다 가속기 리소스 클래스·개수와(선택) 트레잇을 지정합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="gpu-1x" />
            </div>
            <div className="space-y-1.5">
              <Label>설명 (선택)</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="NVIDIA A100 1장" />
            </div>
          </div>

          {groups.map((g, gi) => (
            <div key={gi} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">그룹 {gi + 1}</span>
                {groups.length > 1 && (
                  <Button variant="ghost" size="icon-sm" title="그룹 삭제" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}>
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>

              {/* 리소스 */}
              <div className="space-y-2">
                <Label className="text-[11px]">리소스 (가속기 클래스 · 개수)</Label>
                {g.resources.map((r, ri) => (
                  <div key={ri} className="flex items-center gap-2">
                    <Select value={r.cls} onValueChange={(v) => patchGroup(gi, (gr) => ({ ...gr, resources: gr.resources.map((x, i) => i === ri ? { ...x, cls: v } : x) }))}>
                      <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                      <SelectContent>{KNOWN_CLASSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {r.cls === "__custom__" && (
                      <Input className="w-44 font-mono text-xs" placeholder="CUSTOM_XPU" value={r.custom}
                        onChange={(e) => patchGroup(gi, (gr) => ({ ...gr, resources: gr.resources.map((x, i) => i === ri ? { ...x, custom: e.target.value } : x) }))} />
                    )}
                    <Input type="number" min={1} className="w-20" value={r.count}
                      onChange={(e) => patchGroup(gi, (gr) => ({ ...gr, resources: gr.resources.map((x, i) => i === ri ? { ...x, count: e.target.value } : x) }))} />
                    {g.resources.length > 1 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => patchGroup(gi, (gr) => ({ ...gr, resources: gr.resources.filter((_, i) => i !== ri) }))}>
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => patchGroup(gi, (gr) => ({ ...gr, resources: [...gr.resources, newRes()] }))}>
                  <Plus className="size-3.5" /> 리소스 추가
                </Button>
              </div>

              {/* 트레잇(고급) */}
              <div className="space-y-2">
                <Label className="text-[11px]">트레잇 (선택 · 특정 하드웨어 지정)</Label>
                {g.traits.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-2">
                    <Input className="flex-1 font-mono text-xs" placeholder="CUSTOM_AICHIP_FURIOSA" value={t.name}
                      onChange={(e) => patchGroup(gi, (gr) => ({ ...gr, traits: gr.traits.map((x, i) => i === ti ? { ...x, name: e.target.value } : x) }))} />
                    <Select value={t.policy} onValueChange={(v) => patchGroup(gi, (gr) => ({ ...gr, traits: gr.traits.map((x, i) => i === ti ? { ...x, policy: v as TraitRow["policy"] } : x) }))}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">required</SelectItem>
                        <SelectItem value="forbidden">forbidden</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon-sm" onClick={() => patchGroup(gi, (gr) => ({ ...gr, traits: gr.traits.filter((_, i) => i !== ti) }))}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => patchGroup(gi, (gr) => ({ ...gr, traits: [...gr.traits, { name: "", policy: "required" }] }))}>
                  <Plus className="size-3.5" /> 트레잇 추가
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={() => setGroups((gs) => [...gs, newGroup()])}>
            <Plus className="size-3.5" /> 그룹 추가
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>취소</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "생성 중…" : "생성"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
