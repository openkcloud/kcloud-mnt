"use client";
import * as React from "react";
import { toast } from "sonner";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID;
const INTERVAL_MS = 5 * 60 * 1000;

/** 새 배포 알림 — 열어 둔 탭이 예전 화면을 계속 쓰지 않게.
 *  탭이 다시 보일 때와 보이는 동안 5분마다 /version.json(빌드 때 생성, 수십 바이트)을 확인하고,
 *  버전이 다르면 새로고침 안내를 띄운다. 입력 중일 수 있어 자동으로 새로고침하지는 않는다. */
export function VersionWatcher() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !CURRENT) return;
    let notified = false;
    async function check() {
      if (notified || document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/version.json", { cache: "no-cache" }); // 바뀌지 않았으면 304
        if (!r.ok) return;
        const { buildId } = (await r.json()) as { buildId?: string };
        if (!buildId || buildId === CURRENT) return;
        notified = true;
        toast.info("새 버전이 배포되었습니다", {
          description: "새로고침하면 새 화면을 사용할 수 있습니다.",
          duration: Infinity,
          action: { label: "새로고침", onClick: () => window.location.reload() },
        });
      } catch {
        // 네트워크 오류 — 다음 확인 때 다시
      }
    }
    const timer = setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
