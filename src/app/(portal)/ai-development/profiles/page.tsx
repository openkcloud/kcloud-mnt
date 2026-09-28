"use client";
import { toast } from "sonner";
import * as React from "react";
import {
  Users,
  Plus,
  Settings,
  ShieldCheck,
  Database,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { ChangeMark } from "@/components/change-mark";
import { PageHeader } from "@/components/page-header";
import { useProjectContext, AI_PROJECTS } from "@/lib/project-context";
import { notebooks as NB, pipelines as PL, inferenceServices as SV } from "@/mocks/fixtures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { ProfileCreateDialog } from "@/components/profile-create-dialog";
import { ProfileEditDialog, type EditableProfile } from "@/components/profile-edit-dialog";
import { KF_ENABLED } from "@/lib/kf";

/* Kubeflow Profile = namespace + RBAC + ResourceQuota + PodDefault 묶음.
 * 실제 Kubeflow CRD: kubeflow.org/v1 Profile
 * NEXT_PUBLIC_KF_API 설정 시 실제 Profile Controller 데이터, 미설정 시 아래 mock */

type ProfileItem = (typeof MOCK_PROFILES)[number] & {
  status?: string;
  /** 실백엔드에서만 내려온다 — 지금 실제로 쓰고 있는 양 (예약과 다름) */
  actual?: { cpu: number; mem: number };
};

const MOCK_PROFILES = [
  {
    name: "ai-research",
    owner: "최현화",
    ownerEmail: "hhchoi@etri.re.kr",
    members: 7,
    cpuQuota: { used: 184, limit: 256 },
    memQuota: { used: 768, limit: 1024 },
    accQuota: { used: 6, limit: 8 },
    storageQuota: { used: 18, limit: 30 },
    plugins: ["IAP", "PodDefaults", "GPU"],
    notebooks: 4,
    pipelines: 3,
    deployments: 2,
  },
  {
    name: "llm-serving",
    owner: "박의규",
    ownerEmail: "ek.park@okestro.com",
    members: 5,
    cpuQuota: { used: 128, limit: 192 },
    memQuota: { used: 512, limit: 768 },
    accQuota: { used: 4, limit: 6 },
    storageQuota: { used: 11, limit: 20 },
    plugins: ["IAP", "PodDefaults", "GPU", "NPU"],
    notebooks: 2,
    pipelines: 1,
    deployments: 3,
  },
  {
    name: "edge-inference",
    owner: "안재훈",
    ownerEmail: "jh.ahn@keti.re.kr",
    members: 3,
    cpuQuota: { used: 38, limit: 96 },
    memQuota: { used: 142, limit: 384 },
    accQuota: { used: 2, limit: 4 },
    storageQuota: { used: 3, limit: 8 },
    plugins: ["NPU"],
    notebooks: 2,
    pipelines: 1,
    deployments: 4,
  },
];

export default function ProfilesPage() {
  const { data, isLoading, isError } = api.kubeflow.profiles() as {
    data: { items: ProfileItem[] } | undefined;
    isLoading: boolean;
    isError: boolean;
  };
  // 실백엔드 모드에서는 mock을 절대 노출하지 않는다 — 로딩/오류는 아래에서 별도 표시
  const allProfiles: ProfileItem[] = KF_ENABLED
    ? (data?.items ?? [])
    : MOCK_PROFILES;
  // 헤더에서 고른 프로젝트의 워크스페이스만 보여준다 (워크스페이스 = 프로젝트 1:1)
  const { match, isAdmin } = useProjectContext();
  const profiles = allProfiles.filter((p) => match(p.name));
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<EditableProfile | null>(null);
  return (
    <div className="space-y-6">
      <PageHeader
        title="워크스페이스"
        description="프로젝트가 승인되면 같은 이름으로 자동 생성된다 — Kubeflow Profile = 네임스페이스 + RBAC + ResourceQuota + PodDefault"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/iaas/projects">
                <Plus className="size-4" /> 프로젝트 자원 신청
              </Link>
            </Button>
            {/* 워크스페이스는 프로젝트 승인 시 자동 생성이 원칙. 승인 연동 전까지 관리자가 대신 만든다 */}
            {isAdmin && (
              <Button onClick={() => setCreateOpen(true)} title="프로젝트 승인 연동 전까지 관리자가 워크스페이스를 직접 만든다">
                <Plus className="size-4" /> 워크스페이스 생성 (관리자)
              </Button>
            )}
            <ProfileCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
            <ProfileEditDialog profile={editTarget} open={editOpen} onOpenChange={setEditOpen} />
          </>
        }
      />

      {isAdmin && (
        <ChangeMark ids={["CR-AID-12"]}>
          <AllWorkspacesTable real={KF_ENABLED ? allProfiles : undefined} />
        </ChangeMark>
      )}

      {/* Kubeflow concept callout */}
      <Card className="border-brand-indigo-200 bg-gradient-to-br from-brand-indigo-50 to-transparent">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <ShieldCheck className="size-4" />
          </div>
          <div className="space-y-1">
            <div className="font-semibold">실제 Kubeflow CRD 매핑</div>
            <p className="text-xs text-muted-foreground">
              <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">kubeflow.org/v1 Profile</code> CRD가 생성되면
              {" "}<code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">profiles-controller</code>가 자동으로
              {" "}namespace · RoleBinding · ResourceQuota · ServiceAccount · IAP 정책을 프로비저닝합니다.
              각 워크스페이스(Profile)는 프로젝트와 1:1로 대응하며, 프로젝트 승인 시 같은 이름으로 자동 생성됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {KF_ENABLED && isLoading && profiles.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            워크스페이스 목록을 불러오는 중…
          </CardContent>
        </Card>
      )}
      {KF_ENABLED && isError && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            워크스페이스 목록을 불러오지 못했습니다 — 잠시 후 자동으로 다시 시도합니다.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => (
          <Card key={p.name} className="overflow-hidden">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-brand-mint-50 text-brand-mint-700">
                      {p.owner.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-mono font-semibold leading-tight">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Owner: <span className="font-mono">{p.owner}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      프로젝트 <span className="font-mono text-foreground">{AI_PROJECTS.find((x) => x.name === p.name)?.id ?? p.name}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="size-3" /> Active
                </Badge>
              </div>

              {/* Quotas */}
              <div className="space-y-2 rounded-lg bg-secondary/30 p-3">
                <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
                  <span>배정(예약)</span>
                  {p.actual && <span>지금 실제 사용</span>}
                </div>
                <QuotaRow label="vCPU" used={p.cpuQuota.used} limit={p.cpuQuota.limit}
                          color="indigo" actual={p.actual?.cpu} />
                <QuotaRow label="MEM (GB)" used={p.memQuota.used} limit={p.memQuota.limit}
                          color="mint" actual={p.actual?.mem} />
                <QuotaRow label="가속기" used={p.accQuota.used} limit={p.accQuota.limit} color="amber" />
                <QuotaRow label="Storage (GB)" used={p.storageQuota.used} limit={p.storageQuota.limit} color="violet" />
                {p.actual && (
                  <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                    예약은 &quot;최대 이만큼 쓰겠다&quot;는 약속입니다. 실제 사용이 훨씬 적으면
                    한도를 줄여 다른 팀에 여유를 줄 수 있습니다.
                  </p>
                )}
              </div>

              {/* Plugins */}
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Plugins</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.plugins.map((pl) => (
                    <Badge key={pl} variant="ghost" className="font-mono text-[10px]">
                      {pl}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Resources */}
              <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <Stat label="Notebooks" value={p.notebooks} />
                <Stat label="Pipelines" value={p.pipelines} />
                <Stat label="Deploys" value={p.deployments} />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3" />
                  <strong>{p.members}</strong>명
                </span>
                <Button variant="ghost" size="sm"
                        onClick={() => { setEditTarget(p); setEditOpen(true); }}>
                  <Settings className="size-3" /> 편집
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile CRD example */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">예시 — Profile CRD YAML</CardTitle>
          <CardDescription>profiles-controller가 적용하는 실제 매니페스트</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="overflow-x-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
{`apiVersion: kubeflow.org/v1
kind: Profile
metadata:
  name: ai-research
spec:
  owner:
    kind: User
    name: hhchoi@etri.re.kr
  resourceQuotaSpec:
    hard:
      cpu: "256"
      memory: 1024Gi
      requests.nvidia.com/gpu: "6"
      requests.rebellions.ai/atom: "2"
      persistentvolumeclaims: "10"
      requests.storage: 30Ti
  plugins:
    - kind: WorkloadIdentity
      spec:
        gcpServiceAccount: ai-research@openkcloud.iam
    - kind: PodDefault
      spec:
        labels:
          add-rbln-runtime: "true"`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function QuotaRow({ label, used, limit, color, actual }: {
  label: string; used: number; limit: number;
  color: "indigo" | "mint" | "amber" | "violet";
  /** 지금 실제로 쓰고 있는 양 — 예약과 크게 다를 수 있다 */
  actual?: number;
}) {
  const pct = Math.round((used / limit) * 100);
  const bar = {
    indigo: "bg-brand-indigo-500",
    mint: "bg-brand-mint-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
  }[color];
  const actualPct = actual != null ? Math.round((actual / limit) * 100) : null;
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          <strong>{used}</strong> / {limit} · {pct}%
          {actual != null && (
            <span className="ml-2 text-brand-mint-700">실제 {actual}</span>
          )}
        </span>
      </div>
      <div className="relative">
        <Progress value={pct} className="h-1.5" indicatorClassName={bar} />
        {actualPct != null && (
          // 실사용 위치에 표시 — 예약 대비 얼마나 쓰는지 한눈에 보인다
          <span
            className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-brand-mint-700"
            style={{ left: `${Math.min(actualPct, 100)}%` }}
            title={`실제 사용 ${actual}`}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

/** 관리자: 프로젝트↔워크스페이스 전체 현황 (프로젝트 선택과 무관하게 전부) */
/** 실백엔드면 실제 Profile 목록으로, 아니면 목업 프로젝트로 표를 채운다 */
function AllWorkspacesTable({ real }: { real?: ProfileItem[] }) {
  const rows = real
    ? real.map((p) => {
        const iaas = AI_PROJECTS.find((x) => x.name === p.name);
        const r = p as ProfileItem & { notebooks?: number; pipelines?: number; deployments?: number; status?: string };
        return {
          id: iaas?.id ?? p.name,
          orgId: iaas?.orgId ?? "-",
          name: p.name,
          acc: `${p.accQuota.used}/${p.accQuota.limit}`,
          nb: r.notebooks ?? 0,
          pl: r.pipelines ?? 0,
          sv: r.deployments ?? 0,
          status: r.status ?? "Active",
        };
      })
    : AI_PROJECTS.map((p) => ({
        id: p.id,
        orgId: p.orgId,
        name: p.name,
        acc: `${p.tenant.usedAcc}/${p.tenant.quotaAcc}`,
        nb: NB.filter((n) => n.namespace === p.name).length,
        pl: PL.filter((n) => n.namespace === p.name).length,
        sv: SV.filter((n) => n.namespace === p.name).length,
        status: "Active",
      }));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">전체 워크스페이스 (관리자)</CardTitle>
        <CardDescription>프로젝트 1개 = 워크스페이스 1개. 네임스페이스 라벨 openkcloud.io/project-id 로 묶인다.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>프로젝트</TableHead>
              <TableHead>조직</TableHead>
              <TableHead>워크스페이스 · 네임스페이스</TableHead>
              <TableHead className="text-right">가속기</TableHead>
              <TableHead className="text-right">노트북</TableHead>
              <TableHead className="text-right">파이프라인</TableHead>
              <TableHead className="text-right">서비스</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.name}>
                <TableCell>
                  <Link href={`/iaas/projects?open=${p.id}&tab=ai`} className="font-mono text-xs font-semibold hover:text-primary">{p.id}</Link>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{p.orgId}</TableCell>
                <TableCell className="font-mono text-xs">{p.name}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{p.acc}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{p.nb}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{p.pl}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{p.sv}</TableCell>
                <TableCell><Badge variant={p.status === "Active" ? "success" : "outline"} className="text-[10px]">{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
