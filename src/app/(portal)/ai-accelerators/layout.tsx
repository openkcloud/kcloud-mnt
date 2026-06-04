"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ai-accelerators", label: "디바이스 인벤토리", match: "exact" as const },
  { href: "/ai-accelerators/allocation", label: "자원 할당 현황" },
  { href: "/ai-accelerators/partitions", label: "파티션 (MIG·Slice)" },
  { href: "/ai-accelerators/topology", label: "노드 토폴로지" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI반도체 관리"
        description="이종 AI반도체(GPU·NPU·PIM)를 단일 콘솔에서 인식·관리합니다"
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCw className="size-4" /> 디바이스 자동 탐색
            </Button>
            <Button size="sm">
              <Plus className="size-4" /> 디바이스 추가
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.match === "exact" ? pathname === t.href : pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
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
