"use client";
import { ShieldCheck, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PERMS = [
  { label: "AI반도체 자원 조회", admin: true, user: true },
  { label: "AI반도체 자원 할당·해제", admin: true, user: true },
  { label: "VM 라이프사이클 제어", admin: true, user: true },
  { label: "VM 마이그레이션", admin: true, user: true },
  { label: "K8s 워크로드 배포", admin: true, user: true },
  { label: "K8s 클러스터 생성/삭제", admin: true, user: true },
  { label: "Kubeflow Profile 생성", admin: true, user: true },
  { label: "Notebook 생성·실행", admin: true, user: true },
  { label: "추론 서비스 게시 (KServe)", admin: true, user: true },
  { label: "테넌트 쿼터 변경", admin: true, user: true },
  { label: "사용자·역할 관리 (IAM)", admin: true, user: true },
  { label: "API Key 발급", admin: true, user: true },
  { label: "감사 로그 조회", admin: true, user: true },
  { label: "시스템 설정 변경", admin: true, user: true },
];

const ROLES = [
  { key: "admin" as const, name: "관리자", desc: "플랫폼 전체 관리·정책·사용자", color: "indigo" },
  { key: "user" as const, name: "유저", desc: "모든 자원과 기능에 대한 권한", color: "mint" },
];

export default function RolesPage() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r.key}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`size-5 ${r.color === "indigo" ? "text-brand-indigo-600" : "text-brand-mint-600"}`} />
                <span className="font-semibold">{r.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">{r.desc}</div>
              <Badge variant="outline" className="font-mono text-[10px]">role: {r.key}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>권한 매트릭스</CardTitle>
          <CardDescription>현재 관리자와 유저는 모두 동일한 권한을 가집니다. — SFR.MNT.006/016</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">권한</th>
                  {ROLES.map((r) => (
                    <th key={r.key} className="px-4 py-3 text-center font-medium">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMS.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{p.label}</td>
                    {ROLES.map((r) => (
                      <td key={r.key} className="px-4 py-2.5 text-center">
                        {p[r.key] && <Check className="mx-auto size-4 text-brand-mint-600" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
