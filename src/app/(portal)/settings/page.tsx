"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import Link from "next/link";
import { Wrench, Layers3, RotateCcw, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  FEATURES, PRESET_LABEL, SCOPE_LABEL, useScope, isFeatureVisible,
  type Preset, type Feature,
} from "@/lib/scope";

const SECTION_ORDER = ["개요", "옵저버빌리티", "클라우드 자원", "서비스 마켓플레이스", "네트워크·볼륨·서비스 구성", "AI 개발환경", "AI 인프라", "운영"];

export default function SettingsPage() {
  const { preset, visible, setPreset, setFeature, reset } = useScope();

  const total = FEATURES.length;
  const shown = FEATURES.filter((f) => isFeatureVisible(visible, f.id)).length;
  const finalOnly = FEATURES.filter((f) => f.scope === "final").length;

  const groups = React.useMemo(() => {
    const map = new Map<string, Feature[]>();
    for (const f of FEATURES) {
      if (!map.has(f.section)) map.set(f.section, []);
      map.get(f.section)!.push(f);
    }
    return [...map.entries()].sort(
      (a, b) => (SECTION_ORDER.indexOf(a[0]) + 99) % 99 - (SECTION_ORDER.indexOf(b[0]) + 99) % 99,
    );
  }, []);

  function choose(p: Exclude<Preset, "custom">) {
    setPreset(p);
    toast.success(`포털 형상: ${PRESET_LABEL[p]}`, {
      description: p === "y2" ? `최종 형상 전용 기능 ${finalOnly}개를 숨긴다.` : "모든 기능을 표시한다.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="시스템 설정"
        description="포털 형상 선택 · 플랫폼 운영 메뉴/배치/에이전트 — NIRS CMP 7번 시스템관리 패턴"
      />

      {/* 포털 형상 */}
      <ChangeMark ids={["CR-NAV-04"]}>
<Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="size-4" /> 포털 형상
              </CardTitle>
              <CardDescription className="mt-1 max-w-3xl leading-relaxed">
                2차년도 과업 범위가 아닌 기능은 최종 형상 설계안에만 두고 시범서비스 포털에서는 제외한다.
                프리셋을 고르거나 기능별로 표시 여부를 바꾼다. 설정은 이 브라우저에 저장되고 사이드바와 각 화면에 바로 적용된다.
              </CardDescription>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>
                표시 <span className="font-mono font-semibold text-foreground">{shown}</span> / {total} 기능
              </div>
              <div className="mt-0.5">최종 형상 전용 {finalOnly}개</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PresetButton
              active={preset === "y2"}
              onClick={() => choose("y2")}
              title="2차년도 시범서비스"
              desc="2차년도 과업 범위의 기능만 표시"
              tone="mint"
            />
            <PresetButton
              active={preset === "final"}
              onClick={() => choose("final")}
              title="최종 형상 설계안"
              desc="모든 기능 표시 — 최종 형상 설계안"
              tone="violet"
            />
            {preset === "custom" && (
              <Badge variant="outline" className="h-8 border-amber-200 bg-amber-50 px-3 text-amber-800">
                사용자 지정 — 기능별로 조정됨
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={() => { reset(); toast.success("기본값(2차년도 시범서비스)으로 되돌림"); }}>
              <RotateCcw className="size-3.5" /> 기본값
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[260px]">기능</TableHead>
                  <TableHead className="w-[90px]">단위</TableHead>
                  <TableHead className="w-[140px]">기본 형상</TableHead>
                  <TableHead>판단 근거</TableHead>
                  <TableHead className="w-[90px] text-right">표시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(([section, items]) => (
                  <React.Fragment key={section}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={5} className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {section}
                      </TableCell>
                    </TableRow>
                    {items.map((f) => {
                      const on = isFeatureVisible(visible, f.id);
                      return (
                        <TableRow key={f.id} className={cn(!on && "text-muted-foreground")}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {on ? <Eye className="size-3.5 text-brand-mint-600" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                              <div>
                                <div className={cn("text-sm", on ? "text-foreground" : "")}>{f.label}</div>
                                <Link href={f.href} className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary">
                                  {f.href} <ExternalLink className="size-2.5" />
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="ghost" className="text-[10px]">{f.level === "menu" ? "메뉴" : "기능"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                f.scope === "final"
                                  ? "border-violet-200 bg-violet-50 text-violet-700"
                                  : "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-700",
                              )}
                            >
                              {SCOPE_LABEL[f.scope]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs leading-relaxed text-muted-foreground">{f.basis}</TableCell>
                          <TableCell className="text-right">
                            <Switch checked={on} onCheckedChange={(v) => setFeature(f.id, v)} aria-label={`${f.label} 표시`} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            메뉴 단위 기능을 숨기면 사이드바와 섹션 탭에서 사라진다. 기능 단위는 화면 안에서 안내 박스로 바뀐다.
            기본 분류 근거와 변경 이력은 <Link href="/versions" className="underline hover:text-primary">목업 관리 › 버전 이력</Link>의 v1.2 항목을 참조한다.
          </p>
        </CardContent>
      </Card>
</ChangeMark>

      <EmptyState
        icon={Wrench}
        title="메뉴 · 배치 · 에이전트 관리"
        description="플랫폼 메뉴 정의, 배치 스케줄 등록/실행 이력, OpenStack(Nova·Neutron·Cinder) 에이전트 연결 상태는 2차년도 후반 구현 예정."
      />
    </div>
  );
}

function PresetButton({
  active, onClick, title, desc, tone,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  tone: "mint" | "violet";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[240px] flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors md:flex-none md:max-w-sm",
        active
          ? tone === "mint"
            ? "border-brand-mint-500 bg-brand-mint-50/60 ring-2 ring-brand-mint-500/20"
            : "border-violet-500 bg-violet-50/60 ring-2 ring-violet-500/20"
          : "border-border hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 size-3 shrink-0 rounded-full border-2",
          active ? (tone === "mint" ? "border-brand-mint-600 bg-brand-mint-600" : "border-violet-600 bg-violet-600") : "border-muted-foreground/40",
        )}
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
