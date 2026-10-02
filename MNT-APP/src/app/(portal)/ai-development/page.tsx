"use client";
import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Folder,
  GitBranch,
  FlaskConical,
  Send,
  Sparkles,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MENUS = [
  {
    href: "/ai-development/profiles",
    icon: Folder,
    color: "bg-brand-mint-50 text-brand-mint-700",
    title: "Profiles",
    subtitle: "워크스페이스 격리",
    desc: "사용자/팀별 K8s Namespace + RBAC + ResourceQuota + IAP 정책 묶음. 1 Profile = 1 OpenStack 프로젝트 = 과금 단위.",
    example: "ai-research 팀에 vCPU 256 / GPU 8장 / 30TB 스토리지 할당",
  },
  {
    href: "/ai-development/notebooks",
    icon: BookOpen,
    color: "bg-brand-indigo-100 text-brand-indigo-700",
    title: "Notebooks",
    subtitle: "AI 노트북 (개발환경)",
    desc: "컨테이너 기반 IDE (VSCode Code Server). GPU/NPU/PIM 자원 직접 할당. 영구 저장소 PVC 마운트.",
    example: "research-llama-finetune 노트북 — GPU 2장 + 500GB 볼륨",
  },
  {
    href: "/ai-development/pipelines",
    icon: GitBranch,
    color: "bg-violet-100 text-violet-700",
    title: "Pipelines",
    subtitle: "ML 워크플로우",
    desc: "데이터 → 학습 → 평가 → 배포를 DAG로 정의. 수동/Cron/Git 트리거. 각 단계 컨테이너 격리, 아티팩트 자동 보관.",
    example: "llama-3 finetune: 데이터 로드 → 토큰화 → LoRA 학습 → 평가 → KServe 배포 (6단계)",
  },
  {
    href: "/ai-development/experiments",
    icon: FlaskConical,
    color: "bg-amber-100 text-amber-700",
    title: "Experiments",
    subtitle: "하이퍼파라미터 탐색 (Katib)",
    desc: "Grid/Random/Bayesian/TPE 알고리즘으로 수십~수백 trial 자동 실행. 최적 학습률·배치 크기 발견.",
    example: "llama-lr-search: lr=1e-5~1e-3 × batch=8~64, 30 trials, 목표 eval_accuracy > 0.88",
  },
  {
    href: "/ai-development/serving",
    icon: Send,
    color: "bg-rose-100 text-rose-700",
    title: "Serving",
    subtitle: "모델 배포 (KServe)",
    desc: "학습된 모델을 REST/gRPC API로 배포. Auto-scaling (0→N), Canary 배포, A/B 테스트.",
    example: "solar-10b-vllm: 3 레플리카 · 평균 124 RPS · P95 980ms",
  },
  {
    href: "/ai-development/model-insights",
    icon: Activity,
    color: "bg-sky-100 text-sky-700",
    title: "병목 분석",
    subtitle: "워크플로우 성능 분석",
    desc: "ML 파이프라인 각 단계의 시간 비중·자원 사용·재실행 빈도 분석. 추론 단계별 latency breakdown.",
    example: "Attention Layer 22/28에서 KV cache 미스율 41% — 정상치 8% 대비 5배",
  },
];

export default function AIDevHomePage() {
  return (
    <div className="space-y-6">
      <Card className="border-brand-indigo-200 bg-gradient-to-br from-brand-indigo-50 to-transparent">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="font-semibold">AI 노트북이란?</div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Kubeflow</strong>는 K8s 위에서 ML 워크플로우 전 주기(데이터→학습→배포→모니터링)를 운영하는 오픈소스 플랫폼이다.
              openKcloud는 Kubeflow를 통합하여 <strong className="text-foreground">OpenStack 프로젝트 = Kubeflow Profile</strong> 매핑으로
              과금·격리·자원할당을 한 번에 처리한다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 전체 흐름 가이드 — ETRI 260615 §6.A 반영 */}
      <WorkflowGuide />


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MENUS.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex size-10 items-center justify-center rounded-lg ${m.color}`}>
                    <m.icon className="size-5" />
                  </div>
                </div>
                <div>
                  <div className="text-base font-bold leading-tight">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.subtitle}</div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
                <div className="rounded-md border border-dashed border-border bg-secondary/30 p-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">예시 ›</span> {m.example}
                </div>
                <div className="flex items-center justify-end text-xs text-muted-foreground group-hover:text-primary">
                  바로가기 <ArrowRight className="ml-1 size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 전체 흐름 가이드 — ETRI 260615 §6.A 반영
// 자원 신청 → Profile → 모델 선택 → Notebook → 템플릿 → GPU 프리셋 →
// Pipeline → Katib HPO → Serving → API 호출
// ─────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { n: 1, label: "자원 신청", desc: "IaaS 프로젝트 · CPU·메모리·가속기 쿼터", href: "/iaas/projects", color: "bg-brand-indigo-100 text-brand-indigo-700" },
  { n: 2, label: "Profile 생성", desc: "네임스페이스 분리 · 팀별 워크스페이스", href: "/ai-development/profiles", color: "bg-violet-100 text-violet-700" },
  { n: 3, label: "모델 선택", desc: "마켓플레이스에서 사전 학습 모델 확보", href: "/catalog", color: "bg-brand-mint-100 text-brand-mint-700" },
  { n: 4, label: "Notebook 생성", desc: "CUDA Training 템플릿 · GPU 2장 프리셋", href: "/ai-development/notebooks", color: "bg-sky-100 text-sky-700" },
  { n: 5, label: "Pipeline", desc: "학습 워크플로우 DAG 정의 · 제출", href: "/ai-development/pipelines", color: "bg-amber-100 text-amber-700" },
  { n: 6, label: "Experiments (HPO)", desc: "Katib · 하이퍼파라미터 최적화", href: "/ai-development/experiments", color: "bg-rose-100 text-rose-700" },
  { n: 7, label: "Serving", desc: "KServe · 모델 배포 · Auto-scale 0→N", href: "/ai-development/serving", color: "bg-brand-indigo-100 text-brand-indigo-700" },
  { n: 8, label: "API 호출", desc: "endpoint URL로 서비스 운영 확인", href: "/ai-development/serving", color: "bg-brand-mint-100 text-brand-mint-700" },
];

function WorkflowGuide() {
  const [open, setOpen] = React.useState(true);
  return (
    <Card className="border-brand-mint-200 bg-gradient-to-br from-brand-mint-50/60 to-transparent">
      <CardContent className="p-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mb-3 flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-mint-100 text-brand-mint-700">
              <ArrowRight className="size-4" />
            </div>
            <div>
              <div className="font-semibold">전체 흐름 가이드 (Kubeflow 8단계)</div>
              <div className="text-xs text-muted-foreground">
                처음 사용하시면 이 순서로 진행하기 — 각 단계 클릭 시 해당 페이지로 이동
              </div>
            </div>
          </div>
          <Badge variant="ghost" className="text-[10px]">
            {open ? "접기" : "펼치기"}
          </Badge>
        </button>

        {open && (
          <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-8">
            {WORKFLOW_STEPS.map((s, i) => (
              <React.Fragment key={s.n}>
                <Link
                  href={s.href}
                  className="group flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="relative">
                    <div className={`flex size-9 items-center justify-center rounded-full ${s.color}`}>
                      <span className="text-sm font-bold">{s.n}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold leading-tight">{s.label}</div>
                    <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{s.desc}</div>
                  </div>
                </Link>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden items-center justify-center text-muted-foreground lg:flex" style={{ marginLeft: "-6px", marginRight: "-6px" }}>
                    <ArrowRight className="size-3" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

