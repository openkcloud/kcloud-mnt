"use client";
import * as React from "react";

const MSW_ENABLED = process.env.NEXT_PUBLIC_MSW_ENABLED !== "false";
const INIT_TIMEOUT_MS = 6000;

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(!MSW_ENABLED);
  const [warning, setWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!MSW_ENABLED) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    // 6초 타임아웃 — Service Worker 등록이 멈춰도 앱은 진입
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        // eslint-disable-next-line no-console
        console.warn("[MSW] init timeout — rendering app without mocks");
        setWarning("Mock 서버 초기화 타임아웃 — 일부 데이터가 비어있을 수 있습니다.");
        setReady(true);
      }
    }, INIT_TIMEOUT_MS);

    (async () => {
      try {
        const { worker } = await import("@/mocks/browser");
        await worker.start({
          onUnhandledRequest: "bypass",
          serviceWorker: { url: "/mockServiceWorker.js" },
        });
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setReady(true);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[MSW] init failed:", e);
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          const msg = e instanceof Error ? e.message : String(e);
          setWarning(`Mock 서버 초기화 실패: ${msg}`);
          setReady(true); // fail-open — 앱은 어쨌든 렌더링
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
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
          <p className="text-[11px] text-muted-foreground/60">
            6초 이상 멈춰 있다면 브라우저 콘솔(F12)을 확인하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {warning && (
        <div className="fixed left-1/2 top-2 z-[9999] -translate-x-1/2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shadow-md">
          {warning}
        </div>
      )}
      {children}
    </>
  );
}
