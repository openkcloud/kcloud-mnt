/* 인증 — 포털 DB 계정(MNT-CORE /api/core/auth/login)으로 로그인.
 * 토큰은 서명 없는 JWT 흉내(요청별 검증 없음) — Keycloak 도입 시 대체.
 * kcloud-mnt 설계서 SFR.MNT.006 (RBAC), SFR.MNT.007 (세션·MFA) 시연용. */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CORE_BASE } from "@/lib/menu-api";

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

// 로그인 화면 계정 빠른 입력·IAM 목업 화면 표시용 (인증에는 사용하지 않음)
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
        // 인증 서버가 응답하지 않아도 목업 계정으로 대체하지 않는다
        let res: Response;
        try {
          res = await fetch(`${CORE_BASE}/api/core/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
        } catch {
          throw new Error("인증 서버(MNT-CORE)에 연결할 수 없습니다.");
        }
        if (!res.ok) {
          const detail = await res.json().then((d) => d?.detail).catch(() => null);
          throw new Error(typeof detail === "string" ? detail : `로그인에 실패했습니다. (${res.status})`);
        }
        const d = (await res.json()) as {
          id: string; username: string; name: string; email: string | null; org: string | null; role: Role;
        };
        const user: User = {
          id: d.id,
          username: d.username,
          displayName: d.name,
          email: d.email ?? "",
          org: d.org ?? "",
          role: d.role,
          projects: [],
        };
        set({ user, token: mockJwt(user) });
        return user;
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: "openkcloud-auth" },
  ),
);

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
