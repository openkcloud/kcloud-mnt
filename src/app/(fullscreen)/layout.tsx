"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/* Full-screen 라우트 그룹 — 사이드바·헤더 없이 풀스크린 사용.
 * IDE / 라이브 토폴로지 등 몰입형 화면용. 인증 가드는 유지. */
export default function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  React.useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <div className="size-8 animate-spin rounded-full border-2 border-brand-mint-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
