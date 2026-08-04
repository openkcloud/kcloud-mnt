"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createNotebook, KF_API } from "@/lib/notebook-api";

/** 실제 pull 가능한 노트북 이미지 템플릿 (Kubeflow 공식 이미지) */
export const NOTEBOOK_TEMPLATES = [
  {
    key: "codeserver",
    label: "Code Server (VSCode)",
    image: "kubeflownotebookswg/codeserver-python:v1.9.2",
    hint: "VSCode 기반 클라우드 IDE — Python",
  },
  {
    key: "jupyter",
    label: "JupyterLab (SciPy)",
    image: "kubeflownotebookswg/jupyter-scipy:v1.9.2",
    hint: "Notebook 서버 — Python 3.11 + SciPy",
  },
  {
    key: "cuda",
    label: "JupyterLab PyTorch CUDA",
    image: "kubeflownotebookswg/jupyter-pytorch-cuda-full:v1.9.2",
    hint: "GPU 학습용 — PyTorch + CUDA (이미지 큼, 최초 생성 오래 걸림)",
  },
] as const;

export interface NotebookPreset {
  template: string;
  cpu?: string;
  memoryGi?: number;
  gpu?: number;
  storageGb?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  namespaces: string[];
  /** IMAGE_CATALOG 카드에서 선택한 프리셋 (템플릿 + 권장 자원) */
  preset?: NotebookPreset;
}

export function NotebookCreateDialog({ open, onOpenChange, namespaces, preset }: Props) {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [namespace, setNamespace] = React.useState(namespaces[0] ?? "ai-research");
  const [template, setTemplate] = React.useState<string>(preset?.template ?? "codeserver");
  const [cpu, setCpu] = React.useState("1");
  const [memoryGi, setMemoryGi] = React.useState("2");
  const [gpu, setGpu] = React.useState("0");
  const [storageGb, setStorageGb] = React.useState("0");

  React.useEffect(() => {
    if (!preset) return;
    setTemplate(preset.template);
    if (preset.cpu) setCpu(preset.cpu);
    if (preset.memoryGi) setMemoryGi(String(preset.memoryGi));
    if (preset.gpu !== undefined) setGpu(String(preset.gpu));
    if (preset.storageGb !== undefined) setStorageGb(String(preset.storageGb));
  }, [preset]);

  const create = useMutation({
    mutationFn: createNotebook,
    onSuccess: () => {
      toast.success(`노트북 "${name}" 생성 요청 완료 — 프로비저닝 중`);
      qc.invalidateQueries({ queryKey: ["kf", "notebooks"] });
      onOpenChange(false);
      setName("");
    },
    onError: (e: Error) => toast.error(`생성 실패: ${e.message}`),
  });

  const tpl = NOTEBOOK_TEMPLATES.find((t) => t.key === template) ?? NOTEBOOK_TEMPLATES[0];
  const valid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);

  function submit() {
    if (!KF_API) {
      toast.info("mock 모드 — NEXT_PUBLIC_KF_API 설정 시 실제 생성됩니다");
      onOpenChange(false);
      return;
    }
    create.mutate({
      name,
      namespace,
      image: tpl.image,
      cpu,
      memoryGi: Number(memoryGi),
      acceleratorKind: Number(gpu) > 0 ? "nvidia.com/gpu" : undefined,
      acceleratorCount: Number(gpu),
      storageGb: Number(storageGb),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 노트북 서버</DialogTitle>
          <DialogDescription>
            Notebook CRD가 생성되면 컨트롤러가 Pod·Service를 프로비저닝합니다
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nb-name">이름</Label>
            <Input
              id="nb-name"
              placeholder="예: my-training-nb (소문자·숫자·하이픈)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profile (네임스페이스)</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {namespaces.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>이미지 템플릿</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTEBOOK_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{tpl.hint}</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nb-cpu">vCPU</Label>
              <Input id="nb-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-mem">MEM (Gi)</Label>
              <Input id="nb-mem" value={memoryGi} onChange={(e) => setMemoryGi(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>GPU</Label>
              <Select value={gpu} onValueChange={setGpu}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">없음</SelectItem>
                  <SelectItem value="1">1장</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-vol">볼륨 (GB)</Label>
              <Input id="nb-vol" value={storageGb} onChange={(e) => setStorageGb(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? "생성 중…" : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
