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
  Boxes,
  Disc3,
  Cpu,
  BrainCircuit,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accKindClass, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useFlavors, useProjectImages, type FlavorSummary, type ProjectImage } from "@/lib/iaas-api";
import { useCreateTicket, useTicketProjects, useVmNameCheck } from "@/lib/ticket-api";
import { useSshKeys } from "@/lib/sshkey-api";
import { WorkspaceRequestForm } from "@/components/workspace-requests";

const STEPS = [
  { key: "project", title: "프로젝트", icon: FolderKanban, desc: "OpenStack 프로젝트 선택" },
  { key: "network", title: "네트워크", icon: Network, desc: "희망 망 · 공인 IP" },
  { key: "spec", title: "스펙", icon: Server, desc: "스펙 — vCPU·RAM·Disk·가속기" },
  { key: "template", title: "템플릿", icon: Disc3, desc: "OS 이미지 · 볼륨 · 키페어" },
  { key: "review", title: "확인", icon: CheckCircle2, desc: "요청 검토 및 제출" },
] as const;

type StepKey = typeof STEPS[number]["key"];

// CMP 자체 DB(project_accelerator_allocations) — NodeDeviceReport 기반 할당 결과 (서비스 클러스터 신청용)
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
    id: "external",
    label: "인터넷망",
    sublabel: "외부 서비스 전용",
    description: "라우터를 통해 외부 인터넷과 통신이 가능한 네트워크입니다. 외부 API 호출·서비스 배포 시 선택하세요.",
    neutronNetwork: "k8s-private-net + 외부 라우팅",
    fipAvailable: true,
  },
];

// 부팅 볼륨 최대 크기 (GB)
const MAX_VOLUME_GB = 500;

// 예) "GPU × 1 + NPU × 1"
function accelSummary(f: FlavorSummary) {
  return (f.accelerators ?? []).map((a) => `${a.kind} × ${a.count}`).join(" + ");
}

// VM 이름 = 서버 이름 = hostname. Nova hostname 규칙(^[a-zA-Z0-9]+[a-zA-Z0-9-]*[a-zA-Z0-9]+$, 2~63자)에서
// 영문은 소문자만 허용. 생성 시 hostname 에도 같은 값을 지정한다(microversion 2.90+).
const VM_NAME_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

interface ResourceRequestWizardProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 자원 신청 통합 모달 — '가상머신 신청'(기본) · '서비스 클러스터 신청' · 'AI 워크스페이스 신청' 탭.
 * 탭 본문은 Radix Tabs/Dialog가 비활성·닫힘 시 언마운트하므로 입력값은 그때 초기화된다.
 */
export function ResourceRequestWizard({ open, onClose }: ResourceRequestWizardProps) {
  const [tab, setTab] = React.useState("vm");

  function close() {
    onClose();
    setTab("vm"); // 다시 열면 항상 '가상머신 신청'부터
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>자원 신청</DialogTitle>
          <DialogDescription>
            신청 유형을 고른 뒤 단계를 따라 입력하세요. 관리자 승인 후 프로비저닝이 시작됩니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vm">
              <Server className="size-3.5" /> 가상머신 신청
            </TabsTrigger>
            <TabsTrigger value="cluster">
              <Boxes className="size-3.5" /> 서비스 클러스터 신청
            </TabsTrigger>
            <TabsTrigger value="ai-workspace">
              <BrainCircuit className="size-3.5" /> AI 워크스페이스 신청
            </TabsTrigger>
          </TabsList>
          <TabsContent value="vm">
            <VmRequestForm onDone={close} />
          </TabsContent>
          <TabsContent value="cluster">
            <ClusterRequestForm onDone={close} />
          </TabsContent>
          {/* AI 워크스페이스 = 프로젝트 1:1 (Kubeflow Profile) — 승인 후 관리자가 생성 시작 */}
          <TabsContent value="ai-workspace">
            <WorkspaceRequestForm onDone={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── 서비스 클러스터 신청 ──────────────────────────────────────
// 260702 회의록 2.6: 사용자는 클러스터를 직접 생성할 수 없고, VM 개수·Flavor·가속기를
// 정해 신청한다. 승인되면 Portal → Magnum → Nova VM → Neutron → K8s Cluster 순으로 생성된다.

const CLUSTER_STEPS = [
  { key: "basic", title: "기본", icon: FolderKanban, desc: "이름 · 버전 · 프로젝트" },
  { key: "nodes", title: "노드", icon: Server, desc: "Control Plane · Worker · Flavor" },
  { key: "network", title: "네트워크", icon: Network, desc: "노드 VM이 붙을 망" },
  { key: "review", title: "확인", icon: CheckCircle2, desc: "신청 검토 및 제출" },
] as const;

type ClusterStepKey = typeof CLUSTER_STEPS[number]["key"];

const K8S_VERSIONS = ["1.30", "1.31", "1.32"];

// 노드 Flavor — 가속기는 VM 쪽 FLAVORS와 동일하게 Flavor에 내장(패스스루)한다.
const K8S_FLAVORS = [
  { name: "k8s.m1.large",  vcpu: 4,  ramGb: 16,  diskGb: 100, accel: null },
  { name: "k8s.c1.xlarge", vcpu: 8,  ramGb: 32,  diskGb: 200, accel: null },
  { name: "k8s.g1.a100",   vcpu: 16, ramGb: 128, diskGb: 500, accel: { kind: "GPU", label: "NVIDIA A100 × 1" } },
  { name: "k8s.n1.rngd",   vcpu: 16, ramGb: 128, diskGb: 500, accel: { kind: "NPU", label: "Furiosa RNGD × 1" } },
];

// ── 가상머신 신청 탭 ──────────────────────────────────────────
// 탭이 바뀌거나 모달이 닫히면 언마운트되므로 입력값은 자동으로 초기화된다.
// 프로젝트 = 포털 DB(멤버십) + OpenStack 이름, 스펙·템플릿 = OpenStack 라이브, 키페어 = 포털 DB(본인 키)
// 티켓 관련 조회·제출은 목업으로 폴백하지 않는다 — 실패하면 오류를 보여준다.
function VmRequestForm({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const createTicket = useCreateTicket();
  const { data: projects = [], isLoading: projLoading, error: projError } = useTicketProjects(user?.username);
  const { data: allFlavors = [], isLoading: flavorLoading, error: flavorError } = useFlavors();

  const [step, setStep] = React.useState<StepKey>("project");
  const [vmName, setVmName] = React.useState("");
  const [project, setProject] = React.useState<string>("");
  const [network, setNetwork] = React.useState<string>("");
  const [floatingIp, setFloatingIp] = React.useState(false);
  const [flavor, setFlavor] = React.useState<string>("");
  const [image, setImage] = React.useState<string>("");
  const [volumeGb, setVolumeGb] = React.useState<number>(0);
  const [keypair, setKeypair] = React.useState<string>(""); // 키페어 이름

  // 스펙 = public 플레이버 전체 (프로젝트 가속기로 거르지 않음)
  const flavors = allFlavors.filter((f) => f.isPublic);
  // 템플릿 = 선택한 프로젝트에서 쓸 수 있는 이미지
  const { data: images = [], isLoading: imageLoading, error: imageError } = useProjectImages(project || undefined);

  // 이름 형식 검사 후 입력이 멈추면(0.4초) 중복 확인
  const [debouncedName, setDebouncedName] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedName(vmName), 400);
    return () => clearTimeout(t);
  }, [vmName]);
  const nameFormatOk = VM_NAME_RE.test(vmName);
  const nameCheckReady = nameFormatOk && debouncedName === vmName && !!project;
  const {
    data: nameCheck, isFetching: nameChecking, isError: nameCheckFailed, error: nameCheckError, refetch: recheckName,
  } = useVmNameCheck(project, debouncedName, nameCheckReady);
  const nameOk = nameCheckReady && !nameChecking && nameCheck?.available === true;

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const selectedNetworkObj = USER_NETWORKS.find((n) => n.id === network);
  const selectedProject = projects.find((p) => p.id === project);
  const selectedFlavor = flavors.find((f) => f.name === flavor);
  const selectedImage = images.find((i) => i.id === image);
  const needVolume = !!selectedFlavor && selectedFlavor.diskGb === 0;
  const minVolume = Math.max(1, selectedImage?.minVolumeGb ?? 1);

  // 키페어 — 신청자 본인 키만 (iam_ssh_key.owner = username)
  const { data: myKeypairs = [] } = useSshKeys(user?.username);

  function handleNetworkSelect(id: string) {
    setNetwork(id);
    const net = USER_NETWORKS.find((n) => n.id === id);
    if (net && !net.fipAvailable) setFloatingIp(false);
  }

  // 프로젝트 변경 시 이후 단계 입력 초기화
  function handleProjectSelect(id: string) {
    setProject(id);
    setNetwork("");
    setFloatingIp(false);
    setFlavor("");
    setImage("");
    setVolumeGb(0);
    setKeypair("");
  }

  // 부팅 볼륨 크기는 템플릿을 바꿀 때마다 그 템플릿의 최소 디스크로 맞춘다
  function handleImageSelect(img: ProjectImage) {
    setImage(img.id);
    if (!img.cloudInit) setKeypair(""); // cloud-init 없으면 키페어 주입 불가
    setVolumeGb(Math.max(1, img.minVolumeGb));
  }

  function handleFlavorSelect(f: FlavorSummary) {
    setFlavor(f.name);
    // 템플릿을 먼저 고른 뒤 디스크 없는 스펙으로 바꾼 경우에도 최소 크기로 맞춘다
    if (f.diskGb === 0 && selectedImage) setVolumeGb(Math.max(1, selectedImage.minVolumeGb));
    // 디스크가 고른 템플릿보다 작은 스펙으로 바꾸면 템플릿 선택을 비운다(부팅 볼륨 = 플레이버 디스크)
    if (f.diskGb > 0 && selectedImage && f.diskGb < selectedImage.minVolumeGb) setImage("");
  }

  const volumeValid = !needVolume || (volumeGb >= minVolume && volumeGb <= MAX_VOLUME_GB);

  const canProceed: Record<StepKey, boolean> = {
    project: !!project,
    network: !!network,
    spec: !!flavor && nameOk,
    template: !!image && volumeValid,
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
    const proj = selectedProject;
    const flv = selectedFlavor;
    const img = selectedImage;
    if (!proj || !flv || !img) return;
    // 이름·스펙·이미지 정보는 서버가 라이브 조회로 다시 확인해 저장한다 — 화면은 식별자만 보낸다
    createTicket.mutate(
      {
        projectId: proj.id,
        vmName,
        networkType: network,
        floatingIp,
        flavorId: flv.id, // Nova 생성 시 flavorRef
        imageId: img.id,
        volumeGb: needVolume ? volumeGb : undefined,
        keypairId: myKeypairs.find((k) => k.name === keypair)?.id,
      },
      {
        onSuccess: () => {
          toast.success("자원 요청이 접수되었습니다", {
            description: `${vmName} (${flv.name}) · 승인 대기 중`,
          });
          onDone();
        },
        onError: (e) => toast.error("요청 접수에 실패했습니다", { description: e.message }),
      },
    );
  }

  return (
    <>
    <Stepper steps={STEPS} currentIdx={stepIdx} onJump={(i) => setStep(STEPS[i].key)} />

    {/* Step content */}
    <div className="min-h-[340px] space-y-3 py-2">

      {/* ── 1. 프로젝트 ── */}
      {step === "project" && (
        <>
          <div className="text-sm font-semibold">프로젝트 선택</div>
          <p className="text-xs text-muted-foreground">할당된 프로젝트 목록입니다. 가상머신을 생성할 프로젝트를 선택하세요.</p>
          <div className="grid gap-2">
            {projLoading ? (
              <p className="text-xs text-muted-foreground">프로젝트를 불러오는 중…</p>
            ) : projError ? (
              <LoadError what="프로젝트" message={projError.message} />
            ) : projects.length === 0 && (
              <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">신청할 수 있는 프로젝트가 없습니다(프로젝트 owner·member만 신청 가능). 조직 관리자에게 프로젝트 할당을 요청하세요.</p>
              </div>
            )}
            {projects.map((p) => (
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
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{p.name}</span>
                    {p.orgName && <span className="text-xs text-muted-foreground">{p.orgName}</span>}
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
          <div className="text-sm font-semibold">희망 네트워크 선택</div>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{selectedProject?.name}</span> 프로젝트에서 사용할 네트워크 용도를 선택하세요. 실제 네트워크와 IP는 관리자가 승인 시 지정합니다.
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

          {/* 공인 IP 희망 — 인터넷망 선택 시만 활성 */}
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
              <div className="font-semibold text-sm">외부 접속용 공인 IP 희망</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                외부에서 접속 가능한 IP를 요청합니다. 인터넷망 선택 시에만 신청 가능하며, 할당 방식은 관리자가 결정합니다.
              </p>
            </div>
            <div className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              floatingIp ? "border-primary bg-primary" : "border-muted-foreground/30",
            )}>
              {floatingIp && <CheckCircle2 className="size-3 text-white" />}
            </div>
          </button>

          {network === "internal" && (
            <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">외부 SSH 접속 불가</span> — 내부망 가상머신은 사설 IP만 부여되어 데이터센터 외부에서 접근할 수 없습니다.
                외부 접속이 필요하다면 <span className="font-semibold">인터넷망</span>을 선택하고 공인 IP를 희망하세요.
              </p>
            </div>
          )}
          {network === "external" && !floatingIp && (
            <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                공인 IP를 희망하지 않으면 외부에서 직접 SSH 접속이 불가능할 수 있습니다.
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
            가상머신 이름을 입력하고 컴퓨트 스펙을 선택하세요. 디스크가 없는 스펙은 다음 단계에서 부팅 볼륨 크기를 지정합니다.
          </p>

          <div className="flex gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <p className="text-xs text-sky-800 leading-relaxed">
              <span className="font-semibold">가속기가 필요한 경우</span> — GPU·NPU 가속기가 표시된 스펙을 선택하세요.
              가속기는 스펙에 내장되어 있으며 별도로 선택할 필요가 없습니다.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vmname">가상머신 이름</Label>
            <Input
              id="vmname"
              placeholder="예: research-trainer-04"
              value={vmName}
              maxLength={63}
              onChange={(e) => setVmName(e.target.value.trim())}
            />
            {!vmName ? (
              <p className="text-xs text-muted-foreground">영문 소문자·숫자·하이픈(-) 2~63자, 하이픈으로 시작하거나 끝날 수 없습니다. 서버 이름과 hostname으로 함께 사용됩니다.</p>
            ) : !nameFormatOk ? (
              <p className="text-xs text-rose-500">영문 소문자·숫자·하이픈(-)만 2~63자로 입력하세요. 하이픈으로 시작하거나 끝날 수 없습니다.</p>
            ) : !nameCheckReady || nameChecking ? (
              <p className="text-xs text-muted-foreground">이름 중복 확인 중…</p>
            ) : nameCheckFailed ? (
              <p className="flex items-center gap-2 text-xs text-rose-500">
                이름 중복 확인에 실패했습니다{nameCheckError?.message ? ` (${nameCheckError.message})` : ""}.
                <button type="button" className="font-medium underline" onClick={() => recheckName()}>다시 확인</button>
              </p>
            ) : nameCheck?.available ? (
              <p className="text-xs text-brand-mint-700">사용 가능한 이름입니다.</p>
            ) : (
              <p className="text-xs text-rose-500">{nameCheck?.reason ?? "사용할 수 없는 이름입니다."}</p>
            )}
          </div>
          <div className="space-y-2 pt-2">
            <Label>스펙</Label>
            {flavorLoading && <p className="text-xs text-muted-foreground">스펙을 불러오는 중…</p>}
            {flavorError && <LoadError what="스펙" message={flavorError.message} />}
            <div className="grid gap-2 sm:grid-cols-2">
            {flavors.map((f) => (
              <button
                key={f.id}
                disabled={f.deviceProfileMissing}
                onClick={() => handleFlavorSelect(f)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors",
                  f.deviceProfileMissing && "cursor-not-allowed opacity-50",
                  flavor === f.name ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                )}
              >
                <Server className="size-5 shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono font-semibold">{f.name}</span>
                    {(f.accelerators ?? []).map((a) => (
                      <Badge key={a.kind} variant="ghost" className={cn("h-5 shrink-0 gap-1 px-1.5 font-mono text-[10px]", accKindClass(a.kind))}>
                        <Cpu className="size-3" />{a.kind} × {a.count}
                      </Badge>
                    ))}
                    {/* 종류를 모를 때(Cyborg 조회 실패·device-profile 없음) — 가속기 없음으로 보이지 않게 */}
                    {f.accelerator && !f.accelerators?.length && (
                      <Badge variant="ghost" className={cn("h-5 shrink-0 gap-1 px-1.5 font-mono text-[10px]", accKindClass(""))}><Cpu className="size-3" />가속기</Badge>
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground tabular-nums">
                    {f.vcpus} vCPU · {f.ramMb / 1024} GB RAM · {f.diskGb > 0 ? `${f.diskGb} GB Disk` : "Disk 볼륨 지정"}
                  </div>
                  {f.deviceProfileMissing && (
                    <div className="text-[11px] text-amber-700">연결된 디바이스 프로파일이 존재하지 않습니다.</div>
                  )}
                </div>
                {flavor === f.name && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
              </button>
            ))}
            </div>
          </div>
        </>
      )}

      {/* ── 4. 템플릿 ── */}
      {step === "template" && (
        <>
          <div className="text-sm font-semibold">템플릿 선택</div>
          <p className="text-xs text-muted-foreground">가상머신에 설치할 OS 이미지를 선택하세요.</p>
          {imageLoading && <p className="text-xs text-muted-foreground">템플릿을 불러오는 중…</p>}
          {imageError && <LoadError what="템플릿" message={imageError.message} />}
          {!imageLoading && !imageError && images.length === 0 && (
            <p className="text-xs text-muted-foreground">이 프로젝트에서 사용할 수 있는 템플릿이 없습니다.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {images.map((img) => {
              // 부팅 볼륨 = 플레이버 디스크 — 디스크가 템플릿 최소 크기보다 작으면 고를 수 없다(디스크 0 스펙은 볼륨 크기를 입력)
              const tooSmall = !needVolume && !!selectedFlavor && selectedFlavor.diskGb < img.minVolumeGb;
              return (
              <button
                key={img.id}
                disabled={tooSmall}
                onClick={() => handleImageSelect(img)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors",
                  tooSmall && "cursor-not-allowed opacity-50",
                  image === img.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                )}
              >
                <Disc3 className="size-5 shrink-0 text-indigo-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono font-semibold">{img.name}</span>
                    {!img.cloudInit && (
                      <Badge variant="ghost" className="h-5 bg-amber-100 px-1.5 text-[10px] text-amber-800">cloud-init 없음</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[img.os, `최소 디스크 ${img.minVolumeGb} GB`].filter(Boolean).join(" · ")}
                  </div>
                  {tooSmall && (
                    <div className="text-[11px] text-amber-700">스펙 디스크({selectedFlavor?.diskGb} GB)보다 커서 선택할 수 없습니다</div>
                  )}
                </div>
                {image === img.id && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
              </button>
              );
            })}
          </div>

          {selectedImage && !selectedImage.cloudInit && (
            <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">키페어 미적용</span> — cloud-init이 없는 이미지는 키페어가 주입되지 않습니다. 이미지의 기본 계정으로 접속하세요.
              </p>
            </div>
          )}

          {/* 부팅 볼륨 — 디스크 없는 스펙 */}
          {needVolume && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="volume">부팅 볼륨 크기</Label>
              <p className="text-xs text-muted-foreground">
                선택한 스펙(<span className="font-mono">{selectedFlavor?.name}</span>)에 디스크가 없어 부팅 볼륨을 생성합니다.
                {selectedImage ? ` ${minVolume} ~ ${MAX_VOLUME_GB} GB` : ` 최대 ${MAX_VOLUME_GB} GB`}
              </p>
              <div className="flex items-center gap-2">
                <HardDrive className="size-5 shrink-0 text-indigo-600" />
                <Input
                  id="volume"
                  type="number"
                  min={minVolume}
                  max={MAX_VOLUME_GB}
                  value={volumeGb || ""}
                  onChange={(e) => setVolumeGb(Math.max(0, Number(e.target.value)))}
                  placeholder={String(minVolume)}
                  className="h-9 w-32 text-right"
                />
                <span className="text-xs text-muted-foreground">GB</span>
              </div>
              {volumeGb > 0 && !volumeValid && (
                <p className="text-xs text-rose-500">
                  {volumeGb > MAX_VOLUME_GB ? `최대 ${MAX_VOLUME_GB} GB까지 신청할 수 있습니다.` : `이미지 최소 디스크(${minVolume} GB) 이상이어야 합니다.`}
                </p>
              )}
            </div>
          )}

          {/* SSH 키페어 (선택) */}
          <div className="space-y-2 pt-2">
            <Label>SSH 키페어 <span className="text-muted-foreground">(선택)</span></Label>
            <p className="text-xs text-muted-foreground">
              부팅 시 공개키가 주입되어 SSH 접속에 사용됩니다. 개인키는 키페어 생성 시 내려받은 파일을 사용하세요.
            </p>
            {myKeypairs.length === 0 ? (
              <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  등록된 키페어가 없습니다. <span className="font-semibold">키페어</span> 메뉴에서 생성할 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {myKeypairs.map((k) => {
                  const disabled = !!selectedImage && !selectedImage.cloudInit;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setKeypair((cur) => (cur === k.name ? "" : k.name))}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                        disabled && "cursor-not-allowed opacity-40",
                        keypair === k.name ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                      )}
                    >
                      <KeyRound className="size-4 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-sm font-medium">{k.name}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">{k.fingerprint}</div>
                      </div>
                      {keypair === k.name && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 5. 확인 ── */}
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
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">네트워크 (희망)</div>
            <div className="divide-y divide-border">
              <ReviewRow label="유형" value={selectedNetworkObj ? `${selectedNetworkObj.label} (${selectedNetworkObj.sublabel})` : undefined} />
              <ReviewRow label="공인 IP" value={floatingIp ? "희망" : "미희망"} accent={floatingIp ? "green" : undefined} />
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">스펙 · 템플릿</div>
            <div className="divide-y divide-border">
              <ReviewRow label="Flavor" value={selectedFlavor?.name} mono />
              <ReviewRow label="컴퓨트" value={selectedFlavor ? `${selectedFlavor.vcpus} vCPU · ${selectedFlavor.ramMb / 1024} GB RAM` : undefined} mono />
              <ReviewRow
                label="디스크"
                value={selectedFlavor ? (needVolume ? `부팅 볼륨 ${volumeGb} GB` : `${selectedFlavor.diskGb} GB`) : undefined}
                mono
              />
              <ReviewRow
                label="가속기"
                value={selectedFlavor?.accelerator ? accelSummary(selectedFlavor) || "가속기" : "없음"}
                accent={(() => { // 한 종류면 그 색(GPU 인디고·NPU 민트), 섞이거나 모르면 기본색
                  const kinds = new Set(selectedFlavor?.accelerators?.map((a) => a.kind));
                  return kinds.size !== 1 ? undefined : kinds.has("GPU") ? "indigo" : kinds.has("NPU") ? "mint" : undefined;
                })()}
              />
              <ReviewRow label="템플릿" value={selectedImage?.name} mono />
              <ReviewRow
                label="SSH 키페어"
                value={selectedImage && !selectedImage.cloudInit ? "미적용 (cloud-init 없음)" : keypair || "미선택"}
                mono
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            {["신청 접수", "관리자 승인", "가상머신 생성", "완료"].map((s, i, arr) => (
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
        <Button onClick={submit} disabled={createTicket.isPending}>
          <CheckCircle2 className="size-3.5" /> {createTicket.isPending ? "제출 중…" : "자원 요청 제출"}
        </Button>
      ) : (
        <Button onClick={next} disabled={!canProceed[step]}>
          다음 <ChevronRight className="size-3.5" />
        </Button>
      )}
    </DialogFooter>
    </>
  );
}

function LoadError({ what, message }: { what: string; message: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
      <p className="text-xs text-rose-800">{what}을(를) 불러오지 못했습니다 ({message}). 잠시 후 다시 시도하세요.</p>
    </div>
  );
}

function ReviewRow({ label, value, mono, accent }: {
  label: string;
  value?: string;
  mono?: boolean;
  accent?: "green" | "purple" | "indigo" | "mint";
}) {
  const valueClass = cn(
    "text-right text-sm",
    mono && "font-mono",
    accent === "green" && "text-green-700 font-medium",
    accent === "purple" && "text-purple-700 font-medium",
    accent === "indigo" && "text-brand-indigo-700 font-medium",
    accent === "mint" && "text-brand-mint-700 font-medium",
    !value && "text-rose-500",
  );
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={valueClass}>{value || "(미선택)"}</span>
    </div>
  );
}

// ── 서비스 클러스터 신청 탭 ───────────────────────────────────
function ClusterRequestForm({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const createRequest = api.ticket.createRequest();

  const [step, setStep] = React.useState<ClusterStepKey>("basic");
  const [clusterName, setClusterName] = React.useState("");
  const [project, setProject] = React.useState<string>("");
  const [k8sVersion, setK8sVersion] = React.useState("1.31");
  const [masters, setMasters] = React.useState(1);
  const [workers, setWorkers] = React.useState(3);
  const [flavor, setFlavor] = React.useState<string>("");
  const [network, setNetwork] = React.useState<string>("");

  const stepIdx = CLUSTER_STEPS.findIndex((s) => s.key === step);
  const selectedProject = PROJECTS.find((p) => p.id === project);
  const selectedFlavor = K8S_FLAVORS.find((f) => f.name === flavor);
  const selectedNetworkObj = USER_NETWORKS.find((n) => n.id === network);

  // 프로젝트에 할당된 가속기가 없으면 가속기 Flavor는 고르지 못한다 (VM 탭과 같은 규칙)
  const availableFlavors = React.useMemo(() => {
    if (!selectedProject) return K8S_FLAVORS;
    const accelLabels = new Set(selectedProject.accelerators.map((a) => a.label));
    return K8S_FLAVORS.filter((f) => !f.accel || accelLabels.has(f.accel.label));
  }, [selectedProject]);

  function handleProjectSelect(id: string) {
    setProject(id);
    setFlavor("");
    setNetwork("");
  }

  const canProceed: Record<ClusterStepKey, boolean> = {
    basic: !!clusterName.trim() && !!project,
    nodes: !!flavor && workers >= 1,
    network: !!network,
    review: true,
  };

  const totalNodes = masters + workers;
  const totalVcpu = selectedFlavor ? totalNodes * selectedFlavor.vcpu : 0;
  const totalRam = selectedFlavor ? totalNodes * selectedFlavor.ramGb : 0;
  const totalAccel = selectedFlavor?.accel ? workers : 0;

  function submit() {
    if (!selectedProject || !selectedFlavor) return;
    // 사용자에겐 내부망/인터넷망으로 노출하되, 실제 기록은 프로젝트의 네트워크로 매핑
    const networkName =
      network === "external" ? `${selectedProject.name}-public` : `${selectedProject.name}-private`;
    createRequest.mutate(
      {
        type: "cluster",
        requestedBy: user?.username ?? "",
        requestedByName: user?.displayName ?? "",
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        clusterName: clusterName.trim(),
        k8sVersion,
        masterCount: masters,
        nodeCount: workers,
        flavorName: selectedFlavor.name,
        vcpu: selectedFlavor.vcpu,
        ramGb: selectedFlavor.ramGb,
        diskGb: selectedFlavor.diskGb,
        networkName,
        acceleratorKind: selectedFlavor.accel?.kind,
        acceleratorCount: selectedFlavor.accel ? 1 : 0,
      },
      {
        onSuccess: () => {
          toast.success("서비스 클러스터 신청이 접수되었습니다", {
            description: `${clusterName} · Control Plane ${masters} + Worker ${workers} · 승인 대기 중`,
          });
          onDone();
        },
        onError: () => toast.error("요청 접수에 실패했습니다. 다시 시도해주세요."),
      },
    );
  }

  return (
    <>
    <Stepper steps={CLUSTER_STEPS} currentIdx={stepIdx} onJump={(i) => setStep(CLUSTER_STEPS[i].key)} />

    <div className="min-h-[340px] space-y-3 py-2">

      {/* ── 1. 기본 ── */}
      {step === "basic" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cluster-name">클러스터 이름</Label>
              <Input
                id="cluster-name"
                placeholder="예: svc-llm-eval"
                value={clusterName}
                onChange={(e) => setClusterName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kubernetes 버전</Label>
              <div className="flex gap-1.5">
                {K8S_VERSIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setK8sVersion(v)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors",
                      k8sVersion === v ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                    )}
                  >
                    v{v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>프로젝트</Label>
            <div className="grid gap-2">
              {PROJECTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProjectSelect(p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    project === p.id ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                  )}
                >
                  <FolderKanban className="size-4 shrink-0 text-brand-indigo-600" />
                  <div className="flex-1">
                    <div className="font-mono text-sm font-semibold">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.quota}</div>
                  </div>
                  {project === p.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              클러스터의 노드 VM·가속기는 이 프로젝트의 쿼터에서 차감됩니다.
            </p>
          </div>
        </div>
      )}

      {/* ── 2. 노드 ── */}
      {step === "nodes" && (
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <div>
              <Label>노드 개수</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <Counter label="Control Plane" value={masters} onChange={setMasters} min={1} max={3} step={2} hint="1 또는 3 (HA)" />
                <Counter label="Worker" value={workers} onChange={setWorkers} min={1} max={20} hint="1~20대" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
              <div className="mb-1 font-semibold text-foreground">합계</div>
              <div className="font-mono">
                VM {totalNodes}대 · {totalVcpu} vCPU · {totalRam} GB
                {totalAccel > 0 && ` · 가속기 ${totalAccel}장`}
              </div>
              <div className="mt-1">볼륨은 Flavor 디스크로 자동 생성됩니다.</div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>노드 Flavor</Label>
            {availableFlavors.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setFlavor(f.name)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                  flavor === f.name ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                )}
              >
                <Server className="size-4 shrink-0 text-rose-600" />
                <div className="flex-1">
                  <div className="font-mono text-sm font-semibold">{f.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {f.vcpu} vCPU · {f.ramGb} GB · {f.diskGb} GB
                    {f.accel ? ` · ${f.accel.label} 패스스루` : ""}
                  </div>
                </div>
                {flavor === f.name && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
              </button>
            ))}
            {selectedProject && availableFlavors.length < K8S_FLAVORS.length && (
              <p className="text-[11px] text-muted-foreground">
                프로젝트에 할당된 가속기가 없는 Flavor는 표시되지 않습니다.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── 3. 네트워크 ── */}
      {step === "network" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">네트워크 선택</div>
          <p className="text-xs text-muted-foreground">
            노드 VM이 연결될 망을 선택하세요. 승인 후 서브넷·보안 그룹·API 서버용 공인 IP가 자동으로 연결됩니다.
          </p>
          <div className="grid gap-2">
            {USER_NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNetwork(n.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  network === n.id ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                )}
              >
                <Network className="mt-0.5 size-4 shrink-0 text-sky-600" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {n.label} <span className="text-[11px] font-normal text-muted-foreground">{n.sublabel}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{n.description}</div>
                </div>
                {network === n.id && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. 확인 ── */}
      {step === "review" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">아래 내용을 확인하고 신청하세요.</p>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">기본 정보</div>
            <div className="divide-y divide-border">
              <ReviewRow label="클러스터 이름" value={clusterName} />
              <ReviewRow label="Kubernetes 버전" value={`v${k8sVersion}`} mono />
              <ReviewRow label="프로젝트" value={selectedProject?.name} mono />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">노드 구성</div>
            <div className="divide-y divide-border">
              <ReviewRow label="Control Plane" value={`${masters} 대`} mono />
              <ReviewRow label="Worker" value={`${workers} 대`} mono />
              <ReviewRow label="노드 Flavor" value={selectedFlavor?.name} mono />
              <ReviewRow
                label="합계"
                value={selectedFlavor ? `VM ${totalNodes}대 · ${totalVcpu} vCPU · ${totalRam} GB` : undefined}
                mono
              />
              <ReviewRow
                label="가속기"
                value={selectedFlavor?.accel ? `${selectedFlavor.accel.kind} · ${selectedFlavor.accel.label} (총 ${totalAccel}장)` : "없음"}
                accent={selectedFlavor?.accel ? (selectedFlavor.accel.kind === "GPU" ? "green" : "purple") : undefined}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">네트워크</div>
            <div className="divide-y divide-border">
              <ReviewRow label="유형" value={selectedNetworkObj ? `${selectedNetworkObj.label} (${selectedNetworkObj.sublabel})` : undefined} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            {["신청 접수", "관리자 승인", "노드 VM 생성", "클러스터 구성"].map((s, i, arr) => (
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
      <Button variant="outline" onClick={() => stepIdx > 0 && setStep(CLUSTER_STEPS[stepIdx - 1].key)} disabled={stepIdx === 0}>
        <ChevronLeft className="size-3.5" /> 이전
      </Button>
      {step === "review" ? (
        <Button onClick={submit} disabled={createRequest.isPending}>
          <CheckCircle2 className="size-3.5" /> {createRequest.isPending ? "제출 중…" : "클러스터 신청 제출"}
        </Button>
      ) : (
        <Button onClick={() => setStep(CLUSTER_STEPS[stepIdx + 1].key)} disabled={!canProceed[step]}>
          다음 <ChevronRight className="size-3.5" />
        </Button>
      )}
    </DialogFooter>
    </>
  );
}

// ── 공통 ──────────────────────────────────────────────────────

function Stepper({
  steps, currentIdx, onJump,
}: {
  steps: readonly { key: string; title: string; icon: React.ComponentType<{ className?: string }> }[];
  currentIdx: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-y border-border py-3">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <React.Fragment key={s.key}>
            <button
              onClick={() => (i <= currentIdx ? onJump(i) : undefined)}
              disabled={i > currentIdx}
              className="flex cursor-pointer flex-col items-center gap-1.5 disabled:cursor-default"
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
            {i < steps.length - 1 && (
              <div className={cn("mx-1 mt-[-12px] h-px flex-1", done ? "bg-brand-mint-500" : "bg-border")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Counter({
  label, value, onChange, min, max, step = 1, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</Button>
        <span className="w-8 text-center font-mono text-lg font-bold tabular-nums">{value}</span>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>+</Button>
      </div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
