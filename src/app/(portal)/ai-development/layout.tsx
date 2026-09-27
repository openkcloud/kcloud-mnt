"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ExternalLink, FolderKanban, ArrowUpRight } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeatureVisible } from "@/lib/scope";
import { useProjectContext, AI_PROJECTS } from "@/lib/project-context";
import { cn } from "@/lib/utils";
import { ChangeMark } from "@/components/change-mark";

const AI = "/ai-development";
type Tab = { href: string; label: string; n?: number; feature?: string; match?: string[] };

// 사용 순서대로 번호를 붙인다. 학습 = 파이프라인 + 실험(HPO) 서브탭
const TABS: Tab[] = [
  { href: AI, label: "개요" },
  { href: `${AI}/profiles`, label: "워크스페이스", n: 1 },
  { href: `${AI}/notebooks`, label: "개발환경", n: 2 },
  { href: `${AI}/pipelines`, label: "학습", n: 3, match: [`${AI}/experiments`] },
  { href: `${AI}/serving`, label: "모델 배포", n: 4 },
  { href: `${AI}/model-insights`, label: "성능 분석", n: 5 },
];
const LEARN_SUB: Tab[] = [
  { href: `${AI}/pipelines`, label: "파이프라인" },
  { href: `${AI}/experiments`, label: "실험 (HPO)", feature: "ai.experiments" },
];

function isActive(pathname: string, t: Tab) {
  if (t.href === AI) return pathname === AI;
  return pathname.startsWith(t.href) || !!t.match?.some((m) => pathname.startsWith(m));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const experimentsVisible = useFeatureVisible("ai.experiments");
  const keep = (t: Tab) => t.feature !== "ai.experiments" || experimentsVisible;
  const sub = LEARN_SUB.filter(keep);
  const inLearn = sub.some((t) => pathname.startsWith(t.href));

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 노트북"
        description={
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            Kubeflow 기반 통합 ML 워크플로우 — Profile · Notebook · Pipeline · Katib · KServe
            <Badge variant="ghost" className="font-mono text-[10px]">kubeflow.org/v1</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="https://www.kubeflow.org/docs/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" /> Kubeflow Docs
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://github.com/kubeflow/kubeflow" target="_blank" rel="noopener noreferrer">
                <GithubIcon className="size-3.5" /> GitHub
              </a>
            </Button>
            <Button size="sm" onClick={() => { router.push(`${AI}/notebooks`); toast.success("개발환경에서 '새 노트북 서버'로 만든다"); }}>
              <Plus className="size-4" /> 새 노트북
            </Button>
          </>
        }
      />
      <ChangeMark ids={["CR-AID-11"]}>
        <ProjectStrip />
      </ChangeMark>
      <ChangeMark ids={["CR-AID-10"]}>
      <div>
        <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
          {TABS.map((t) => {
            const active = isActive(pathname, t);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.n && (
                  <span
                    className={cn(
                      "inline-flex size-[18px] items-center justify-center rounded-full font-mono text-[10px] font-bold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.n}
                  </span>
                )}
                {t.label}
              </Link>
            );
          })}
        </div>
        {inLearn && sub.length > 1 && (
          <div className="flex items-center gap-1 border-b border-border bg-secondary/30 px-2 py-1.5">
            <span className="mr-1 text-[11px] text-muted-foreground">③ 학습 ›</span>
            {sub.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </ChangeMark>
      {children}
    </div>
  );
}

/** 지금 어느 프로젝트(테넌트)의 AI 자원을 보고 있는지 */
function ProjectStrip() {
  const { project, isAll, isAdmin } = useProjectContext();
  const t = project?.tenant;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-brand-indigo-200 bg-brand-indigo-50/50 px-4 py-2.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-brand-indigo-800">
        <FolderKanban className="size-3.5" />
        {isAll ? "전체 프로젝트" : <>프로젝트 <span className="font-mono">{project?.name}</span></>}
      </span>
      {isAll ? (
        <span className="text-muted-foreground">
          워크스페이스 {AI_PROJECTS.length}개를 함께 본다{isAdmin && " — 관리자 보기"}
        </span>
      ) : (
        t && (
          <>
            <span className="text-muted-foreground">
              워크스페이스 <span className="font-mono text-foreground">{t.name}</span> · 네임스페이스{" "}
              <span className="font-mono text-foreground">{t.name}</span>
            </span>
            <span className="text-muted-foreground">
              가속기 <strong className="font-mono text-foreground">{t.usedAcc}/{t.quotaAcc}</strong> · vCPU{" "}
              <strong className="font-mono text-foreground">{t.usedVcpu}/{t.quotaVcpu}</strong>
            </span>
            <Link
              href={`/iaas/projects?open=${t.id}&tab=ai`}
              className="ml-auto inline-flex items-center gap-0.5 font-medium text-brand-indigo-700 hover:underline"
            >
              프로젝트에서 보기 <ArrowUpRight className="size-3" />
            </Link>
          </>
        )
      )}
    </div>
  );
}
