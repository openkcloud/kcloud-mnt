/**
 * CMP 백엔드 주소 결정
 *
 * NEXT_PUBLIC_KF_API 값 형식
 *   - "auto:8000"            → 브라우저가 접속한 호스트의 8000 포트 (권장)
 *                              localhost로 들어오면 localhost:8000,
 *                              192.168.x.x로 들어오면 그 IP:8000 → 사내 다른 PC 접속 지원
 *   - "http://host:8000"     → 고정 주소
 *   - 미설정                  → mock 모드
 */
const RAW = process.env.NEXT_PUBLIC_KF_API ?? "";

export const KF_ENABLED = RAW !== "";

export const KF_BASE = (() => {
  if (!RAW) return "";
  if (RAW.startsWith("auto:")) {
    if (typeof window === "undefined") return ""; // SSR 시점에는 호출 안 함
    return `${window.location.protocol}//${window.location.hostname}:${RAW.slice(5)}`;
  }
  return RAW;
})();
