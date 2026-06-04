"use client";
import * as React from "react";

const MSW_ENABLED = process.env.NEXT_PUBLIC_MSW_ENABLED !== "false";

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(!MSW_ENABLED);

  React.useEffect(() => {
    if (!MSW_ENABLED) return;
    let cancelled = false;
    (async () => {
      const { worker } = await import("@/mocks/browser");
      await worker.start({
        onUnhandledRequest: "bypass",
        serviceWorker: { url: "/mockServiceWorker.js" },
      });
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            openKcloud 목업 환경 준비 중…
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
