/* Mock 인증 — JWT 흉내내지만 실제 서명은 안 함.
 * kcloud-mnt 설계서 SFR.MNT.006 (RBAC), SFR.MNT.007 (세션·MFA) 시연용. */
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      projects: ["ai-research", "llm-serving"],
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
        const token = mockJwt(entry.user);
        set({ user: entry.user, token });
        return entry.user;
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
