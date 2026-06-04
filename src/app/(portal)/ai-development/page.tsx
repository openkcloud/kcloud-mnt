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
              <strong className="text-foreground">Kubeflow</strong>는 K8s 위에서 ML 워크플로우 전 주기(데이터→학습→배포→모니터링)를 운영하는 오픈소스 플랫폼입니다.
              openKcloud는 Kubeflow를 통합하여 <strong className="text-foreground">OpenStack 프로젝트 = Kubeflow Profile</strong> 매핑으로
              과금·격리·자원할당을 한 번에 처리합니다.
            </p>
          </div>
        </CardContent>
      </Card>

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
