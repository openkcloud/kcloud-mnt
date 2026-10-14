"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ensureAuth, useAuth } from "@/lib/auth";
import { AuthLoading, SessionEnded } from "@/components/session-ended";

/* Full-screen 라우트 그룹 — 사이드바·헤더 없이 풀스크린 사용.
 * IDE / 라이브 토폴로지 등 몰입형 화면용. 인증 가드는 유지. */
export default function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const status = useAuth((s) => s.status);

  React.useEffect(() => {
    void ensureAuth();
  }, []);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [status, router]);

  if (status === "ended") return <SessionEnded />;
  if (status !== "authenticated") return <AuthLoading dark />;

  return <>{children}</>;
}
