"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuth, canAccess, ensureAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { AuthLoading, SessionEnded } from "@/components/session-ended";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const allowed = !!user && canAccess(user.role, pathname);

  // 로그인 확인(Keycloak 세션 → MNT-CORE /auth/me). 없으면 /auth/login 으로(로그인 후 이 화면으로 돌아옴)
  React.useEffect(() => {
    void ensureAuth();
  }, []);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    } else if (status === "authenticated" && user && !allowed) {
      toast.error("접근할수 없는 화면 입니다.", { id: "forbidden-page" }); // 관리자 전용 화면을 주소로 연 사용자
      router.replace("/dashboard");
    }
  }, [status, user, allowed, router]);

  if (status === "ended") return <SessionEnded />;
  if (status !== "authenticated" || !allowed) return <AuthLoading />;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
