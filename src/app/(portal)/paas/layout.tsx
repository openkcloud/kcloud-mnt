"use client";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, RefreshCw, Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useFeatureVisible } from "@/lib/scope";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/paas/clusters", label: "클러스터" },
  { href: "/paas/workloads", label: "워크로드" },
  { href: "/paas/services", label: "서비스·인그레스" },
  { href: "/paas/storage", label: "스토리지" },
  { href: "/paas/config", label: "설정 관리", feature: "paas.config" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const configVisible = useFeatureVisible("paas.config");
  const tabs = TABS.filter((t) => t.feature !== "paas.config" || configVisible);
  return (
    <div className="space-y-6">
      <PageHeader
        title="PaaS (Kubernetes) 자원 관리"
        description="OpenStack Magnum 기반 서비스 클러스터 운영 — 사용자는 신청, 관리자는 승인·생성"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.success("OpenStack·Kubernetes 상태 동기화를 시작한다")}>
              <RefreshCw className="size-4" /> 동기화
            </Button>
            {isAdmin ? (
              <Button size="sm" asChild>
                <Link href="/paas/clusters"><Inbox className="size-4" /> 클러스터 신청 관리</Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/paas/clusters"><Plus className="size-4" /> 서비스 클러스터 신청</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
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
