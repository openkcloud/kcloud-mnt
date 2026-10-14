/* 인증 — Keycloak(OIDC Authorization Code + PKCE). 토큰은 메모리(keycloak-js)에만, 사용자·역할은 MNT-CORE /auth/me.
 * kcloud-mnt 설계서 SFR.MNT.006 (RBAC), SFR.MNT.007 (세션 관리).
 *
 * 세션 규칙(2026-10-13 결정)
 *  - 로그인 유지는 Keycloak 세션(Remember me) — 탭을 닫거나 브라우저를 껐다 켜도 유지.
 *  - 미사용: 클릭·입력 등 사용자 조작이 Keycloak 미사용 시간(갱신 토큰 수명)을 넘게 없으면 로그아웃(idle).
 *    자동 갱신 화면이 계속 돌아도 조작이 없으면 끝난다. 조작 시각은 탭끼리 공유(localStorage).
 *  - 끝난 세션은 원인별 안내 + 로그인 버튼. 같은 브라우저 다른 탭에도 알린다(BroadcastChannel).
 *  - 다른 곳 로그인·관리자 강제 종료는 MNT-CORE /auth/session 을 보이는 탭이 5초마다 확인. */
import { create } from "zustand";
import { CORE_BASE } from "@/lib/menu-api";
import { clearTokens, getKeycloak, initKeycloak, logoutRedirect } from "@/lib/keycloak";
import { authFetch, readError, setAuthFailureHandler } from "@/lib/http";
import { getNavByRole, type NavItem } from "@/lib/nav";

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  org: string;
  role: Role;
  projects: string[];
  avatar?: string;
}

// IAM 목업 화면(사용자 목록) 표시용 — 인증에는 사용하지 않음
export const MOCK_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: "admin",
    user: {
      id: "u-001",
      username: "admin",
      displayName: "최현화",
      email: "hhchoi@etri.re.kr",
      org: "ETRI",
      role: "admin",
      projects: ["*"],
    },
  },
  user: {
    password: "user",
    user: {
      id: "u-002",
      username: "user",
      displayName: "윤호영",
      email: "hy.yun@okestro.com",
      org: "오케스트로(주)",
      role: "user",
      projects: ["*"],
    },
  },
};

/** 세션 종료 원인별 안내 — logout·idle·admin·duplicate 는 MNT-CORE cmn_code(IAM_SESSION_END_REASON) 와 같다. */
const END_MESSAGES: Record<string, string> = {
  logout: "로그아웃 되었습니다.",
  idle: "오랫동안 사용하지 않아 로그아웃 되었습니다.",
  admin: "관리자에 의해 로그아웃되었습니다.",
  duplicate: "다른곳에서 로그인되었습니다.",
  other_tab: "다른 탭에서 로그아웃되었습니다.",
  expired: "로그인이 만료되었습니다. 다시 로그인하세요.",
};

type Status = "loading" | "authenticated" | "unauthenticated" | "ended";

interface AuthState {
  status: Status;
  user: User | null;
  /** 끝난 이유 — reason 이 denied 면 계정 문제(미등록·비활성 등), 그 밖은 세션 종료 */
  ended: { reason: string; message: string } | null;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>()(() => ({
  status: "loading",
  user: null,
  ended: null,
  logout: () => endSession("logout", { server: true, broadcast: true }),
}));

// ── 시작 ──────────────────────────────────────────────────────────

let started: Promise<void> | null = null;

/** 로그인 확인(페이지당 1회) — Keycloak 세션 → MNT-CORE /auth/me. 화면 가드와 /auth/login 이 부른다. */
export function ensureAuth(): Promise<void> {
  started ??= (async () => {
    let authenticated = false;
    try {
      authenticated = await initKeycloak();
    } catch {
      authenticated = false;
    }
    if (!authenticated) {
      useAuth.setState({ status: "unauthenticated" });
      return;
    }
    let res: Response;
    try {
      res = await authFetch(`${CORE_BASE}/api/core/auth/me`);
    } catch {
      useAuth.setState({ status: "ended", ended: { reason: "error", message: "서버(MNT-CORE)에 연결할 수 없습니다." } });
      return;
    }
    if (!res.ok) {
      const err = await readError(res);
      const reason = err.code === "SESSION_ENDED" ? err.reason ?? "expired" : res.status === 403 ? "denied" : "error";
      useAuth.setState({ status: "ended", ended: { reason, message: END_MESSAGES[reason] ?? err.message } });
      return;
    }
    const me = (await res.json()) as {
      id: string; username: string; name: string; email: string | null; org: string | null; role: Role; projectIds: string[];
    };
    useAuth.setState({
      status: "authenticated",
      ended: null,
      user: {
        id: me.id, username: me.username, displayName: me.name, email: me.email ?? "", org: me.org ?? "",
        role: me.role, projects: me.projectIds,
      },
    });
    startWatchers();
  })();
  return started;
}

// ── 세션 종료 ─────────────────────────────────────────────────────

let channel: BroadcastChannel | null = null;

async function endSession(reason: string, opts: { server?: boolean; broadcast?: boolean; message?: string } = {}) {
  if (useAuth.getState().status !== "authenticated") return;
  if (opts.broadcast) channel?.postMessage({ type: "ended", reason }); // stopWatchers 가 채널을 닫기 전에 알린다
  stopWatchers();
  if (opts.server) {
    // 포털 세션 종료 기록 + Keycloak 세션 삭제(서버) — 그래서 Keycloak 화면으로 넘어가지 않고 이 자리에 안내한다
    try {
      await authFetch(`${CORE_BASE}/api/core/auth/logout`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
    } catch {}
  }
  clearTokens();
  useAuth.setState({
    status: "ended", user: null,
    ended: { reason, message: END_MESSAGES[reason] ?? opts.message ?? END_MESSAGES.expired },
  });
}

// 백엔드 응답(401 세션 종료·만료, 403 계정 문제)으로 알게 된 종료
setAuthFailureHandler((reason, message) => {
  if (reason === "denied") {
    if (useAuth.getState().status !== "authenticated") return;
    stopWatchers();
    useAuth.setState({ status: "ended", user: null, ended: { reason, message } });
    return;
  }
  void endSession(reason, { message });
});

/** 안내 화면의 로그인 버튼 — 이 브라우저의 Keycloak 세션·쿠키까지 끝내고(Keycloak 로그아웃 경유) 로그인 화면으로.
 *  로그인 화면으로 바로 보내면, Keycloak 세션이 남아 있을 때(서버 쪽 삭제 실패 등) 끝난 세션으로 조용히 다시 들어와 같은 안내가 반복된다.
 *  계정 문제(denied)면 다른 계정으로 로그인하므로 원래 화면(next)으로 돌아가지 않는다. */
export function loginAgain() {
  const next = window.location.pathname + window.location.search;
  const keep = useAuth.getState().ended?.reason !== "denied" && !next.startsWith("/auth/");
  void logoutRedirect(`${window.location.origin}/auth/login/${keep ? `?next=${encodeURIComponent(next)}` : ""}`);
}

// ── 감시: 조작 시각·미사용·세션 상태·토큰 유지·다른 탭 ──────────────

const ACTIVITY_KEY = "okc-last-activity";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;
let timers: ReturnType<typeof setInterval>[] = [];
let lastWrite = 0;

function touch() {
  const now = Date.now();
  if (now - lastWrite < 10_000) return; // 10초에 한 번만 기록
  lastWrite = now;
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {}
}

function lastActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || lastWrite;
  } catch {
    return lastWrite;
  }
}

/** Keycloak 미사용 시간(초) = 갱신 토큰 수명. Keycloak 설정을 바꾸면 그대로 따른다. */
function idleLimitSeconds(): number {
  const r = getKeycloak().refreshTokenParsed;
  return r?.exp && r?.iat ? r.exp - r.iat : 1800;
}

async function checkSession() {
  try {
    const res = await authFetch(`${CORE_BASE}/api/core/auth/session`);
    if (!res.ok) return;
    const s = (await res.json()) as { active: boolean; reason?: string; detail?: string };
    if (!s.active) void endSession(s.reason ?? "expired", { message: s.detail });
  } catch {}
}

function onVisible() {
  if (document.visibilityState === "visible") void checkSession();
}

function startWatchers() {
  lastWrite = 0;
  touch();
  ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
  document.addEventListener("visibilitychange", onVisible);
  timers = [
    // 미사용 — 마지막 조작(모든 탭) 후 미사용 시간이 지나면 로그아웃
    setInterval(() => {
      if (Date.now() - lastActivity() > idleLimitSeconds() * 1000) {
        void endSession("idle", { server: true, broadcast: true });
      }
    }, 15_000),
    // 세션 상태 — 보이는 탭만 5초마다(숨겨진 탭은 다시 볼 때 onVisible)
    setInterval(() => {
      if (document.visibilityState === "visible") void checkSession();
    }, 5_000),
    // 토큰 유지 — 열려 있는 동안 갱신(미사용 판단은 위 조작 시각으로 따로 한다)
    setInterval(() => {
      getKeycloak().updateToken(70).catch(() => void checkSession().then(() => endSession("expired")));
    }, 60_000),
  ];
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel("okc-auth");
    channel.onmessage = (e: MessageEvent<{ type: string; reason: string }>) => {
      if (e.data?.type === "ended") void endSession(e.data.reason === "logout" ? "other_tab" : e.data.reason);
    };
  }
}

function stopWatchers() {
  ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
  document.removeEventListener("visibilitychange", onVisible);
  timers.forEach(clearInterval);
  timers = [];
  channel?.close();
  channel = null;
}

// ── 화면 권한 ─────────────────────────────────────────────────────

export function roleLabel(role: Role) {
  return (
    {
      admin: "관리자",
      user: "유저",
    } as const
  )[role];
}

function hrefs(items: NavItem[]): string[] {
  return items.flatMap((i) => [i.href, ...hrefs(i.children ?? [])]);
}

// 관리자 메뉴에만 있는 화면(+ 메뉴 없이 관리자 탭으로만 여는 라우터) — 사용자가 주소로 들어오면 막는다
const ADMIN_ONLY = (() => {
  const user = new Set(getNavByRole("user").flatMap((s) => hrefs(s.items)));
  const admin = getNavByRole("admin").flatMap((s) => hrefs(s.items)).filter((h) => !user.has(h));
  return [...new Set([...admin, "/iaas/routers"])];
})();

export function canAccess(role: Role | undefined, path: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  const p = path.replace(/\/+$/, "") || "/";
  return !ADMIN_ONLY.some((h) => p === h || p.startsWith(`${h}/`));
}
