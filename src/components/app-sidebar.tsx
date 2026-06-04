"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NAV_SECTIONS, filterNavByRole, type NavItem } from "@/lib/nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const user = useAuth((s) => s.user);
  const pathname = usePathname();

  const sections = React.useMemo(
    () => (user ? filterNavByRole(NAV_SECTIONS, user.role) : []),
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
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-sidebar-accent/60 p-3 text-[11px] text-sidebar-foreground/80">
          <div className="font-medium text-white">목업 환경</div>
          <div className="mt-0.5">
            MSW로 mock 데이터 제공 중. 실 API 연동 전 시연용입니다.
          </div>
        </div>
      </div>
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
  const isActive =
    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = React.useState(isActive);
  React.useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
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
                className={cn(
                  "flex items-center gap-2.5 rounded-md py-1.5 pl-10 pr-3 text-[12.5px] transition-colors",
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-white",
                  pathname === child.href &&
                    "bg-sidebar-accent text-white before:absolute relative before:left-6 before:top-1/2 before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-primary",
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
        "group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
        isActive && "bg-sidebar-accent text-white",
      )}
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
