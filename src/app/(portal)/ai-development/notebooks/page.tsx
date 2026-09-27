"use client";
import { toast } from "sonner";
import * as React from "react";
import Link from "next/link";
import {
  TerminalSquare,
  Cpu,
  Clock,
  Play,
  Square,
  Trash2,
  ExternalLink,
  Plus,
  Search,
  BookOpen,
  Code2,
  Container,
  HardDrive,
} from "lucide-react";
import { api } from "@/lib/api";
import { useProjectContext } from "@/lib/project-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import type { KFNotebook } from "@/lib/types";

export default function NotebooksPage() {
  const [q, setQ] = React.useState("");
  // 네임스페이스 = 헤더에서 고른 프로젝트 (화면별 네임스페이스 선택은 두지 않는다)
  const { match, label, isAll } = useProjectContext();
  const { data, isLoading } = api.kubeflow.notebooks() as {
    data: { items: KFNotebook[] } | undefined;
    isLoading: boolean;
  };

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const mine = data.items.filter((n) => match(n.namespace));
  const items = mine.filter((n) => !q || n.name.toLowerCase().includes(q.toLowerCase()));

  const counts = {
    running: mine.filter((n) => n.status === "Running").length,
    starting: mine.filter((n) => n.status === "Starting").length,
    stopped: mine.filter((n) => n.status === "Stopped").length,
  };

  return (
    <div className="space-y-4">
      {/* Quick stats — Kubeflow style */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatChip label="실행 중" value={counts.running} accent="mint" hint="활성 서버" />
        <StatChip label="시작 중" value={counts.starting} accent="amber" hint="프로비저닝" />
        <StatChip label="정지" value={counts.stopped} accent="slate" hint="유휴" />
        <StatChip
          label="총 가속기 할당"
          value={mine.reduce((s, n) => s + n.acceleratorCount, 0)}
          accent="indigo"
          hint="GPU·NPU·PIM"
        />
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="노트북 서버 이름…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <Badge variant="outline" className="h-9 gap-1.5 px-3 text-xs font-normal" title="헤더의 프로젝트 선택을 따른다">
            네임스페이스 <span className="font-mono font-semibold">{isAll ? "전체" : label}</span>
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">{items.length}개 서버</span>
        </div>
      </Card>

      {/* Notebook server table — Kubeflow Central Dashboard 스타일 */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>노트북 서버</TableHead>
              <TableHead>네임스페이스</TableHead>
              <TableHead>이미지</TableHead>
              <TableHead>컴퓨트</TableHead>
              <TableHead>가속기</TableHead>
              <TableHead>볼륨</TableHead>
              <TableHead>마지막 활동</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="w-32 text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((nb) => (
              <TableRow key={nb.id}>
                <TableCell>
                  <Link
                    href={`/ai-development/notebooks/${nb.id}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <ImageIcon image={nb.image} />
                    <div>
                      <div className="font-medium">{nb.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        kf-nb-{nb.id}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{nb.namespace}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">
                  {nb.image}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {nb.cpu} vCPU · {nb.memGb} GiB
                </TableCell>
                <TableCell>
                  {nb.acceleratorCount > 0 ? (
                    <Badge variant="success" className="gap-1">
                      <Cpu className="size-3" />
                      {nb.acceleratorKind} × {nb.acceleratorCount}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {nb.storageGb} GiB
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {relativeTime(nb.lastActivity)}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={nb.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {nb.status === "Running" ? (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/ai-development/notebooks/${nb.id}`}>
                            상세
                          </Link>
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/notebooks/${nb.id}/ide`}>
                            연결 <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      </>
                    ) : nb.status === "Stopped" ? (
                      <Button size="sm" variant="outline" onClick={() => toast.success("노트북 서버 시작을 요청했다")}>
                        <Play className="size-3" /> 시작
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        준비 중…
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Square className="size-4" /> 정지
                        </DropdownMenuItem>
                        <DropdownMenuItem>볼륨 스냅샷</DropdownMenuItem>
                        <DropdownMenuItem>리소스 변경</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600">
                          <Trash2 className="size-4" /> 삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* New notebook quick start — Kubeflow image catalog 스타일 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" /> 새 노트북 서버
          </CardTitle>
          <CardDescription>
            이미지 템플릿을 선택하면 권장 컴퓨트·가속기 프리셋이 자동 적용됩니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {IMAGE_CATALOG.map((tpl) => (
              <button
                key={tpl.name}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-secondary/30",
                )}
               onClick={() => toast.success("템플릿 선택 — 새 노트북 서버 생성 시 적용된다")}>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    tpl.color,
                  )}
                >
                  <tpl.icon className="size-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold leading-tight">{tpl.name}</div>
                    {tpl.recommended && (
                      <Badge variant="success" className="text-[10px]">권장</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{tpl.description}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tpl.tags.map((t) => (
                      <Badge key={t} variant="ghost" className="font-mono text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImageIcon({ image }: { image: string }) {
  if (image.includes("vllm")) return <Container className="size-4 text-violet-600" />;
  if (image.includes("rbln")) return <Cpu className="size-4 text-brand-mint-600" />;
  if (image.includes("pim")) return <Cpu className="size-4 text-rose-600" />;
  if (image.includes("cuda")) return <Cpu className="size-4 text-brand-indigo-600" />;
  return <Code2 className="size-4 text-sky-600" />;
}

function StatusBadge({ status }: { status: KFNotebook["status"] }) {
  if (status === "Running")
    return (
      <Badge variant="success" className="gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-brand-mint-500" />
        Running
      </Badge>
    );
  if (status === "Starting")
    return (
      <Badge variant="warning" className="gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        Starting
      </Badge>
    );
  if (status === "Error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">Stopped</Badge>;
}

function StatChip({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  accent: "mint" | "amber" | "slate" | "indigo";
  hint: string;
}) {
  const map = {
    mint: "from-brand-mint-500/15 to-transparent",
    amber: "from-amber-500/15 to-transparent",
    slate: "from-slate-500/15 to-transparent",
    indigo: "from-brand-indigo-500/15 to-transparent",
  };
  return (
    <Card className={cn("relative overflow-hidden p-4")}>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", map[accent])} />
      <div className="relative">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
    </Card>
  );
}

const IMAGE_CATALOG: {
  name: string;
  description: string;
  tags: string[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  recommended?: boolean;
}[] = [
  {
    name: "Kubeflow Code Server (Python)",
    description: "VSCode 기반 클라우드 IDE — Python 3.11 + Conda + Git",
    tags: ["Python 3.11", "VSCode", "code-server"],
    icon: Code2,
    color: "bg-sky-100 text-sky-700",
    recommended: true,
  },
  {
    name: "Kubeflow Notebook (NB)",
    description: "Notebook 서버 — interactive 코드 셀·문서 작성",
    tags: ["Python 3.11", "Notebook", "interactive"],
    icon: BookOpen,
    color: "bg-brand-indigo-100 text-brand-indigo-700",
  },
  {
    name: "RBLN ATOM SDK",
    description: "Rebellions ATOM NPU 컴파일러·런타임 포함",
    tags: ["rbln-sdk 1.4.0", "PyTorch", "ATOM"],
    icon: Cpu,
    color: "bg-brand-mint-50 text-brand-mint-700",
  },
  {
    name: "RBLN REBEL Quad SDK",
    description: "Rebellions REBEL 추론 가속 워크플로우",
    tags: ["rbln-sdk 1.4.0", "vLLM", "REBEL"],
    icon: Cpu,
    color: "bg-brand-mint-50 text-brand-mint-700",
  },
  {
    name: "CUDA 12.4 Training",
    description: "NVIDIA A100 학습 — DeepSpeed·Megatron-LM 포함",
    tags: ["CUDA 12.4", "DeepSpeed", "PyTorch 2.5"],
    icon: Cpu,
    color: "bg-brand-indigo-100 text-brand-indigo-700",
  },
  {
    name: "PIM 실험 환경",
    description: "Samsung HBM-PIM SDK 베타 (GEMV 가속)",
    tags: ["pim-sdk 0.7", "beta", "GEMV"],
    icon: Cpu,
    color: "bg-rose-100 text-rose-700",
  },
];
