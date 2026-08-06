"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getNavByRole, type NavItem } from "@/lib/nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

/** 경로 끝의 / 를 떼고 비교한다 (next.config의 trailingSlash 대응) */
function norm(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** 현재 위치인지 판단 — 하위 화면에서도 상위 메뉴가 켜지도록 한다 */
function isPathActive(pathname: string, href: string) {
  const here = norm(pathname);
  const target = norm(href);
  if (target === "/") return here === "/";
  // 경로 구분자까지 확인해야 /monitoring 이 /monitoring-x 를 켜지 않는다
  return here === target || here.startsWith(`${target}/`);
}

export function AppSidebar() {
  const user = useAuth((s) => s.user);
  const pathname = usePathname();

  const sections = React.useMemo(
    () => (user ? getNavByRole(user.role) : []),
    [user],
  );

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5 transition-colors hover:bg-sidebar-accent/30"
        title="홈으로"
      >
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-mint-400 to-brand-indigo-400 font-bold text-sidebar-primary-foreground shadow-md">
          K
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">openKcloud</span>
          <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70">
            AI 반도체 클라우드 CMP
          </span>
        </div>
      </Link>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-3">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {section.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <SidebarItem key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  depth = 0,
}: {
  item: NavItem;
  pathname: string;
  depth?: number;
}) {
  // next.config의 trailingSlash 때문에 실제 경로 끝에 /가 붙는다.
  // 정규화하지 않으면 어떤 메뉴도 현재 위치로 표시되지 않는다.
  const isActive = isPathActive(pathname, item.href);
  const hasChildren = !!item.children?.length;
  // 현재 위치면 자동으로 펼치고, 사용자가 직접 접었으면 그 선택을 따른다
  const [manualOpen, setManualOpen] = React.useState<boolean | null>(null);
  const open = manualOpen ?? isActive;

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setManualOpen(!open)}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
            isActive && "bg-sidebar-accent text-white",
          )}
          style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {item.badge && (
            <Badge
              variant="success"
              className="h-4 bg-brand-mint-500/20 px-1.5 text-[9px] text-brand-mint-200"
            >
              {item.badge}
            </Badge>
          )}
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
        {open && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {item.children!.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                aria-current={isPathActive(pathname, child.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md py-1.5 pl-10 pr-3 text-[12.5px] transition-colors",
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-white",
                  isPathActive(pathname, child.href) &&
                    "relative bg-sidebar-accent font-semibold text-white before:absolute before:left-6 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-mint-400",
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
        isActive &&
          "bg-sidebar-accent font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-brand-mint-400",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <Badge
          variant="success"
          className="h-4 bg-brand-mint-500/20 px-1.5 text-[9px] text-brand-mint-200"
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}
