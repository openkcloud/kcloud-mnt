"use client";
import { toast } from "sonner";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Server, Plus, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ResourceRequestWizard } from "@/components/resource-request-wizard";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// 260702 회의록 2.5: 공급자 관리 메뉴 삭제(단일 클러스터). 라우터는 관리자 권한 기능.
const TABS = [
  { href: "/iaas/projects", label: "프로젝트" },
  { href: "/iaas/instances", label: "가상서버" },
  { href: "/iaas/networks", label: "네트워크" },
  { href: "/iaas/routers", label: "라우터", adminOnly: true },
  { href: "/iaas/security-groups", label: "보안 그룹" },
  { href: "/iaas/keypairs", label: "키페어" },
  { href: "/iaas/volumes", label: "볼륨·스토리지" },
  { href: "/iaas/images", label: "이미지·플레이버" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <div className="space-y-6">
      <PageHeader
        title="IaaS (OpenStack) 자원 관리"
        description="OpenStack(Nova·Neutron·Cinder·Glance) 단일 클러스터 자원 운영 — kcloud-svc 연동"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.success("현재 목록을 CSV로 내보낸다")}>
              <Download className="size-4" /> 엑셀 내보내기
            </Button>
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="size-4" /> 자원 신청
            </Button>
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
      <ResourceRequestWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
