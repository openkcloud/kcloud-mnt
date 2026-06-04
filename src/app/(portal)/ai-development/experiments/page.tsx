"use client";
import { FlaskConical, Target } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import type { KFExperiment } from "@/lib/types";

export default function ExperimentsPage() {
  const { data, isLoading } = api.kubeflow.experiments() as {
    data: { items: KFExperiment[] } | undefined;
    isLoading: boolean;
  };
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>실험</TableHead>
            <TableHead>파이프라인</TableHead>
            <TableHead>목표</TableHead>
            <TableHead>현재 최고치</TableHead>
            <TableHead>진척률</TableHead>
            <TableHead>시도</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((e) => {
            const isMax = e.objective.includes("maximize");
            const progress = isMax
              ? Math.min(100, Math.round((e.bestMetric / e.goal) * 100))
              : Math.min(100, Math.round((e.goal / e.bestMetric) * 100));
            return (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FlaskConical className="size-4 text-amber-600" />
                    <span className="font-medium">{e.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{e.pipelineId}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Target className="size-3.5 text-muted-foreground" />
                    <span className="text-xs">{e.objective}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{e.goal}</Badge>
                  </div>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{e.bestMetric}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="w-24" indicatorClassName="bg-amber-500" />
                    <span className="font-mono text-xs tabular-nums">{progress}%</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono tabular-nums">{e.trials}</TableCell>
                <TableCell>
                  <Badge
                    variant={e.status === "Succeeded" ? "success" : e.status === "Failed" ? "destructive" : "warning"}
                  >
                    {e.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
