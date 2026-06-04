"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/paas/clusters", label: "클러스터" },
  { href: "/paas/workloads", label: "워크로드" },
  { href: "/paas/services", label: "서비스·인그레스" },
  { href: "/paas/storage", label: "스토리지" },
  { href: "/paas/config", label: "설정 관리" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <PageHeader
        title="PaaS (Kubernetes) 자원 관리"
        description="멀티 클러스터·이종 K8s 환경 통합 운영 — VIOLA/OCP/EKS 호환"
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCw className="size-4" /> 동기화
            </Button>
            <Button size="sm">
              <Plus className="size-4" /> 클러스터 등록
            </Button>
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
