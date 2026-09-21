"use client";
import * as React from "react";
import { ShieldCheck, Plus, Trash2, Save, Undo2, Sparkles, Boxes, Cpu, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChangeMark } from "@/components/change-mark";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Permission {
  id: string;
  label: string;
  category: string;
  admin: boolean;
  user: boolean;
  custom?: boolean;
}

const INITIAL_PERMS: Permission[] = [
  { id: "acc.read", label: "AI반도체 자원 조회", category: "AI 인프라", admin: true, user: true },
  { id: "acc.assign", label: "AI반도체 자원 할당·해제", category: "AI 인프라", admin: true, user: true },
  { id: "vm.lifecycle", label: "VM 라이프사이클 제어", category: "IaaS", admin: true, user: true },
  { id: "vm.migrate", label: "VM 마이그레이션", category: "IaaS", admin: true, user: false },
  { id: "k8s.deploy", label: "K8s 워크로드 배포", category: "PaaS", admin: true, user: true },
  { id: "k8s.cluster", label: "K8s 클러스터 생성/삭제", category: "PaaS", admin: true, user: false },
  { id: "kf.profile", label: "Kubeflow Profile 생성", category: "AI 개발환경", admin: true, user: false },
  { id: "kf.notebook", label: "Notebook 생성·실행", category: "AI 개발환경", admin: true, user: true },
  { id: "kf.serve", label: "추론 서비스 게시 (KServe)", category: "AI 개발환경", admin: true, user: true },
  { id: "tenant.quota", label: "테넌트 쿼터 변경", category: "운영", admin: true, user: false },
  { id: "iam.manage", label: "사용자·역할 관리 (IAM)", category: "운영", admin: true, user: false },
  { id: "iam.apikey", label: "API Key 발급", category: "운영", admin: true, user: true },
  { id: "audit.read", label: "감사 로그 조회", category: "운영", admin: true, user: false },
  { id: "sys.config", label: "시스템 설정 변경", category: "운영", admin: true, user: false },
];

const ROLES = [
  { key: "admin" as const, name: "관리자", desc: "플랫폼 전체 관리·정책·사용자", color: "indigo" },
  { key: "user" as const, name: "유저", desc: "본인 프로젝트 내 자원 활용", color: "mint" },
];

const CATEGORY_ORDER = ["AI 인프라", "IaaS", "PaaS", "AI 개발환경", "운영"];

// ── Workload 기반 접근제어 정책 (OPA) — 정량지표 접근제어 2종 중 2번째, SFR.MNT.046 (CR-IAM-03) ──
interface WorkloadPolicy {
  id: string;
  name: string;
  /** 대상 워크로드 선택자 */
  selector: string;
  /** 조건 — 가속기 쿼터·시간대·데이터 민감도 등 */
  condition: string;
  effect: "allow" | "deny";
  priority: number;
  enabled: boolean;
  basis: string;
}

const INITIAL_WORKLOAD_POLICIES: WorkloadPolicy[] = [
  { id: "wp-001", name: "학습 작업은 gpu-profile=mig-preferred 노드에만", selector: "sched.ai/intent=training", condition: "gpu-profile in [mig-preferred, exclusive] AND project.quota.accelerator.remaining >= request", effect: "allow", priority: 10, enabled: true, basis: "스케줄링 힌트 sched.ai/gpu-profile" },
  { id: "wp-002", name: "민감 데이터 워크로드 재배치 금지", selector: "sched.ai/data-sensitivity=very-high", condition: "rescheduling == forbidden AND storage.class in [local-nvme]", effect: "allow", priority: 20, enabled: true, basis: "스케줄링 힌트 sched.ai/rescheduling" },
  { id: "wp-003", name: "서빙 SLO 미충족 노드 배치 거부", selector: "sched.ai/intent=serving", condition: "profile.ai/slo-p99-ms < node.p99_estimate_ms", effect: "deny", priority: 30, enabled: true, basis: "profile.ai/slo-p99-ms · 서빙 지표" },
  { id: "wp-004", name: "야간 배치 작업만 저전력 가속기 허용", selector: "sched.ai/preference=throughput", condition: "time in 22:00-06:00 AND accelerator.kind in [RNGD, ATOM]", effect: "allow", priority: 40, enabled: false, basis: "전력 비용 최적화" },
  { id: "wp-005", name: "프로젝트 가속기 쿼터 초과 요청 거부", selector: "*", condition: "project.quota.accelerator.used + request > project.quota.accelerator.max", effect: "deny", priority: 1, enabled: true, basis: "SFR.MNT.011 자원 신청 · OPA 2차 인가" },
];

export default function RolesPage() {
  const [perms, setPerms] = React.useState<Permission[]>(INITIAL_PERMS);
  const [originalPerms, setOriginalPerms] = React.useState<Permission[]>(INITIAL_PERMS);
  const [addOpen, setAddOpen] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(perms) !== JSON.stringify(originalPerms),
    [perms, originalPerms],
  );

  const toggle = (id: string, role: "admin" | "user") => {
    setPerms((prev) => prev.map((p) => (p.id === id ? { ...p, [role]: !p[role] } : p)));
  };

  const save = () => {
    setOriginalPerms(perms);
    toast.success("권한 매트릭스 저장됨", {
      description: `${perms.length}개 권한 · 변경사항이 다음 로그인부터 적용된다.`,
    });
  };

  const revert = () => {
    setPerms(originalPerms);
    toast.info("변경사항 되돌림");
  };

  const remove = (id: string) => {
    setPerms((prev) => prev.filter((p) => p.id !== id));
    toast.success("권한 항목 삭제됨");
  };

  const add = (p: Permission) => {
    setPerms((prev) => [...prev, p]);
    toast.success(`커스텀 권한 '${p.label}' 추가됨`);
  };

  const groupedPerms = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: perms.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  const customCategory = perms.filter((p) => p.custom && !CATEGORY_ORDER.includes(p.category));
  if (customCategory.length > 0) {
    groupedPerms.push({ category: "커스텀", items: customCategory });
  }

  const [wps, setWps] = React.useState<WorkloadPolicy[]>(INITIAL_WORKLOAD_POLICIES);

  return (
    <div className="space-y-4">
      <ChangeMark ids={["CR-IAM-03"]}>
      <div className="rounded-md border border-brand-indigo-200 bg-brand-indigo-50/50 px-3 py-2 text-[11px] text-brand-indigo-900">
        <strong>접근제어 2종 (정량지표 · 공인인증시험 10/15~11/10)</strong> — ① 역할 기반(RBAC): 역할 × 권한 매트릭스. ② Workload 기반: 워크로드 명세(라벨·annotation)와 프로젝트 쿼터·시간대·데이터 민감도 조건을 OPA가 2차 인가한다. API Gateway 1차 인가 → OPA 2차 인가 순.
      </div>
      </ChangeMark>

      <Tabs defaultValue="rbac">
        <TabsList>
          <TabsTrigger value="rbac">① 역할 권한 매트릭스 (RBAC)</TabsTrigger>
          <TabsTrigger value="workload">② 워크로드 정책 (OPA) · {wps.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="workload" className="mt-4">
          <ChangeMark ids={["CR-IAM-03"]}>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Boxes className="size-4" /> 워크로드 정책 (OPA Rego)</CardTitle>
                <CardDescription>
                  우선순위가 낮은 숫자부터 평가한다. 거부(deny)가 먼저 걸리면 이후 정책은 보지 않는다. 판정 결과는 감사 로그에 남는다. — SFR.MNT.016 OPA · 046 Workload 기반 인증
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => { const n: WorkloadPolicy = { id: `wp-${String(wps.length + 1).padStart(3, "0")}`, name: "새 정책", selector: "sched.ai/intent=training", condition: "request.accelerator.count <= 2", effect: "allow", priority: 50, enabled: false, basis: "사용자 정의" }; setWps((prev) => [...prev, n]); toast.success(`정책 ${n.id} 추가 — 조건을 편집한다`); }}>
                <Plus className="size-3.5" /> 정책 추가
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-secondary/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-16 px-4 py-3 text-left font-medium">순위</th>
                      <th className="px-4 py-3 text-left font-medium">정책</th>
                      <th className="px-4 py-3 text-left font-medium">대상 워크로드</th>
                      <th className="px-4 py-3 text-left font-medium">조건</th>
                      <th className="w-20 px-4 py-3 text-center font-medium">효과</th>
                      <th className="w-20 px-4 py-3 text-center font-medium">활성</th>
                      <th className="w-12 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...wps].sort((a, b) => a.priority - b.priority).map((p) => (
                      <tr key={p.id} className="border-t border-border align-top">
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums">{p.priority}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{p.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.id} · {p.basis}</div>
                        </td>
                        <td className="px-4 py-2.5"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{p.selector}</code></td>
                        <td className="px-4 py-2.5"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-relaxed">{p.condition}</code></td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={p.effect === "allow" ? "success" : "destructive"} className="text-[10px]">{p.effect}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Switch checked={p.enabled} onCheckedChange={(v) => { setWps((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled: v } : x))); toast.success(`${p.id} ${v ? "활성화" : "비활성화"}`); }} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Button variant="ghost" size="icon-sm" onClick={() => { setWps((prev) => prev.filter((x) => x.id !== p.id)); toast.success(`${p.id} 삭제`); }}>
                            <Trash2 className="size-3.5 text-rose-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 border-t border-border p-4 text-[11px] text-muted-foreground md:grid-cols-3">
                <div className="flex items-start gap-2"><Cpu className="mt-0.5 size-3.5" /> 입력: 워크로드 명세(sched.ai/·profile.ai/ annotation), 프로젝트 쿼터, 가속기 종류·상태</div>
                <div className="flex items-start gap-2"><Clock className="mt-0.5 size-3.5" /> 평가 시점: 워크로드 생성·클러스터 신청·자원 신청 승인 요청 시. 결과와 근거는 감사 로그에 기록</div>
                <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-3.5" /> 시험: 공인인증시험(10/15~11/10) 접근제어 2종 — RBAC 1종 + Workload 기반 1종</div>
              </div>
            </CardContent>
          </Card>
          </ChangeMark>
        </TabsContent>

        <TabsContent value="rbac" className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((r) => {
          const grantedCount = perms.filter((p) => p[r.key]).length;
          return (
            <Card key={r.key}>
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`size-5 ${r.color === "indigo" ? "text-brand-indigo-600" : "text-brand-mint-600"}`} />
                  <span className="font-semibold">{r.name}</span>
                  <Badge variant="ghost" className="ml-auto font-mono text-[10px]">
                    {grantedCount} / {perms.length} 권한
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
                <Badge variant="outline" className="font-mono text-[10px]">role: {r.key}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ChangeMark ids={["CR-IAM-01", "CR-IAM-02"]}>
<Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>권한 매트릭스</CardTitle>
            <CardDescription>
              토글로 역할별 권한을 조정한다. 변경 후 저장하면 다음 세션부터 반영. — SFR.MNT.006/016
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <>
                <Badge variant="warning" className="gap-1 text-[10px]">
                  <Sparkles className="size-2.5" /> 변경사항 있음
                </Badge>
                <Button variant="outline" size="sm" onClick={revert}>
                  <Undo2 className="size-3.5" /> 되돌리기
                </Button>
                <Button size="sm" onClick={save}>
                  <Save className="size-3.5" /> 저장
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> 권한 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30 text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-4 py-3 text-left font-medium">권한</th>
                  {ROLES.map((r) => (
                    <th key={r.key} className="w-24 px-4 py-3 text-center font-medium">
                      {r.name}
                    </th>
                  ))}
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {groupedPerms.map((g) => (
                  <React.Fragment key={g.category}>
                    <tr className="border-t border-border bg-secondary/20">
                      <td colSpan={ROLES.length + 3} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.category}
                      </td>
                    </tr>
                    {g.items.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2.5" />
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span>{p.label}</span>
                            {p.custom && <Badge variant="ghost" className="text-[9px]">custom</Badge>}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
                        </td>
                        {ROLES.map((r) => (
                          <td key={r.key} className="px-4 py-2.5 text-center">
                            <Switch checked={p[r.key]} onCheckedChange={() => toggle(p.id, r.key)} />
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-center">
                          {p.custom && (
                            <Button variant="ghost" size="icon-sm" onClick={() => remove(p.id)}>
                              <Trash2 className="size-3.5 text-rose-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
</ChangeMark>

        </TabsContent>
      </Tabs>

      <AddPermissionDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={add} existingIds={perms.map((p) => p.id)} />
    </div>
  );
}

function AddPermissionDialog({
  open, onClose, onAdd, existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (p: Permission) => void;
  existingIds: string[];
}) {
  const [id, setId] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [category, setCategory] = React.useState("커스텀");
  const [admin, setAdmin] = React.useState(true);
  const [user, setUser] = React.useState(false);

  const idExists = existingIds.includes(id);

  const submit = () => {
    if (!id.trim() || !label.trim()) return;
    if (idExists) {
      toast.error("이미 존재하는 권한 ID입니다");
      return;
    }
    onAdd({ id: id.trim(), label: label.trim(), category, admin, user, custom: true });
    setId("");
    setLabel("");
    setCategory("커스텀");
    setAdmin(true);
    setUser(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>권한 항목 추가</DialogTitle>
          <DialogDescription>
            표준 권한에 없는 커스텀 권한을 정의한다. ID는 소문자·점 표기 (예: <span className="font-mono text-xs">custom.action</span>).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>권한 ID</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))}
              placeholder="custom.data.export"
              className="font-mono text-xs"
            />
            {idExists && <div className="mt-1 text-[11px] text-rose-600">이미 존재하는 ID</div>}
          </div>
          <div>
            <Label>표시 이름</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="데이터 대량 내보내기" />
          </div>
          <div>
            <Label>카테고리</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="커스텀" />
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <div className="text-[11px] font-medium">기본 부여 대상</div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch checked={admin} onCheckedChange={setAdmin} /> 관리자
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch checked={user} onCheckedChange={setUser} /> 유저
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={idExists || !id.trim() || !label.trim()}>
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
