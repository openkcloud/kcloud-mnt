/* 백엔드 호출 공통 — 토큰(Authorization: Bearer)을 붙이고, 오류를 ApiError(status·code·reason)로 바꾼다.
 * 서버 오류 형식: {"detail": 화면 문구, "code": 원인 코드, "reason"?: 세션 종료 원인} (MNT-CORE·MNT-IAAS 공통).
 * 로그인이 끝났다는 응답(401 SESSION_ENDED 등)은 등록된 처리기(auth.ts)에 알려 안내 화면으로 바꾼다. */
import { accessToken, getKeycloak } from "@/lib/keycloak";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public reason?: string) {
    super(message);
  }
}

type AuthFailure = (reason: string, message: string) => void;
let onAuthFailure: AuthFailure = () => {};

/** auth.ts 가 등록 — 순환 import 를 피하려고 처리기만 받는다. */
export function setAuthFailureHandler(fn: AuthFailure) {
  onAuthFailure = fn;
}

/** 응답 → ApiError (detail 이 있으면 그 문구, 없으면 fallback 또는 상태 코드). */
export async function readError(res: Response, fallback?: string): Promise<ApiError> {
  let body: { detail?: unknown; code?: string; reason?: string } = {};
  try {
    body = await res.json();
  } catch {}
  const msg = typeof body.detail === "string" ? body.detail : fallback ?? `${res.status} ${res.statusText}`;
  return new ApiError(msg, res.status, body.code, body.reason);
}

const ENDED_403 = new Set(["USER_NOT_REGISTERED", "USER_INACTIVE", "NO_ROLE", "USER_MISMATCH"]);

/** fetch + 토큰. 만료(401 TOKEN_EXPIRED)면 토큰을 새로 받아 한 번 더 보낸다.
 *  세션 종료·계정 문제 응답은 처리기에 알리고 응답은 그대로 돌려준다(호출부는 평소처럼 오류 처리). */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => {
    const headers = new Headers(init.headers);
    const token = await accessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };
  let res = await send();
  if (res.status === 401) {
    const err = await readError(res.clone());
    if (err.code === "TOKEN_EXPIRED") {
      try {
        await getKeycloak().updateToken(-1); // 강제 갱신
        res = await send();
      } catch {}
    }
  }
  if (res.status === 401 || res.status === 403) {
    const err = await readError(res.clone());
    if (err.code === "SESSION_ENDED") onAuthFailure(err.reason ?? "expired", err.message);
    else if (res.status === 401) onAuthFailure("expired", err.message);
    else if (err.code && ENDED_403.has(err.code)) onAuthFailure("denied", err.message);
  }
  return res;
}
