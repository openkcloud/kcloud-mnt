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
    // https로 들어왔다면 외부 터널(단일 입구 리버스 프록시) 경유다 —
    // 별도 포트가 밖에 없으므로 같은 주소(origin)로 호출한다.
    // 주의: 빈 문자열을 돌려주면 안 된다 — KF_BASE가 falsy면 곳곳에서
    // mock 모드로 해석해 목업 미리보기가 뜬다(실사례).
    if (window.location.protocol === "https:") return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}:${RAW.slice(5)}`;
  }
  return RAW;
})();

/**
 * CMP 백엔드 호출 — 응답이 없으면 정해진 시간에 끊는다.
 *
 * 백엔드가 바쁘면(동시 처리 한도 소진) 요청이 무한정 줄을 서고, 화면은
 * 아무 안내 없이 계속 도는 것처럼 보인다(2026-08-07 시연 중 프로파일 생성).
 * 생성·삭제처럼 사용자가 결과를 기다리는 호출에 쓴다.
 */
export async function kfetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new Error(
        `서버가 응답하지 않습니다 (${timeoutMs / 1000}초 초과). ` +
          `잠시 후 다시 시도하거나, 열어둔 다른 탭을 닫고 시도해 주세요.`,
      );
    }
    throw e;
  }
}
