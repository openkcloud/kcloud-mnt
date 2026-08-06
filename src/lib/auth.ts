/* Mock 인증 — JWT 흉내내지만 실제 서명은 안 함.
 * kcloud-mnt 설계서 SFR.MNT.006 (RBAC), SFR.MNT.007 (세션·MFA) 시연용. */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { KF_BASE, KF_ENABLED } from "@/lib/kf";

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

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

function b64u(value: unknown): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function mockJwt(user: User) {
  const header = b64u({ alg: "none", typ: "JWT" });
  const payload = b64u({
    sub: user.id,
    name: user.displayName,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  });
  return `${header}.${payload}.mock`;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (username, password) => {
        await new Promise((r) => setTimeout(r, 400));
        const entry = MOCK_USERS[username.toLowerCase()];
        if (!entry || entry.password !== password) {
          throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        // 실백엔드 모드: CMP 백엔드 세션 쿠키도 발급 (IDE 프록시 인증용)
        if (KF_ENABLED) {
          try {
            await fetch(`${KF_BASE}/api/v1/auth/login`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password }),
            });
          } catch {
            /* 백엔드 미가동 시 포털 로그인은 유지 (IDE 접속만 제한됨) */
          }
        }
        const token = mockJwt(entry.user);
        set({ user: entry.user, token });
        return entry.user;
      },
      logout: () => {
        if (KF_ENABLED) {
          fetch(`${KF_BASE}/api/v1/auth/logout`, {
            method: "POST",
            credentials: "include",
          }).catch(() => {});
        }
        set({ user: null, token: null });
      },
    }),
    { name: "openkcloud-auth" },
  ),
);

/**
 * 백엔드(CMP) 세션 보장 — IDE 프록시 접근 전에 호출.
 * 포털에 로그인돼 있는데 백엔드 쿠키만 없는 경우(백엔드 재시작·쿠키 만료 등)
 * 사용자에게 다시 로그인을 요구하지 않고 조용히 세션을 재발급한다.
 */
export async function ensureBackendSession(): Promise<boolean> {
  if (!KF_ENABLED) return true;
  try {
    const me = await fetch(`${KF_BASE}/api/v1/auth/me`, { credentials: "include" });
    if (me.ok) return true;
  } catch {
    return false;
  }
  const user = useAuth.getState().user;
  if (!user) return false;
  const entry = MOCK_USERS[user.username.toLowerCase()];
  if (!entry) return false;
  try {
    const res = await fetch(`${KF_BASE}/api/v1/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, password: entry.password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function roleLabel(role: Role) {
  return (
    {
      admin: "관리자",
      user: "유저",
    } as const
  )[role];
}

// admin과 user 모두 모든 메뉴 접근 가능 (권한 동일)
export function canAccess(role: Role | undefined, _path: string): boolean {
  if (!role) return false;
  return true;
}
