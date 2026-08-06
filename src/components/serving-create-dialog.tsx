"use client";
import * as React from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KF_BASE, KF_ENABLED } from "@/lib/kf";
import { cn } from "@/lib/utils";

interface StoredModel {
  name: string; files: number; sizeMb: number; uri: string; updatedAt: string;
}

/** 모델 형식 — KServe가 지원하는 서버 종류 */
const FORMATS = [
  { value: "sklearn", label: "scikit-learn", hint: "model.joblib / model.pkl" },
  { value: "pytorch", label: "PyTorch (TorchServe)", hint: "model-store/*.mar" },
  { value: "tensorflow", label: "TensorFlow", hint: "saved_model 폴더" },
  { value: "xgboost", label: "XGBoost", hint: "model.bst" },
  { value: "triton", label: "Triton", hint: "모델 저장소 규격" },
];

// 쿠버네티스 이름 규칙 (RFC1123) — 소문자·숫자·하이픈만
const NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function ServingCreateDialog({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState("sklearn");
  const [uri, setUri] = React.useState("");
  const [cpu, setCpu] = React.useState("1");
  const [memoryGi, setMemoryGi] = React.useState(2);
  const [gpu, setGpu] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  // 가속기 여유 — 없으면 배포는 되지만 대기 상태가 된다
  const { data: gpuInfo } = useQuery({
    queryKey: ["kf", "gpu-availability"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/resources/gpu-availability`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ total: number; used: number; available: number }>;
    },
    enabled: KF_ENABLED && open,
    refetchInterval: 10000,
    retry: false,
  });
  const freeGpu = gpuInfo?.available ?? null;

  const { data: models } = useQuery({
    queryKey: ["kf", "models"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/models`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: StoredModel[]; bucket: string }>;
    },
    enabled: KF_ENABLED && open,
    retry: false,
  });

  const nameOk = name === "" || NAME_RE.test(name);
  const canSubmit = !!name && nameOk && !!uri && !busy;

  async function submit() {
    if (!KF_ENABLED) {
      toast.info("mock 모드 — 배포는 실백엔드 연동 시 동작합니다");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${KF_BASE}/api/v1/serving`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, modelFormat: format, storageUri: uri, cpu, memoryGi, gpu,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : `${res.status}`);
      }
      toast.success(`"${name}" 배포를 시작했습니다`, {
        description: "준비되기까지 1~3분 걸립니다 (모델 내려받기 + 서버 기동)",
      });
      qc.invalidateQueries({ queryKey: ["kf", "serving"] });
      setName(""); setUri("");
      onClose();
    } catch (e) {
      toast.error(`배포 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>서비스 배포</DialogTitle>
          <DialogDescription>
            저장된 모델을 API 서버로 띄웁니다. 배포되면 다른 프로그램이
            HTTP로 호출해 예측을 받아갈 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>서비스 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="dm-classifier-v2" />
            {!nameOk && (
              <p className="text-[11px] text-rose-600">
                소문자·숫자·하이픈(-)만 쓸 수 있습니다. 밑줄(_)과 대문자는 안 됩니다.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>배포할 모델</Label>
            <Select value={uri} onValueChange={setUri}>
              <SelectTrigger>
                <SelectValue placeholder={
                  models?.items.length ? "저장소에서 고르세요" : "저장된 모델이 없습니다"
                } />
              </SelectTrigger>
              <SelectContent>
                {(models?.items ?? []).map((m) => (
                  <SelectItem key={m.uri} value={m.uri}>
                    {m.name} · {m.sizeMb}MB · {m.updatedAt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uri && (
              <p className="font-mono text-[11px] text-muted-foreground">{uri}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              학습 파이프라인이 저장한 모델이 여기에 나옵니다
              {models?.bucket ? ` (s3://${models.bucket})` : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>모델 형식</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              필요한 파일 구조: {FORMATS.find((f) => f.value === format)?.hint}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>CPU 한도</Label>
              <Input value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>메모리 (GB)</Label>
              <Input type="number" min={1} max={16} value={memoryGi}
                     onChange={(e) => setMemoryGi(Number(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>가속기 (GPU)</Label>
              <Select value={String(gpu)} onValueChange={(v) => setGpu(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">사용 안 함</SelectItem>
                  <SelectItem value="1">1장</SelectItem>
                  <SelectItem value="2">2장</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {gpu > 0 && (
            <div className={cn(
              "rounded-md border p-2.5 text-[11px] leading-snug",
              freeGpu !== null && freeGpu < gpu
                ? "border-amber-200 bg-amber-50/70 text-amber-900"
                : "border-brand-mint-200 bg-brand-mint-50/70 text-brand-mint-800",
            )}>
              {freeGpu === null
                ? "가속기 여유를 확인하는 중입니다"
                : freeGpu < gpu
                  ? `지금 여유 GPU가 ${freeGpu}장뿐입니다. 배포는 등록되지만 자리가 날 때까지
                     대기 상태로 기다립니다 (실패 아님).`
                  : `여유 GPU ${freeGpu}장 — 바로 배정됩니다.`}
            </div>
          )}

          <div className="rounded-md border border-sky-200 bg-sky-50/70 p-2.5 text-[11px] leading-snug text-sky-900">
            <Badge variant="outline" className="mr-1 text-[10px]">참고</Badge>
            모델 형식과 실제 파일 구조가 맞지 않으면 배포는 되지만 상태가
            준비 완료로 바뀌지 않습니다. 그럴 땐 형식을 바꿔 다시 배포하세요.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy ? "배포 중…" : "배포"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
