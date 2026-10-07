"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, canAccess } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);

  // persist(localStorage) 복원이 끝날 때까지 로그인 판단을 미룬다.
  // (새로고침 시 복원 전에 가드가 돌아 /login 으로 튕기는 문제 방지)
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    if (useAuth.persist.hasHydrated()) setHydrated(true);
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canAccess(user.role, pathname)) {
      router.replace("/dashboard");
    }
  }, [hydrated, user, pathname, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

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
