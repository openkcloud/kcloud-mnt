"use client";
import * as React from "react";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  Cpu,
  Sparkles,
  ShoppingBag,
  Boxes,
  Globe,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { BrandLogo } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  REBELLIONS_MODELS,
  modelStats,
  originalUrl,
  type ModelCategory,
  type RblnHardware,
  type ZooModel,
} from "@/lib/model-zoo";

const CATEGORY_ORDER: ModelCategory[] = [
  "LLM",
  "Multimodal",
  "Vision",
  "Audio",
  "Embedding",
  "Diffusion",
];

export default function CatalogPage() {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<"all" | ModelCategory>("all");
  const [hw, setHw] = React.useState<"all" | RblnHardware>("all");

  const stats = modelStats();

  const items = REBELLIONS_MODELS.filter((m) => {
    if (cat !== "all" && m.category !== cat) return false;
    if (hw !== "all" && !m.hardware.includes(hw)) return false;
    if (q) {
      const lq = q.toLowerCase();
      return (
        m.name.toLowerCase().includes(lq) ||
        m.fullName.toLowerCase().includes(lq) ||
        m.author.toLowerCase().includes(lq) ||
        m.description.toLowerCase().includes(lq)
      );
    }
    return true;
  });

  // group by category for non-filter view
  const grouped = CATEGORY_ORDER.map((c) => ({
    category: c,
    models: items.filter((m) => m.category === c),
  })).filter((g) => g.models.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="서비스 마켓플레이스"
        description={
          <span className="inline-flex items-center gap-1.5">
            Rebellions ModelZoo 연동 — {stats.total}개 모델 즉시 배포
            <Badge variant="outline" className="text-[10px]">
              powered by Rebellions
            </Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://github.com/rebellions-sw/rbln-model-zoo"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="size-3.5" /> rbln-model-zoo
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://rebellions.ai/developers/model-zoo/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="size-3.5" /> 공식 페이지
              </a>
            </Button>
            <Button size="sm">
              <ShoppingBag className="size-3.5" /> 내 구독
            </Button>
          </>
        }
      />

      {/* Filter band */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="모델 이름·작성자·태그 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-72 pl-9"
            />
          </div>
          <Select value={cat} onValueChange={(v) => setCat(v as typeof cat)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              {CATEGORY_ORDER.map((c) => (
                <SelectItem key={c} value={c}>
                  {c} ({stats.byCategory[c]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hw} onValueChange={(v) => setHw(v as typeof hw)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="RBLN 하드웨어" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 하드웨어</SelectItem>
              <SelectItem value="ATOM">ATOM</SelectItem>
              <SelectItem value="ATOM+">ATOM+</SelectItem>
              <SelectItem value="REBEL">REBEL</SelectItem>
              <SelectItem value="REBEL Quad">REBEL Quad</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>{items.length} / {stats.total} 모델</span>
            <span>·</span>
            <span>{stats.byAuthor}개 기관</span>
          </div>
        </div>
      </Card>

      {/* Category bands */}
      <div className="space-y-8">
        {grouped.map(({ category, models }) => (
          <section key={category}>
            <div className="mb-3 flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <CategoryBadge category={category} />
                <h2 className="text-sm font-semibold text-foreground">{category}</h2>
                <span className="text-xs text-muted-foreground">
                  ({models.length}개 모델)
                </span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {models.map((m) => (
                <ModelCard key={m.id} model={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ModelCard({ model }: { model: ZooModel }) {
  return (
    <a
      href={originalUrl(model)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-xl"
    >
      <Card className="relative flex h-full flex-col overflow-hidden border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
        {/* Gradient bar (category color) */}
        <div className={cn("absolute inset-x-0 top-0 h-0.5", categoryBarColor(model.category))} />

        {/* Highlight badge */}
        {model.highlight && (
          <div className="absolute right-3 top-3">
            <Badge
              variant={
                model.highlight === "Korean"
                  ? "warning"
                  : model.highlight === "Featured"
                    ? "default"
                    : "success"
              }
              className="gap-1 text-[10px]"
            >
              {model.highlight === "Featured" && <Sparkles className="size-3" />}
              {model.highlight === "Korean" && "🇰🇷"}
              {model.highlight}
            </Badge>
          </div>
        )}

        <CardContent className="flex flex-1 flex-col p-5">
          {/* ── Header (고정 높이) ── */}
          <div className="space-y-1.5 pr-12">
            <div className="flex items-start gap-2">
              <CategoryBadge category={model.category} size="sm" />
            </div>
            <div className="flex items-start gap-2.5">
              <BrandLogo author={model.author} size={32} />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 min-h-[2.5rem] text-base font-bold leading-tight">{model.name}</h3>
                <div className="truncate font-mono text-[11px] text-muted-foreground">
                  {model.fullName}
                </div>
              </div>
            </div>
          </div>

          {/* ── Author + Size (고정 높이) ── */}
          <div className="mt-3 flex items-baseline justify-between border-y border-border py-2 text-xs">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">작성</div>
              <div className="font-medium">{model.author}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground">파라미터</div>
              <div className="font-mono font-bold tabular-nums">
                {model.paramsB < 1
                  ? `${Math.round(model.paramsB * 1000)}M`
                  : `${model.paramsB}B`}
              </div>
            </div>
          </div>

          {/* ── Description (2줄 고정) ── */}
          <p className="mt-3 line-clamp-2 min-h-[2.25rem] text-xs leading-tight text-muted-foreground">
            {model.description}
          </p>

          {/* ── Hardware chips (최소 높이로 줄 수 통일) ── */}
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] uppercase text-muted-foreground">호환 하드웨어</div>
            <div className="flex min-h-[1.75rem] flex-wrap gap-1">
              {model.hardware.map((h) => (
                <Badge
                  key={h}
                  variant="ghost"
                  className="gap-1 bg-brand-mint-50 text-brand-mint-700 text-[10px]"
                >
                  <Cpu className="size-2.5" />
                  RBLN {h}
                </Badge>
              ))}
            </div>
          </div>

          {/* ── Framework + license (최소 높이, mt-auto로 push) ── */}
          <div className="mt-auto flex min-h-[1.5rem] flex-wrap items-center gap-1 pt-3 text-[10px]">
            {model.framework.map((f) => (
              <Badge key={f} variant="outline" className="text-[10px]">
                {f}
              </Badge>
            ))}
            <span className="ml-auto truncate text-muted-foreground">{model.license}</span>
          </div>
        </CardContent>

        {/* ── CTA footer (카드 외부, 항상 하단) ── */}
        <div className="grid grid-cols-2 border-t border-border bg-secondary/30">
          <span className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:bg-secondary/60 group-hover:text-foreground">
            <ExternalLink className="size-3" />
            원본 모델
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(model.externalUrl, "_blank", "noopener,noreferrer");
            }}
            className="flex items-center justify-center gap-1.5 border-l border-border px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="rbln-model-zoo GitHub 저장소로 이동"
          >
            <GithubIcon className="size-3" />
            rbln-model-zoo
          </button>
        </div>
      </Card>
    </a>
  );
}

function CategoryBadge({
  category,
  size = "default",
}: {
  category: ModelCategory;
  size?: "default" | "sm";
}) {
  const palette: Record<ModelCategory, string> = {
    LLM: "bg-brand-indigo-100 text-brand-indigo-800",
    Multimodal: "bg-violet-100 text-violet-800",
    Vision: "bg-sky-100 text-sky-800",
    Audio: "bg-amber-100 text-amber-800",
    Embedding: "bg-brand-mint-50 text-brand-mint-700",
    Diffusion: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium uppercase tracking-wider",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        palette[category],
      )}
    >
      {category}
    </span>
  );
}

function categoryBarColor(c: ModelCategory) {
  return (
    {
      LLM: "bg-gradient-to-r from-brand-indigo-500 to-brand-indigo-300",
      Multimodal: "bg-gradient-to-r from-violet-500 to-violet-300",
      Vision: "bg-gradient-to-r from-sky-500 to-sky-300",
      Audio: "bg-gradient-to-r from-amber-500 to-amber-300",
      Embedding: "bg-gradient-to-r from-brand-mint-500 to-brand-mint-300",
      Diffusion: "bg-gradient-to-r from-rose-500 to-rose-300",
    } as const
  )[c];
}
