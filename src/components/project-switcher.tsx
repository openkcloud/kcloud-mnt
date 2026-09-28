"use client";
import { toast } from "sonner";
import { Check, ChevronDown, FolderKanban } from "lucide-react";
import { useProjectContext, ALL } from "@/lib/project-context";
import { ChangeMark } from "@/components/change-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** 포털 전역 프로젝트(테넌트) 선택기 — AI 노트북 화면이 이 프로젝트로 걸린다 */
export function ProjectSwitcher() {
  const { current, setCurrent, isAdmin, allowed, label, projects } = useProjectContext();
  if (!allowed.length) return null;
  function pick(p: string) {
    setCurrent(p);
    toast.success(p === ALL ? "전체 프로젝트 보기 (관리자)" : `프로젝트 전환 — ${p}`);
  }
  return (
    <ChangeMark ids={["CR-AID-11"]} inline>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 whitespace-nowrap pl-2 pr-2 text-xs" title="작업할 프로젝트(테넌트)를 고른다">
          <FolderKanban className="size-3.5 text-brand-indigo-600" />
          <span className="text-muted-foreground">프로젝트</span>
          <span className="font-mono font-semibold">{label}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          {isAdmin ? "모든 프로젝트 (관리자)" : "내가 속한 프로젝트"}
        </DropdownMenuLabel>
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => pick(ALL)} className="gap-2">
              <Check className={cn("size-3.5", current === ALL ? "opacity-100" : "opacity-0")} />
              <span className="font-medium">전체 프로젝트</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {projects.filter((p) => allowed.includes(p.name)).map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => pick(p.name)} className="items-start gap-2">
            <Check className={cn("mt-0.5 size-3.5", current === p.name ? "opacity-100" : "opacity-0")} />
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold">{p.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{p.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    </ChangeMark>
  );
}
