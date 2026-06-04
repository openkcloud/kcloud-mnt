"use client";
import * as React from "react";
import {
  FolderKanban,
  Network,
  Cpu,
  HardDrive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Server,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "project", title: "프로젝트", icon: FolderKanban, desc: "OpenStack 프로젝트 선택" },
  { key: "network", title: "네트워크", icon: Network, desc: "VLAN·IP 대역" },
  { key: "spec", title: "스펙", icon: Server, desc: "Flavor (vCPU·RAM·Disk)" },
  { key: "gpu", title: "가속기", icon: Cpu, desc: "GPU/NPU 패스스루" },
  { key: "review", title: "확인", icon: CheckCircle2, desc: "요청 검토 및 제출" },
] as const;

type StepKey = typeof STEPS[number]["key"];

const PROJECTS = [
  { id: "proj-ai-research", name: "ai-research", quota: "vCPU 256 · RAM 1024GB · 가속기 8" },
  { id: "proj-llm-serving", name: "llm-serving", quota: "vCPU 192 · RAM 768GB · 가속기 6" },
  { id: "proj-edge-inference", name: "edge-inference", quota: "vCPU 96 · RAM 384GB · 가속기 4" },
];

const NETWORKS = [
  { id: "net-1", name: "DJ-Z1-Mgmt", class: "관리망", cidr: "10.10.0.0/16", vlan: 100 },
  { id: "net-2", name: "DJ-Z1-Svc", class: "서비스망", cidr: "172.16.0.0/16", vlan: 200 },
  { id: "net-3", name: "DJ-Z2-Data", class: "데이터망", cidr: "192.168.10.0/24", vlan: 300 },
];

const FLAVORS = [
  { name: "m1.large", vcpu: 8, ramGb: 32, diskGb: 200 },
  { name: "m1.xlarge", vcpu: 16, ramGb: 64, diskGb: 500 },
  { name: "g1.gpu", vcpu: 32, ramGb: 128, diskGb: 1000 },
  { name: "g1.gpu-4x", vcpu: 64, ramGb: 256, diskGb: 2000 },
  { name: "n1.npu-2", vcpu: 16, ramGb: 64, diskGb: 500 },
];

const GPU_OPTIONS = [
  { id: "none", name: "선택 안 함", kind: "—" },
  { id: "a100-1", name: "NVIDIA A100 80GB × 1", kind: "GPU" },
  { id: "a100-2", name: "NVIDIA A100 80GB × 2", kind: "GPU" },
  { id: "atom-1", name: "Rebellions ATOM × 1", kind: "NPU" },
  { id: "rngd-1", name: "Furiosa RNGD × 1", kind: "NPU" },
];

interface ResourceRequestWizardProps {
  open: boolean;
  onClose: () => void;
}

export function ResourceRequestWizard({ open, onClose }: ResourceRequestWizardProps) {
  const [step, setStep] = React.useState<StepKey>("project");
  const [vmName, setVmName] = React.useState("");
  const [project, setProject] = React.useState<string>("");
  const [network, setNetwork] = React.useState<string>("");
  const [flavor, setFlavor] = React.useState<string>("");
  const [gpu, setGpu] = React.useState<string>("");

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const canProceed: Record<StepKey, boolean> = {
    project: !!project,
    network: !!network,
    spec: !!flavor && !!vmName,
    gpu: !!gpu,
    review: true,
  };

  function next() {
    const nextIdx = stepIdx + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx].key);
  }
  function prev() {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1].key);
  }
  function submit() {
    toast.success(`자원 요청 티켓이 생성되었습니다`, {
      description: `${vmName} (${flavor}) · 승인 대기 중 · 평균 처리 시간 5~10분`,
    });
    onClose();
    setTimeout(() => {
      setStep("project");
      setVmName("");
      setProject("");
      setNetwork("");
      setFlavor("");
      setGpu("");
    }, 300);
  }

  const selectedFlavor = FLAVORS.find((f) => f.name === flavor);
  const selectedProject = PROJECTS.find((p) => p.id === project);
  const selectedNetwork = NETWORKS.find((n) => n.id === network);
  const selectedGpu = GPU_OPTIONS.find((g) => g.id === gpu);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>자원 신청 (Resource Request)</DialogTitle>
          <DialogDescription>
            NIRS RES-09 워크플로우 — 5단계로 가상서버 신청
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between border-y border-border py-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.key;
            const done = i < stepIdx;
            return (
              <React.Fragment key={s.key}>
                <button
                  onClick={() => (i <= stepIdx ? setStep(s.key) : undefined)}
                  disabled={i > stepIdx}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                      active && "bg-brand-indigo-600 text-white shadow-md",
                      done && "bg-brand-mint-500 text-white",
                      !active && !done && "bg-secondary text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <div className={cn("text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                    {s.title}
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("mx-1 mt-[-12px] h-px flex-1", done ? "bg-brand-mint-500" : "bg-border")} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[280px] space-y-3 py-2">
          {step === "project" && (
            <>
              <div className="text-sm font-semibold">프로젝트 선택</div>
              <p className="text-xs text-muted-foreground">자원이 생성될 OpenStack 프로젝트(=과금 단위)를 선택하세요.</p>
              <div className="grid gap-2">
                {PROJECTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProject(p.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                      project === p.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <FolderKanban className="size-5 text-brand-indigo-600" />
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">쿼터: {p.quota}</div>
                    </div>
                    {project === p.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "network" && (
            <>
              <div className="text-sm font-semibold">네트워크 선택</div>
              <p className="text-xs text-muted-foreground">VM이 연결될 네트워크(VLAN)를 선택하세요. IP는 자동 할당됩니다.</p>
              <div className="grid gap-2">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setNetwork(n.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                      network === n.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <Wifi className="size-5 text-sky-600" />
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{n.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {n.class} · CIDR {n.cidr} · VLAN {n.vlan}
                      </div>
                    </div>
                    {network === n.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "spec" && (
            <>
              <div className="text-sm font-semibold">VM 이름 및 Flavor 선택</div>
              <div className="grid gap-2">
                <Label htmlFor="vmname">VM 이름</Label>
                <Input
                  id="vmname"
                  placeholder="예: research-trainer-04"
                  value={vmName}
                  onChange={(e) => setVmName(e.target.value)}
                />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Flavor</Label>
                {FLAVORS.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setFlavor(f.name)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors",
                      flavor === f.name ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <Server className="size-5 text-rose-600" />
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{f.name}</div>
                      <div className="font-mono text-xs text-muted-foreground tabular-nums">
                        {f.vcpu} vCPU · {f.ramGb} GB RAM · {f.diskGb} GB Disk
                      </div>
                    </div>
                    {flavor === f.name && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "gpu" && (
            <>
              <div className="text-sm font-semibold">AI 가속기 패스스루</div>
              <p className="text-xs text-muted-foreground">VM에 PCI 패스스루로 가속기를 직접 연결합니다.</p>
              <div className="grid gap-2">
                {GPU_OPTIONS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGpu(g.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                      gpu === g.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <Cpu className="size-5 text-brand-mint-600" />
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{g.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{g.kind}</div>
                    </div>
                    {gpu === g.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <div className="text-sm font-semibold">요청 검토</div>
              <p className="text-xs text-muted-foreground">아래 내용으로 자원 요청 티켓이 생성됩니다.</p>
              <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4">
                <Row label="VM 이름" value={vmName} />
                <Row label="프로젝트" value={selectedProject?.name} />
                <Row label="네트워크" value={`${selectedNetwork?.name} (${selectedNetwork?.cidr})`} />
                <Row label="Flavor" value={`${selectedFlavor?.name} — ${selectedFlavor?.vcpu}vCPU / ${selectedFlavor?.ramGb}GB / ${selectedFlavor?.diskGb}GB`} />
                <Row label="가속기" value={selectedGpu?.name} />
                <Row label="처리 흐름" value="nTops 시스템 → 승인 → Nova create-server → 부팅 → 사용 가능" />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between">
          <Button variant="outline" onClick={prev} disabled={stepIdx === 0}>
            <ChevronLeft className="size-3.5" /> 이전
          </Button>
          {step === "review" ? (
            <Button onClick={submit}>
              <CheckCircle2 className="size-3.5" /> 자원 요청 제출
            </Button>
          ) : (
            <Button onClick={next} disabled={!canProceed[step]}>
              다음 <ChevronRight className="size-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-mono">{value || <span className="text-rose-500">(미선택)</span>}</span>
    </div>
  );
}
