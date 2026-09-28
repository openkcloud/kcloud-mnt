"use client";
import * as React from "react";
import Link from "next/link";
import { EyeOff, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_MAP, SCOPE_LABEL, useFeatureVisible } from "@/lib/scope";
import { Badge } from "@/components/ui/badge";

/**
 * 형상에 따라 기능을 표시하거나 숨긴다.
 * - fallback="note": 숨김 상태를 대체 안내 박스로 표시(검토용 기본값)
 * - fallback="none": 아무것도 그리지 않음
 */
export function FeatureGate({
  id,
  children,
  fallback = "note",
  className,
}: {
  id: string;
  children: React.ReactNode;
  fallback?: "note" | "none";
  className?: string;
}) {
  const visible = useFeatureVisible(id);
  if (visible) return <>{children}</>;
  if (fallback === "none") return null;
  const f = FEATURE_MAP[id];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <EyeOff className="size-4 shrink-0" />
      <div className="flex-1 leading-relaxed">
        <span className="font-medium text-foreground">{f?.label ?? id}</span>
        <span className="mx-1.5">·</span>
        {f ? SCOPE_LABEL[f.scope] : "최종 형상"} 전용 기능이라 현재 형상에서는 숨김.
        {f?.basis && <span className="ml-1 text-muted-foreground/80">{f.basis}</span>}
      </div>
      <Link
        href="/settings"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] hover:bg-muted"
      >
        <Settings2 className="size-3" /> 형상 설정
      </Link>
    </div>
  );
}

/** 기능 옆에 붙이는 형상 태그 */
export function ScopeTag({ id, className }: { id: string; className?: string }) {
  const f = FEATURE_MAP[id];
  if (!f) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        f.scope === "final" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-700",
        className,
      )}
    >
      {SCOPE_LABEL[f.scope]}
    </Badge>
  );
}
