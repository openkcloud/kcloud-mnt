"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loginAgain, useAuth } from "@/lib/auth";

/** 로그인이 끝났을 때(로그아웃·미사용·다른 탭·관리자 강제·다른 곳 로그인·계정 문제) — 원인 안내 + 로그인 버튼.
 *  이전 사용자의 화면 데이터가 남지 않게 조회 캐시를 비운 뒤 안내만 그린다. */
export function SessionEnded() {
  const ended = useAuth((s) => s.ended);
  const qc = useQueryClient();
  React.useEffect(() => {
    qc.clear();
  }, [qc]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardContent className="space-y-6 p-8 text-center">
          <p className="text-base font-medium">{ended?.message ?? "로그아웃 되었습니다."}</p>
          <Button className="w-full" onClick={loginAgain}>
            <LogIn className="size-4" /> 로그인
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** 로그인 확인 중 표시(가드 공통). */
export function AuthLoading({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex h-screen w-full items-center justify-center ${dark ? "bg-slate-950" : "bg-background"}`}>
      <div
        className={`size-8 animate-spin rounded-full border-2 border-t-transparent ${dark ? "border-brand-mint-500" : "border-primary"}`}
      />
    </div>
  );
}
