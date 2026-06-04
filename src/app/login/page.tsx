"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, Cpu, Shield, Server } from "lucide-react";
import { useAuth, MOCK_USERS, roleLabel } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const schema = z.object({
  username: z.string().min(1, "아이디를 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [showPw, setShowPw] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "admin", password: "admin" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const user = await login(values.username, values.password);
      toast.success(`환영합니다, ${user.displayName}님`);
      router.replace("/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-indigo-900 via-brand-indigo-800 to-brand-indigo-700 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--brand-mint-400),_transparent_50%)] opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.03)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.03)_1px,_transparent_1px)] bg-[size:40px_40px]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-mint-400 to-brand-indigo-400 font-bold shadow-lg">
              K
            </div>
            <div>
              <div className="text-lg font-semibold">openKcloud</div>
              <div className="text-xs uppercase tracking-wider text-brand-mint-200">
                AI 반도체 클라우드 통합관리 플랫폼
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="text-3xl font-bold leading-tight">
              이종 AI반도체 기반
              <br />
              하이브리드 클라우드를
              <br />
              하나의 콘솔로.
            </h1>
            <p className="max-w-md text-sm text-white/70">
              GPU·NPU·PIM 자원, OpenStack IaaS, Kubernetes PaaS, 그리고 초거대 AI
              모델 서빙을 단일 플랫폼에서 통합 관리합니다.
            </p>
            <div className="grid gap-4 pt-4">
              <Feature icon={Cpu} title="이종 AI반도체 통합 관리" desc="NVIDIA·Furiosa·Rebellions·PIM" />
              <Feature icon={Server} title="IaaS + PaaS 일원화" desc="OpenStack과 Kubernetes를 한 화면에서" />
              <Feature icon={Shield} title="엔터프라이즈 IAM" desc="RBAC · OAuth 2.0 · OPA · MFA" />
            </div>
          </div>
          <div className="text-xs text-white/40">
            © 2026 오케스트로(주) · ETRI · KETI · 이노그리드 · 경희대 · KACI
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md border-border/60 shadow-xl">
          <CardContent className="space-y-6 p-8">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold">로그인</h2>
              <p className="text-sm text-muted-foreground">
                openKcloud 통합관리 콘솔에 접속합니다.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">아이디</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="admin / operator / developer"
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-xs text-red-600">
                    {errors.username.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">비밀번호</Label>
                  <a
                    href="#"
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    비밀번호 찾기
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-1 top-1"
                  >
                    {showPw ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                <LogIn className="size-4" />
                {isSubmitting ? "인증 중…" : "로그인"}
              </Button>
            </form>

            <div className="space-y-2.5 rounded-lg border border-dashed border-border bg-secondary/40 p-4">
              <div className="text-xs font-medium text-muted-foreground">
                계정 선택 (클릭하여 자동 입력)
              </div>
              <div className="grid gap-1.5">
                {Object.entries(MOCK_USERS).map(([key, { user }]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => {
                      setValue("username", key);
                      setValue("password", key);
                    }}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left text-xs hover:border-primary/40 hover:bg-secondary/60"
                  >
                    <div>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-primary">
                        {roleLabel(user.role)}
                      </div>
                      <div className="font-mono text-muted-foreground">
                        {key} / {key}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
        <Icon className="size-4 text-brand-mint-200" />
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-white/60">{desc}</div>
      </div>
    </div>
  );
}
