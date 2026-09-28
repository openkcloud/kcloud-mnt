"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// 끝 슬래시(trailingSlash:true) 정규화
function normalizePath(p: string) {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

// 자체 PageHeader를 렌더링하는 페이지 — layout 헤더는 생략(중복 방지)
const SELF_HEADER_ROUTES = new Set(["/paas/workloads"]);

// 자체 헤더가 없는 페이지 — layout이 메뉴명으로 헤더 렌더링
const PAGE_META: Record<string, { title: string; description: string; userDescription?: string }> = {
  "/paas/clusters": {
    title: "클러스터",
    description: "서비스 클러스터(Magnum) 목록과 상태를 확인·관리합니다.",
    userDescription: "접근 가능한 서비스 클러스터를 확인하거나 생성을 요청합니다.",
  },
  "/paas/services": { title: "서비스·인그레스", description: "K8s 서비스·인그레스 구성을 확인합니다." },
  "/paas/storage": { title: "스토리지", description: "PVC·PV·StorageClass를 확인합니다." },
  "/paas/config": { title: "설정 관리", description: "ConfigMap·Secret을 관리합니다." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = useAuth((s) => s.user?.role === "admin");

  const here = normalizePath(pathname);
  const meta = SELF_HEADER_ROUTES.has(here) ? null : PAGE_META[here];

  return (
    <div className="space-y-6">
      {meta && (
        <PageHeader
          title={meta.title}
          description={!isAdmin && meta.userDescription ? meta.userDescription : meta.description}
          actions={
            here === "/paas/clusters" ? (
              <>
                <Button variant="outline" size="sm">
                  <RefreshCw className="size-4" /> 동기화
                </Button>
                {isAdmin && (
                  <Button size="sm">
                    <Plus className="size-4" /> 클러스터 등록
                  </Button>
                )}
              </>
            ) : null
          }
        />
      )}
      {children}
    </div>
  );
}
