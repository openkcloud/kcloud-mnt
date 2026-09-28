"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, ListChecks, Layers3, LogOut, Search, Settings, UserRound } from "lucide-react";
import { useAuth, roleLabel, type Role } from "@/lib/auth";
import { CURRENT_VERSION } from "@/lib/versions";
import { CHANGE_REQUESTS } from "@/lib/change-requests";
import { ChangeModeToggle } from "@/components/change-panel";
import { useScope, PRESET_LABEL, FEATURES, isFeatureVisible } from "@/lib/scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavByRole } from "@/lib/nav";
import { ProjectSwitcher } from "@/components/project-switcher";

function findCrumbs(pathname: string, role: Role) {
  const crumbs: { label: string; href: string }[] = [];
  for (const section of getNavByRole(role)) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        crumbs.push({ label: item.label, href: item.href });
        if (item.children) {
          const child = item.children.find((c) => pathname === c.href || c.match?.some((m) => pathname.startsWith(m)));
          if (child) crumbs.push({ label: child.label, href: child.href });
        }
      }
    }
  }
  return crumbs;
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { preset, visible } = useScope();
  const hiddenCount = FEATURES.filter((f) => !isFeatureVisible(visible, f.id)).length;
  const crumbs = findCrumbs(pathname, user?.role ?? "admin");

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProjectSwitcher />
        <div className="flex min-w-0 items-center gap-1 truncate whitespace-nowrap text-sm text-muted-foreground">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              {i > 0 && <span className="text-border">/</span>}
              <span
                className={
                  i === crumbs.length - 1
                    ? "font-medium text-foreground"
                    : ""
                }
              >
                {c.label}
              </span>
            </React.Fragment>
          ))}
        </div>
        <Badge variant="ghost" className="hidden shrink-0 gap-1 whitespace-nowrap 2xl:inline-flex" title="KCloud Monitor API v2.0 호환">
          <span className="size-1.5 rounded-full bg-brand-mint-500" />
          <span className="font-mono text-[10px]">KCloud v2 · observed 30s ago</span>
        </Badge>
        <Link href="/changes" title="초기 전달본 대비 변경 요구사항 대비표">
          <Badge variant="outline" className="hidden shrink-0 gap-1 whitespace-nowrap hover:bg-muted xl:inline-flex">
            <ListChecks className="size-3 text-muted-foreground" />
            <span className="font-mono text-[10px]">목업 {CURRENT_VERSION.id} · 변경 {CHANGE_REQUESTS.length}건</span>
          </Badge>
        </Link>
        <Link href="/settings" title="포털 형상 — 환경설정에서 기능별로 2차년도 시범서비스 / 최종 형상을 선택한다">
          <Badge
            variant="outline"
            className={
              "hidden shrink-0 gap-1 whitespace-nowrap hover:bg-muted xl:inline-flex " +
              (preset === "final"
                ? "border-violet-200 bg-violet-50 text-violet-800"
                : preset === "custom"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-800")
            }
          >
            <Layers3 className="size-3" />
            <span className="text-[10px]">
              형상 · {PRESET_LABEL[preset]}
              {hiddenCount > 0 && <span className="ml-1 opacity-70">({hiddenCount} 숨김)</span>}
            </span>
          </Badge>
        </Link>
      </div>
      <div className="relative hidden 2xl:block">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="자원·VM·파드·테넌트 검색…"
          className="w-60 pl-9"
        />
        <kbd className="pointer-events-none absolute right-2 top-2 inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground opacity-100">
          ⌘K
        </kbd>
      </div>
      <ChangeModeToggle />
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="size-4" />
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-mint-500" />
      </Button>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-auto items-center gap-2.5 px-2 py-1.5"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand-indigo-100 text-brand-indigo-800">
                  {user.displayName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-sm font-medium">{user.displayName}</span>
                <span className="text-[11px] text-muted-foreground">{user.org}</span>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <Badge variant="default" className="mt-1.5 w-fit">
                  {roleLabel(user.role)}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserRound className="size-4" /> 내 프로필
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4" /> 환경 설정
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-700"
            >
              <LogOut className="size-4" /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
