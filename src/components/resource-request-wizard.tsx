"use client";
import * as React from "react";
import {
  FolderKanban,
  Network,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Server,
  Wifi,
  Globe,
  Info,
  AlertTriangle,
  HardDrive,
  KeyRound,
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
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { keypairs as ALL_KEYPAIRS } from "@/mocks/fixtures";

const STEPS = [
  { key: "project", title: "프로젝트", icon: FolderKanban, desc: "OpenStack 프로젝트 선택" },
  { key: "network", title: "네트워크", icon: Network, desc: "Neutron 네트워크·Floating IP" },
  { key: "spec", title: "스펙", icon: Server, desc: "스펙 — vCPU·RAM·Disk·가속기" },
  { key: "review", title: "확인", icon: CheckCircle2, desc: "요청 검토 및 제출" },
] as const;

type StepKey = typeof STEPS[number]["key"];

// CMP 자체 DB(project_accelerator_allocations) — NodeDeviceReport 기반 할당 결과
const PROJECTS = [
  {
    id: "proj-ai-research",
    name: "ai-research",
    quota: "vCPU 256 · RAM 1024 GB · Disk 50 TB",
    accelerators: [
      { kind: "NPU", label: "Furiosa RNGD × 2", node: "compute1" },
      { kind: "NPU", label: "Rebellions ATOM × 1", node: "compute1" },
    ],
  },
  {
    id: "proj-llm-serving",
    name: "llm-serving",
    quota: "vCPU 192 · RAM 768 GB · Disk 30 TB",
    accelerators: [
      { kind: "GPU", label: "NVIDIA A100 × 1", node: "compute5" },
      { kind: "NPU", label: "Furiosa RNGD × 1", node: "compute5" },
    ],
  },
  {
    id: "proj-edge-inference",
    name: "edge-inference",
    quota: "vCPU 96 · RAM 384 GB · Disk 20 TB",
    accelerators: [
      { kind: "GPU", label: "NVIDIA L40S × 1", node: "compute6" },
    ],
  },
];

// 사용자에게 노출하는 네트워크 선택지 — 내부 OpenStack 리소스명은 숨김
// 백엔드에서 neutronNetwork 값으로 실제 Neutron 네트워크에 매핑
const USER_NETWORKS = [
  {
    id: "internal",
    label: "내부망",
    sublabel: "업무 · 개발 전용",
    description: "클러스터 내부에서만 통신하는 폐쇄망입니다. 외부 인터넷 접근이 불필요한 VM에 사용하세요.",
    neutronNetwork: "k8s-private-net",
    fipAvailable: false,
  },
  {
    id: "internet",
    label: "인터넷망",
    sublabel: "외부 서비스 전용",
    description: "라우터를 통해 외부 인터넷과 통신이 가능한 네트워크입니다. 외부 API 호출·서비스 배포 시 선택하세요.",
    neutronNetwork: "k8s-private-net + 외부 라우팅",
    fipAvailable: true,
  },
];

// Flavor extra spec에 pci_passthrough:alias 또는 Cyborg resource request가 포함됨
const FLAVORS = [
  { name: "m1.small",   vcpu: 4,  ramGb: 16,  diskGb: 100,  accel: null },
  { name: "m1.large",   vcpu: 8,  ramGb: 32,  diskGb: 200,  accel: null },
  { name: "m1.xlarge",  vcpu: 16, ramGb: 64,  diskGb: 500,  accel: null },
  { name: "m1.2xlarge", vcpu: 32, ramGb: 128, diskGb: 1000, accel: null },
  { name: "g1.a100",    vcpu: 32, ramGb: 128, diskGb: 1000, accel: { kind: "GPU", label: "NVIDIA A100 × 1" } },
  { name: "g1.l40s",    vcpu: 16, ramGb: 64,  diskGb: 500,  accel: { kind: "GPU", label: "NVIDIA L40S × 1" } },
  { name: "n1.rngd-1",  vcpu: 16, ramGb: 64,  diskGb: 500,  accel: { kind: "NPU", label: "Furiosa RNGD × 1" } },
  { name: "n1.rngd-2",  vcpu: 32, ramGb: 128, diskGb: 1000, accel: { kind: "NPU", label: "Furiosa RNGD × 2" } },
  { name: "n1.atom-1",  vcpu: 16, ramGb: 64,  diskGb: 500,  accel: { kind: "NPU", label: "Rebellions ATOM × 1" } },
];

// 루트 디스크(스펙 내장)와 별개로 붙는 추가 데이터 스토리지(GB)
const STORAGE_PRESETS = [
  { label: "없음", gb: 0 },
  { label: "512 GB", gb: 512 },
  { label: "1 TB", gb: 1024 },
  { label: "2 TB", gb: 2048 },
];

interface ResourceRequestWizardProps {
  open: boolean;
  onClose: () => void;
}

export function ResourceRequestWizard({ open, onClose }: ResourceRequestWizardProps) {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "admin";
  const myId = user?.email?.split("@")[0] ?? "";
  const createRequest = api.iaas.createRequest();

  const [step, setStep] = React.useState<StepKey>("project");
  const [vmName, setVmName] = React.useState("");
  const [project, setProject] = React.useState<string>("");
  const [network, setNetwork] = React.useState<string>("");
  const [floatingIp, setFloatingIp] = React.useState(false);
  const [flavor, setFlavor] = React.useState<string>("");
  const [extraStorage, setExtraStorage] = React.useState<number>(0); // GB, 0 = 없음
  const [customStorage, setCustomStorage] = React.useState(false); // 직접 입력 모드
  const [keypair, setKeypair] = React.useState<string>("");

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const selectedNetworkObj = USER_NETWORKS.find((n) => n.id === network);

  // 내 키페어만 (관리자는 전체) — VM 소유자와 키페어 소유자 정합
  const myKeypairs = isAdmin ? ALL_KEYPAIRS : ALL_KEYPAIRS.filter((k) => k.owner === myId);

  function handleNetworkSelect(id: string) {
    setNetwork(id);
    const net = USER_NETWORKS.find((n) => n.id === id);
    if (net && !net.fipAvailable) setFloatingIp(false);
  }

  // 프로젝트 변경 시 네트워크·FIP·스펙·키페어 초기화
  function handleProjectSelect(id: string) {
    setProject(id);
    setNetwork("");
    setFloatingIp(false);
    setFlavor("");
    setExtraStorage(0);
    setCustomStorage(false);
    setKeypair("");
  }

  const canProceed: Record<StepKey, boolean> = {
    project: !!project,
    network: !!network,
    // 공인 IP를 신청하면 SSH용 키페어 필수
    spec: !!flavor && !!vmName && (!floatingIp || !!keypair),
    review: true,
  };

  function next() {
    const nextIdx = stepIdx + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx].key);
  }
  function prev() {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1].key);
  }
  function resetForm() {
    setStep("project");
    setVmName("");
    setProject("");
    setNetwork("");
    setFloatingIp(false);
    setFlavor("");
    setExtraStorage(0);
    setCustomStorage(false);
    setKeypair("");
  }

  function submit() {
    const proj = PROJECTS.find((p) => p.id === project);
    const flv = FLAVORS.find((f) => f.name === flavor);
    if (!proj || !flv) return;
    // 사용자에겐 내부망/인터넷망으로 노출하되, 실제 기록은 프로젝트의 네트워크로 매핑
    const networkName = network === "internet" ? `${proj.name}-public` : `${proj.name}-private`;
    const accelCount = flv.accel ? Number(flv.accel.label.match(/×\s*(\d+)/)?.[1] ?? 1) : 0;
    createRequest.mutate(
      {
        type: "vm",
        requestedBy: user?.id ?? "",
        requestedByName: user?.displayName ?? "",
        projectId: proj.id,
        projectName: proj.name,
        vmName,
        flavorName: flavor,
        vcpu: flv.vcpu,
        ramGb: flv.ramGb,
        diskGb: flv.diskGb,
        storageGb: extraStorage,
        networkName,
        keypairName: keypair || undefined,
        floatingIp,
        acceleratorKind: flv.accel?.kind,
        acceleratorCount: accelCount,
      },
      {
        onSuccess: () => {
          toast.success("자원 요청이 접수되었습니다", {
            description: `${vmName} (${flavor}) · 승인 대기 중`,
          });
          onClose();
          setTimeout(resetForm, 300);
        },
        onError: () => toast.error("요청 접수에 실패했습니다. 다시 시도해주세요."),
      },
    );
  }

  const selectedFlavor = FLAVORS.find((f) => f.name === flavor);
  const selectedProject = PROJECTS.find((p) => p.id === project);

  const filteredFlavors = React.useMemo(() => {
    if (!selectedProject) return FLAVORS;
    const accelLabels = new Set(selectedProject.accelerators.map((a) => a.label));
    return FLAVORS.filter((f) => !f.accel || accelLabels.has(f.accel.label));
  }, [selectedProject]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>가상머신 신청</DialogTitle>
          <DialogDescription>
            프로젝트 · 네트워크 · 스펙을 선택하면 관리자 승인 후 가상머신이 생성됩니다.
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
                  className="flex flex-col items-center gap-1.5 cursor-pointer disabled:cursor-default"
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

          {/* ── 1. 프로젝트 ── */}
          {step === "project" && (
            <>
              <div className="text-sm font-semibold">프로젝트 선택</div>
              <p className="text-xs text-muted-foreground">접근 권한이 부여된 프로젝트 목록입니다. 가상머신을 생성할 프로젝트를 선택하세요.</p>
              <div className="grid gap-2">
                {PROJECTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectSelect(p.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                      project === p.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <FolderKanban className="size-5 text-brand-indigo-600" />
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">쿼터: {p.quota}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground/70">할당 가속기:</span>
                        {p.accelerators.map((a) => (
                          <Badge
                            key={a.label}
                            variant="ghost"
                            className={cn(
                              "h-5 px-1.5 font-mono text-[10px]",
                              a.kind === "GPU" ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800",
                            )}
                          >
                            {a.kind} · {a.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {project === p.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── 2. 네트워크 ── */}
          {step === "network" && (
            <>
              <div className="text-sm font-semibold">네트워크 유형 선택</div>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{selectedProject?.name}</span> 프로젝트의 네트워크 용도를 선택하세요. IP는 자동으로 할당됩니다.
              </p>
              <div className="grid gap-2">
                {USER_NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNetworkSelect(n.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors",
                      network === n.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <Wifi className="size-5 shrink-0 text-sky-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{n.label}</span>
                        <span className="text-xs text-muted-foreground">{n.sublabel}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                    </div>
                    {network === n.id && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
                  </button>
                ))}
              </div>

              {/* 공인 IP 옵션 — 인터넷망 선택 시만 활성 */}
              <button
                type="button"
                onClick={() => selectedNetworkObj?.fipAvailable && setFloatingIp((v) => !v)}
                disabled={!selectedNetworkObj?.fipAvailable}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                  !selectedNetworkObj?.fipAvailable && "cursor-not-allowed opacity-40",
                  floatingIp ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                )}
              >
                <Globe className="size-5 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">외부 접속용 공인 IP 발급</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    가상머신에 공인 IP를 1:1 매핑합니다. 인터넷망 선택 시에만 신청 가능합니다.
                  </p>
                </div>
                <div className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  floatingIp ? "border-primary bg-primary" : "border-muted-foreground/30",
                )}>
                  {floatingIp && <CheckCircle2 className="size-3 text-white" />}
                </div>
              </button>

              {/* SSH 접속 가이드 — 선택 상태에 따라 맥락 문구 변경 */}
              {network === "internal" && (
                <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">외부 SSH 접속 불가</span> — 내부망 가상머신은 사설 IP(10.0.0.0/16)만 부여되어 데이터센터 외부에서 패킷이 도달하지 않습니다.
                    외부에서 SSH로 직접 접속해야 한다면 <span className="font-semibold">인터넷망</span>을 선택하고 공인 IP를 발급받으세요.
                  </p>
                </div>
              )}
              {network === "internet" && floatingIp && (
                <div className="flex gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
                  <p className="text-xs text-sky-800">
                    공인 IP가 가상머신 사설 IP에 1:1 NAT로 매핑됩니다. 승인 완료 후 발급된 공인 IP로
                    <span className="font-mono mx-1">ssh -i key.pem ubuntu@{"<공인 IP>"}</span>
                    형태로 접속할 수 있습니다.
                  </p>
                </div>
              )}
              {network === "internet" && !floatingIp && (
                <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    인터넷망을 선택했지만 공인 IP를 발급하지 않으면 외부에서 직접 SSH 접속이 불가능합니다.
                    외부 접속이 필요하다면 위 <span className="font-semibold">공인 IP 발급</span> 옵션을 켜세요.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── 3. 스펙 ── */}
          {step === "spec" && (
            <>
              <div className="text-sm font-semibold">스펙 선택</div>
              <p className="text-xs text-muted-foreground">
                가상머신 이름을 입력하고 컴퓨트 스펙을 선택하세요. 스펙은 vCPU · RAM · 디스크 크기와
                가속기(GPU/NPU) 장착 여부를 함께 결정합니다.
              </p>

              <div className="flex gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
                <p className="text-xs text-sky-800 leading-relaxed">
                  <span className="font-semibold">가속기가 필요한 경우</span> — <span className="font-mono">g1.*</span> (GPU) 또는
                  <span className="font-mono mx-1">n1.*</span> (NPU) 스펙을 선택하세요. 가속기는 스펙에 내장되어 있으며
                  별도로 선택할 필요가 없습니다. 일반 CPU 작업에는 <span className="font-mono">m1.*</span> 스펙을 사용하세요.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vmname">가상머신 이름</Label>
                <Input
                  id="vmname"
                  placeholder="예: research-trainer-04"
                  value={vmName}
                  onChange={(e) => setVmName(e.target.value)}
                />
              </div>
              <div className="space-y-2 pt-2">
                <Label>스펙</Label>
                {filteredFlavors.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setFlavor(f.name)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors",
                      flavor === f.name ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                    )}
                  >
                    <Server className="size-5 text-rose-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{f.name}</span>
                        {f.accel && (
                          <Badge
                            variant="ghost"
                            className={cn(
                              "h-5 px-1.5 font-mono text-[10px]",
                              f.accel.kind === "GPU" ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800",
                            )}
                          >
                            {f.accel.kind} · {f.accel.label}
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground tabular-nums">
                        {f.vcpu} vCPU · {f.ramGb} GB RAM · {f.diskGb} GB Disk
                      </div>
                    </div>
                    {flavor === f.name && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>

              {/* 추가 스토리지 */}
              <div className="space-y-2 pt-2">
                <Label>추가 스토리지</Label>
                <p className="text-xs text-muted-foreground">
                  스펙에 포함된 디스크는 OS·시스템용입니다. 데이터셋·모델·체크포인트처럼 용량이 크고
                  영속적으로 보관할 데이터가 있으면 스토리지를 추가하세요.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {STORAGE_PRESETS.map((s) => {
                    const active = !customStorage && extraStorage === s.gb;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => { setCustomStorage(false); setExtraStorage(s.gb); }}
                        className={cn(
                          "cursor-pointer rounded-lg border p-2.5 text-center text-sm font-medium transition-colors",
                          active ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => { setCustomStorage(true); setExtraStorage(0); }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    customStorage ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                  )}
                >
                  <HardDrive className="size-5 shrink-0 text-indigo-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">직접 입력</div>
                    <p className="text-xs text-muted-foreground">필요한 용량을 GB 단위로 직접 지정합니다.</p>
                  </div>
                  {customStorage && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={extraStorage || ""}
                        onChange={(e) => setExtraStorage(Math.max(0, Number(e.target.value)))}
                        placeholder="0"
                        className="h-8 w-24 text-right"
                      />
                      <span className="text-xs text-muted-foreground">GB</span>
                    </div>
                  )}
                </button>
              </div>

              {/* SSH 키페어 */}
              <div className="space-y-2 pt-2">
                <Label>
                  SSH 키페어 {floatingIp && <span className="text-rose-500">*</span>}
                </Label>
                <p className="text-xs text-muted-foreground">
                  부팅 시 주입되어 SSH 접속에 사용됩니다. 공개키만 VM에 저장되며 개인키는 본인이 보관합니다.
                </p>
                {myKeypairs.length === 0 ? (
                  <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      등록된 키페어가 없습니다. <span className="font-semibold">키페어</span> 메뉴에서 먼저 키페어를 생성·등록한 뒤 신청하세요.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {myKeypairs.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setKeypair(k.name)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                          keypair === k.name ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                        )}
                      >
                        <KeyRound className="size-4 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm font-medium">{k.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{k.type}</div>
                        </div>
                        {keypair === k.name && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
                      </button>
                    ))}
                  </div>
                )}
                {floatingIp && !keypair && (
                  <p className="text-xs text-rose-500">
                    공인 IP로 외부 SSH 접속을 하려면 키페어 선택이 필요합니다.
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── 4. 확인 ── */}
          {step === "review" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">아래 내용을 확인하고 신청하세요.</p>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">기본 정보</div>
                <div className="divide-y divide-border">
                  <ReviewRow label="가상머신 이름" value={vmName} />
                  <ReviewRow label="프로젝트" value={selectedProject?.name} mono />
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">네트워크</div>
                <div className="divide-y divide-border">
                  <ReviewRow label="유형" value={selectedNetworkObj ? `${selectedNetworkObj.label} (${selectedNetworkObj.sublabel})` : undefined} />
                  <ReviewRow label="공인 IP" value={floatingIp ? "발급 요청" : "미신청"} accent={floatingIp ? "green" : undefined} />
                  <ReviewRow label="SSH 키페어" value={keypair || "미선택"} mono />
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">스펙</div>
                <div className="divide-y divide-border">
                  <ReviewRow label="Flavor" value={selectedFlavor?.name} mono />
                  <ReviewRow label="컴퓨트" value={selectedFlavor ? `${selectedFlavor.vcpu} vCPU · ${selectedFlavor.ramGb} GB RAM · ${selectedFlavor.diskGb} GB Disk` : undefined} mono />
                  <ReviewRow
                    label="추가 스토리지"
                    value={extraStorage > 0 ? (extraStorage >= 1024 ? `${(extraStorage / 1024).toLocaleString()} TB` : `${extraStorage.toLocaleString()} GB`) : "없음"}
                    mono
                  />
                  <ReviewRow
                    label="가속기"
                    value={selectedFlavor?.accel ? `${selectedFlavor.accel.kind} · ${selectedFlavor.accel.label}` : "없음"}
                    accent={selectedFlavor?.accel ? (selectedFlavor.accel.kind === "GPU" ? "green" : "purple") : undefined}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                {["신청 접수", "관리자 승인", "가상머신 생성", "부팅 완료"].map((s, i, arr) => (
                  <React.Fragment key={s}>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5">{s}</span>
                    {i < arr.length - 1 && <span className="text-muted-foreground/40">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between">
          <Button variant="outline" onClick={prev} disabled={stepIdx === 0}>
            <ChevronLeft className="size-3.5" /> 이전
          </Button>
          {step === "review" ? (
            <Button onClick={submit} disabled={createRequest.isPending}>
              <CheckCircle2 className="size-3.5" /> {createRequest.isPending ? "제출 중…" : "자원 요청 제출"}
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

function ReviewRow({ label, value, mono, accent }: {
  label: string;
  value?: string;
  mono?: boolean;
  accent?: "green" | "purple";
}) {
  const valueClass = cn(
    "text-right text-sm",
    mono && "font-mono",
    accent === "green" && "text-green-700 font-medium",
    accent === "purple" && "text-purple-700 font-medium",
    !value && "text-rose-500",
  );
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={valueClass}>{value || "(미선택)"}</span>
    </div>
  );
}
