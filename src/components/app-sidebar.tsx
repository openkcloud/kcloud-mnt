"use client";
import * as React from "react";
import { ChangeMark } from "@/components/change-mark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getNavByRole, type NavItem } from "@/lib/nav";
import { useScope, hiddenFeatures } from "@/lib/scope";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const user = useAuth((s) => s.user);
  const visible = useScope((s) => s.visible);
  const pathname = usePathname();

  // 포털 형상에서 숨긴 기능(메뉴 단위)은 사이드바에서도 제외한다
  const sections = React.useMemo(
    () => (user ? getNavByRole(user.role, hiddenFeatures(visible)) : []),
    [user, visible],
  );

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5 transition-colors hover:bg-sidebar-accent/30"
        title="홈으로"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/95 p-1 shadow-md">
          {/* openKcloud 공식 로고 — github.com/openkcloud 조직 아바타 */}
          <img
            src="/logo/openkcloud-mark.png"
            alt="openKcloud"
            className="size-full object-contain"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">openKcloud</span>
          <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70">
            AI 반도체 클라우드 CMP
          </span>
        </div>
      </Link>
      <ScrollArea className="flex-1">
        <ChangeMark ids={["CR-NAV-01", "CR-NAV-02"]} className="mx-1">
          <nav className="flex flex-col gap-1 p-3">
            {sections.map((section) => (
              <ChangeMark
                key={section.label}
                ids={
                  section.label === "네트워크·볼륨·서비스 구성"
                    ? ["CR-NAV-03"]
                    : []
                }
              >
                <div className="mb-3">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map((item) => (
                      <SidebarItem
                        key={item.href}
                        item={item}
                        pathname={pathname}
                      />
                    ))}
                  </div>
                </div>
              </ChangeMark>
            ))}
          </nav>
        </ChangeMark>
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
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
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
