"use client";
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
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { ProfileCreateDialog } from "@/components/profile-create-dialog";
import { KF_ENABLED } from "@/lib/kf";

/* Kubeflow Profile = namespace + RBAC + ResourceQuota + PodDefault 묶음.
 * 실제 Kubeflow CRD: kubeflow.org/v1 Profile
 * NEXT_PUBLIC_KF_API 설정 시 실제 Profile Controller 데이터, 미설정 시 아래 mock */

type ProfileItem = (typeof MOCK_PROFILES)[number] & { status?: string };

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
  const { data } = api.kubeflow.profiles() as {
    data: { items: ProfileItem[] } | undefined;
  };
  const profiles: ProfileItem[] =
    KF_ENABLED && data ? data.items : MOCK_PROFILES;
  const [createOpen, setCreateOpen] = React.useState(false);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kubeflow Profiles"
        description="Profile = K8s 네임스페이스 + RBAC + ResourceQuota + PodDefault — 사용자 격리·할당 단위"
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> 새 Profile
            </Button>
            <ProfileCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
          </>
        }
      />

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
              각 Profile은 OpenStack 프로젝트(과금 단위)와 1:1 매핑됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

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
                  </div>
                </div>
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="size-3" /> Active
                </Badge>
              </div>

              {/* Quotas */}
              <div className="space-y-2 rounded-lg bg-secondary/30 p-3">
                <QuotaRow label="vCPU" used={p.cpuQuota.used} limit={p.cpuQuota.limit} color="indigo" />
                <QuotaRow label="MEM (GB)" used={p.memQuota.used} limit={p.memQuota.limit} color="mint" />
                <QuotaRow label="가속기" used={p.accQuota.used} limit={p.accQuota.limit} color="amber" />
                <QuotaRow label="Storage (GB)" used={p.storageQuota.used} limit={p.storageQuota.limit} color="violet" />
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
                <Button variant="ghost" size="sm">
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

function QuotaRow({ label, used, limit, color }: { label: string; used: number; limit: number; color: "indigo" | "mint" | "amber" | "violet" }) {
  const pct = Math.round((used / limit) * 100);
  const bar = {
    indigo: "bg-brand-indigo-500",
    mint: "bg-brand-mint-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
  }[color];
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          <strong>{used}</strong> / {limit} · {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-1" indicatorClassName={bar} />
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
