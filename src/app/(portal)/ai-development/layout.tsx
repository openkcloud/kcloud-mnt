"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { NotebookCreateDialog } from "@/components/notebook-create-dialog";
import { BrainCircuit, Plus, ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ai-development", label: "개요" },
  { href: "/ai-development/profiles", label: "Profiles" },
  { href: "/ai-development/notebooks", label: "Notebooks" },
  { href: "/ai-development/pipelines", label: "Pipelines" },
  { href: "/ai-development/experiments", label: "Experiments" },
  { href: "/ai-development/serving", label: "Serving" },
  { href: "/ai-development/model-insights", label: "병목 분석" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = React.useState(false);
  const { data: profileData } = api.kubeflow.profiles() as {
    data: { items: { name: string }[] } | undefined;
  };
  const namespaces = profileData?.items.map((p) => p.name) ?? ["ai-research"];
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
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> 새 노트북
            </Button>
            <NotebookCreateDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              namespaces={namespaces}
            />
          </>
        }
      />
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative -mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
