"use client";
import { toast } from "sonner";
import { Key, Copy, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "@/lib/utils";
import { ChangeMark } from "@/components/change-mark";

// 개방형 인터페이스 비용 정보 제공 범위 — KETI 논의사항 ⑥ (CR-IAM-04, 협의 중)
const COST_API = [
  { method: "GET", path: "/v1/projects/{project}/cost/summary", desc: "프로젝트 기간별 총 운용비용·에너지·점유시간", scope: "cost:read", src: "운용비용 산출" },
  { method: "GET", path: "/v1/projects/{project}/workloads/{workload}/cost", desc: "워크로드 점유시간·사용량 배분 비중·작업당/토큰당 비용", scope: "cost:read", src: "점유시간·배분 비중" },
  { method: "GET", path: "/v1/projects/{project}/cost/efficiency", desc: "전성비(성능 ÷ 워크로드 전력), SLO 충족 여부", scope: "cost:read", src: "전성비 산출" },
  { method: "GET", path: "/v1/accelerators/{id}/power", desc: "가속기·VM·Pod 귀속 전력(KCloud Monitor v2 프록시)", scope: "metrics:read", src: "전력 API" },
];

const API_KEYS = [
  { id: "ak-1", name: "kfp-runner-bot", owner: "박의규", scopes: ["kubeflow:*", "paas:workloads:read"], lastUsed: "2026-05-31T13:50:00", createdAt: "2026-04-12", expiresAt: "2027-04-12" },
  { id: "ak-2", name: "ci-cd-pipeline", owner: "윤호영", scopes: ["paas:workloads:write", "iaas:images:read"], lastUsed: "2026-05-31T12:11:00", createdAt: "2025-12-04", expiresAt: "2026-12-04" },
  { id: "ak-3", name: "monitoring-exporter", owner: "system", scopes: ["metrics:read"], lastUsed: "2026-05-31T14:28:00", createdAt: "2025-11-01", expiresAt: "—" },
  { id: "ak-4", name: "data-loader-job", owner: "최현화", scopes: ["iaas:volumes:read", "storage:objects:write"], lastUsed: "2026-05-30T22:14:00", createdAt: "2026-03-22", expiresAt: "2026-09-22" },
];

export default function ApiKeysPage() {
  return (
    <div className="space-y-4">
    <ChangeMark ids={["CR-IAM-04"]}>
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">개방형 인터페이스 — 비용 정보 리소스 (초안)</div>
          <div className="text-xs text-muted-foreground">비용 최적 스케줄러가 산출한 운용비용·점유시간·전성비를 읽기 전용으로 제공한다. 제공 범위는 확정 전 초안이다.</div>
        </div>
        <Badge variant="warning" className="text-[10px]">초안</Badge>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[11px] text-muted-foreground">
            <tr><th className="py-1.5 pr-3 font-medium">메서드</th><th className="py-1.5 pr-3 font-medium">경로</th><th className="py-1.5 pr-3 font-medium">내용</th><th className="py-1.5 pr-3 font-medium">스코프</th><th className="py-1.5 font-medium">근거</th></tr>
          </thead>
          <tbody>
            {COST_API.map((a) => (
              <tr key={a.path} className="border-t border-border/60">
                <td className="py-1.5 pr-3 font-mono font-semibold text-brand-mint-700">{a.method}</td>
                <td className="py-1.5 pr-3 font-mono">{a.path}</td>
                <td className="py-1.5 pr-3">{a.desc}</td>
                <td className="py-1.5 pr-3"><Badge variant="ghost" className="font-mono text-[10px]">{a.scope}</Badge></td>
                <td className="py-1.5 text-muted-foreground">{a.src}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    </ChangeMark>
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>소유자</TableHead>
            <TableHead>스코프</TableHead>
            <TableHead>토큰 (마스킹)</TableHead>
            <TableHead>마지막 사용</TableHead>
            <TableHead>만료</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {API_KEYS.map((k) => (
            <TableRow key={k.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Key className="size-4 text-brand-indigo-600" />
                  <span className="font-medium">{k.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{k.owner}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <Badge key={s} variant="ghost" className="font-mono text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                okc_••••••••{k.id.slice(-4)}
              </TableCell>
              <TableCell className="text-xs">{relativeTime(k.lastUsed)}</TableCell>
              <TableCell className="text-xs">{k.expiresAt}</TableCell>
              <TableCell>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => toast.success("토큰을 복사했다")}>
                    <Copy className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => toast.success("토큰 재발급 — 기존 토큰은 24시간 후 만료")}>
                    <RefreshCw className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => toast.success("API Key 삭제 요청")}>
                    <Trash2 className="size-3.5 text-rose-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
    </div>
  );
}
