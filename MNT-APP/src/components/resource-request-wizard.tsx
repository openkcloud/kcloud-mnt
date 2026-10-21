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
import { useProjectFlavors, useProjectImages, type FlavorSummary, type ProjectImage } from "@/lib/iaas-api";
import { useClusterTemplates } from "@/lib/paas-api";
import {
  useClusterNameCheck, useCreateClusterTicket, useCreateTicket, useTicketProjects, useVmNameCheck,
} from "@/lib/ticket-api";
import { useSshKeys } from "@/lib/sshkey-api";
import { WorkspaceRequestForm } from "@/components/workspace-requests";
import {
  ClusterNodeConfigPanel, EMPTY_NODE_CONFIG, effectiveNodes, nodeConfigMissing, nodeTotals, nodesValid,
  type ClusterNodeConfig,
} from "@/components/cluster-node-fields";

const STEPS = [
  { key: "project", title: "프로젝트", icon: FolderKanban, desc: "OpenStack 프로젝트 선택" },
  { key: "network", title: "네트워크", icon: Network, desc: "희망 망 · 공인 IP" },
  { key: "spec", title: "스펙", icon: Server, desc: "스펙 — vCPU·RAM·Disk·가속기" },
  { key: "template", title: "템플릿", icon: Disc3, desc: "OS 이미지 · 볼륨 · 키페어" },
  { key: "review", title: "확인", icon: CheckCircle2, desc: "요청 검토 및 제출" },
] as const;

type StepKey = typeof STEPS[number]["key"];

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
      {/* 서비스 클러스터 신청은 노드 단계(왼쪽 노드 카드 + 오른쪽 스펙 표)가 넓어 모달을 넓힌다 */}
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", tab === "cluster" ? "max-w-5xl" : "max-w-3xl")}>
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
const CLUSTER_STEPS = [
  { key: "basic", title: "기본", icon: FolderKanban, desc: "프로젝트 · 이름 · 용도" },
  { key: "template", title: "템플릿", icon: Boxes, desc: "클러스터 템플릿 · K8s 버전" },
  { key: "nodes", title: "노드", icon: Server, desc: "Control Plane · 가속기 · Worker · 키페어" },
  { key: "network", title: "네트워크", icon: Network, desc: "희망 망" },
  { key: "review", title: "확인", icon: CheckCircle2, desc: "신청 검토 및 제출" },
] as const;

type ClusterStepKey = typeof CLUSTER_STEPS[number]["key"];

// 클러스터 이름 — MNT-PAAS·MNT-CORE 와 같은 규칙(영문 소문자로 시작, 소문자·숫자·하이픈, 하이픈으로 끝나지 않음, 40자 이내)
const CLUSTER_NAME_RE = /^[a-z]([a-z0-9-]{0,38}[a-z0-9])?$/;
const PURPOSE_MAX = 300;

// ── 가상머신 신청 탭 ──────────────────────────────────────────
// 탭이 바뀌거나 모달이 닫히면 언마운트되므로 입력값은 자동으로 초기화된다.
// 프로젝트 = 포털 DB(멤버십) + OpenStack 이름, 스펙·템플릿 = OpenStack 라이브, 키페어 = 포털 DB(본인 키)
// 티켓 관련 조회·제출은 목업으로 폴백하지 않는다 — 실패하면 오류를 보여준다.
function VmRequestForm({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const createTicket = useCreateTicket();
  const { data: projects = [], isLoading: projLoading, error: projError } = useTicketProjects(user?.username);

  const [step, setStep] = React.useState<StepKey>("project");
  const [vmName, setVmName] = React.useState("");
  const [project, setProject] = React.useState<string>("");
  const [network, setNetwork] = React.useState<string>("");
  const [floatingIp, setFloatingIp] = React.useState(false);
  const [flavor, setFlavor] = React.useState<string>("");
  const [image, setImage] = React.useState<string>("");
  const [volumeGb, setVolumeGb] = React.useState<number>(0);
  const [keypair, setKeypair] = React.useState<string>(""); // 키페어 이름

  // 스펙 = 선택한 프로젝트가 쓸 수 있는 플레이버(public + 이 프로젝트에 허용된 비공개)
  const { data: flavors = [], isLoading: flavorLoading, error: flavorError } = useProjectFlavors(project || undefined);
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
// 사용자는 클러스터를 직접 만들지 않고 템플릿·노드 구성(가속기 포함)·희망 망을 정해 신청한다. 승인 뒤 관리자가 실제 망·서브넷을
// 골라 프로비저닝하면 Magnum 클러스터 + 프로젝트 네임스페이스 + 접근 권한(프로젝트 멤버)이 만들어진다.
// 프로젝트·이름 확인 = 포털 DB·MNT-PAAS, 템플릿 = MNT-PAAS, 스펙 = 프로젝트 플레이버(MNT-IAAS) — 목업으로 폴백하지 않는다.
function ClusterRequestForm({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const createTicket = useCreateClusterTicket();
  const { data: projects = [], isLoading: projLoading, error: projError } = useTicketProjects(user?.username);
  const { data: allTemplates = [], isLoading: tplLoading, error: tplError } = useClusterTemplates();

  const [step, setStep] = React.useState<ClusterStepKey>("basic");
  const [project, setProject] = React.useState("");
  const [clusterName, setClusterName] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [nodeCfg, setNodeCfg] = React.useState<ClusterNodeConfig>(EMPTY_NODE_CONFIG);
  const [network, setNetwork] = React.useState("");

  const { data: flavors = [], isLoading: flavorLoading, error: flavorError } = useProjectFlavors(project || undefined);
  const { data: myKeypairs = [], isLoading: keyLoading, error: keyError } = useSshKeys(user?.username);
  const templates = allTemplates.filter((t) => t.public && !t.hidden);

  // 이름 형식 검사 후 입력이 멈추면(0.4초) 중복 확인 — 모든 프로젝트의 클러스터 + 진행 중 신청
  const [debouncedName, setDebouncedName] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedName(clusterName), 400);
    return () => clearTimeout(t);
  }, [clusterName]);
  const nameFormatOk = CLUSTER_NAME_RE.test(clusterName);
  const nameCheckReady = nameFormatOk && debouncedName === clusterName;
  const {
    data: nameCheck, isFetching: nameChecking, isError: nameCheckFailed, error: nameCheckError, refetch: recheckName,
  } = useClusterNameCheck(debouncedName, nameCheckReady);
  const nameOk = nameCheckReady && !nameChecking && nameCheck?.available === true;

  const stepIdx = CLUSTER_STEPS.findIndex((s) => s.key === step);
  const selectedProject = projects.find((p) => p.id === project);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const selectedNetworkObj = USER_NETWORKS.find((n) => n.id === network);
  // 실제로 신청할 노드 — 항목별로 템플릿 값 또는 직접 고른 값
  const nodes = effectiveNodes(flavors, nodeCfg, selectedTemplate ?? { master_flavor_id: null, flavor_id: null });
  const nodesMissing = nodeConfigMissing(nodes, nodeCfg);
  const keypairLabel = nodeCfg.source.key === "tpl"
    ? `${selectedTemplate?.keypair_id || "없음"} (템플릿)`
    : myKeypairs.find((k) => k.id === nodeCfg.keypairId)?.name;
  const masterFlavor = flavors.find((f) => f.id === nodes.masterFlavorId);
  const workerFlavor = flavors.find((f) => f.id === nodes.flavorId);
  const totals = nodeTotals(flavors, nodes);

  // 프로젝트를 바꾸면 쓸 수 있는 스펙이 달라지므로 템플릿·노드 선택을 비운다
  function handleProjectSelect(id: string) {
    setProject(id);
    setTemplateId("");
    setNodeCfg(EMPTY_NODE_CONFIG);
  }

  const canProceed: Record<ClusterStepKey, boolean> = {
    basic: !!project && nameOk && purpose.length <= PURPOSE_MAX,
    template: !!templateId,
    nodes: nodesValid(nodes) && nodesMissing.length === 0,
    network: !!network,
    review: true,
  };

  function submit() {
    if (!selectedProject || !selectedTemplate || !canProceed.nodes) return;
    // 이름·템플릿·스펙 정보는 서버가 라이브 조회로 다시 확인해 저장한다 — 화면은 식별자만 보낸다
    createTicket.mutate(
      {
        projectId: selectedProject.id,
        clusterName,
        templateId: selectedTemplate.id,
        masterCount: nodes.masterCount,
        masterFlavorId: nodes.masterFlavorId,
        nodeCount: nodes.nodeCount,
        flavorId: nodes.flavorId,
        keypairId: nodeCfg.source.key === "custom" ? nodeCfg.keypairId : undefined, // 없으면 템플릿 키페어
        networkType: network,
        purpose: purpose.trim(),
      },
      {
        onSuccess: () => {
          toast.success("서비스 클러스터 신청이 접수되었습니다", {
            description: `${clusterName} · Control Plane ${nodes.masterCount} + Worker ${nodes.nodeCount} · 승인 대기 중`,
          });
          onDone();
        },
        onError: (e) => toast.error("요청 접수에 실패했습니다", { description: e.message }),
      },
    );
  }

  return (
    <>
    <Stepper steps={CLUSTER_STEPS} currentIdx={stepIdx} onJump={(i) => setStep(CLUSTER_STEPS[i].key)} />

    <div className="min-h-[340px] space-y-3 py-2">

      {/* ── 1. 기본 — 프로젝트 · 이름 · 용도 ── */}
      {step === "basic" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>프로젝트</Label>
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
                  type="button"
                  onClick={() => handleProjectSelect(p.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                    project === p.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                  )}
                >
                  <FolderKanban className="size-4 shrink-0 text-brand-indigo-600" />
                  <div className="flex flex-1 items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{p.name}</span>
                    {p.orgName && <span className="text-xs text-muted-foreground">{p.orgName}</span>}
                  </div>
                  {project === p.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              클러스터의 노드 VM 은 이 프로젝트 쿼터에서 차감되고, 이 프로젝트 이름으로 네임스페이스가 함께 만들어집니다.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cluster-name">클러스터 이름</Label>
            <Input
              id="cluster-name"
              placeholder="예: svc-llm-eval"
              value={clusterName}
              maxLength={40}
              onChange={(e) => setClusterName(e.target.value.trim())}
            />
            {!clusterName ? (
              <p className="text-xs text-muted-foreground">영문 소문자로 시작하고 소문자·숫자·하이픈(-)만, 40자 이내. 하이픈으로 끝날 수 없습니다.</p>
            ) : !nameFormatOk ? (
              <p className="text-xs text-rose-500">영문 소문자로 시작하고 소문자·숫자·하이픈(-)만, 40자 이내로 입력하세요. 하이픈으로 끝날 수 없습니다.</p>
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

          <div className="grid gap-1.5">
            <Label htmlFor="cluster-purpose">용도 <span className="font-normal text-muted-foreground">(선택)</span></Label>
            <Input
              id="cluster-purpose"
              placeholder="예: LLM 평가 서비스 배포"
              value={purpose}
              maxLength={PURPOSE_MAX}
              onChange={(e) => setPurpose(e.target.value)}
            />
            <p className="text-right font-mono text-[10px] text-muted-foreground">{purpose.length} / {PURPOSE_MAX}</p>
          </div>
        </div>
      )}

      {/* ── 2. 템플릿 — K8s 버전은 템플릿 이미지가 정한다 ── */}
      {step === "template" && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">클러스터 템플릿</div>
          <p className="text-xs text-muted-foreground">Kubernetes 버전과 기본 노드 스펙은 템플릿이 정합니다. 노드 스펙은 다음 단계에서 바꿀 수 있습니다.</p>
          {tplLoading && <p className="text-xs text-muted-foreground">템플릿을 불러오는 중…</p>}
          {tplError && <LoadError what="클러스터 템플릿" message={tplError.message} />}
          {!tplLoading && !tplError && templates.length === 0 && (
            <p className="text-xs text-muted-foreground">신청할 수 있는 클러스터 템플릿이 없습니다. 관리자에게 문의하세요.</p>
          )}
          <div className="grid gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                  templateId === t.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                )}
              >
                <Boxes className="size-4 shrink-0 text-brand-indigo-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-semibold">{t.name}</span>
                    {t.kubeVersion && <Badge variant="secondary" className="font-mono text-[10px]">v{t.kubeVersion}</Badge>}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    Control Plane {t.master_flavor_id ?? "—"} · Worker {t.flavor_id ?? "—"}
                  </div>
                </div>
                {templateId === t.id && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. 노드 — Control Plane · Worker(가속기) · 키페어, 항목별로 직접 선택 또는 템플릿 값 ── */}
      {step === "nodes" && selectedTemplate && (
        <div className="space-y-2">
          {(flavorLoading || keyLoading) && <p className="text-xs text-muted-foreground">스펙·키페어를 불러오는 중…</p>}
          {flavorError && <LoadError what="스펙" message={flavorError.message} />}
          {keyError && <LoadError what="키페어" message={keyError.message} />}
          {!flavorLoading && !keyLoading && !flavorError && !keyError && (
            <ClusterNodeConfigPanel flavors={flavors} keypairs={myKeypairs} template={selectedTemplate} value={nodeCfg} onChange={setNodeCfg} />
          )}
        </div>
      )}

      {/* ── 4. 네트워크 — 희망 망만, 실제 망·서브넷은 관리자가 ── */}
      {step === "network" && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">희망 네트워크 선택</div>
          <p className="text-xs text-muted-foreground">
            노드 VM 이 연결될 망의 용도를 선택하세요. 실제 네트워크·서브넷은 관리자가 프로비저닝 때 지정하고,
            클러스터 API 에는 외부 접속용 공인 IP 가 자동으로 붙습니다.
          </p>
          <div className="grid gap-2">
            {USER_NETWORKS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNetwork(n.id)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                  network === n.id ? "border-primary bg-brand-indigo-50/40" : "hover:bg-secondary/40",
                )}
              >
                <Wifi className="mt-0.5 size-4 shrink-0 text-sky-600" />
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

      {/* ── 5. 확인 ── */}
      {step === "review" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">아래 내용을 확인하고 신청하세요.</p>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">기본 정보</div>
            <div className="divide-y divide-border">
              <ReviewRow label="프로젝트" value={selectedProject?.name} mono />
              <ReviewRow label="클러스터 이름" value={clusterName} mono />
              <ReviewRow label="템플릿" value={selectedTemplate?.name} mono />
              <ReviewRow label="Kubernetes 버전" value={selectedTemplate?.kubeVersion ? `v${selectedTemplate.kubeVersion}` : "—"} mono />
              <ReviewRow label="용도" value={purpose.trim() || "—"} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">노드 구성</div>
            <div className="divide-y divide-border">
              <ReviewRow label="Control Plane" value={masterFlavor ? `${nodes.masterCount} 대 · ${masterFlavor.name}` : undefined} mono />
              <ReviewRow label="Worker" value={workerFlavor ? `${nodes.nodeCount} 대 · ${workerFlavor.name}` : undefined} mono />
              <ReviewRow
                label="가속기 (Worker)"
                value={workerFlavor?.accelerators?.length ? `${accelSummary(workerFlavor)} · Worker ${nodes.nodeCount}대` : workerFlavor?.accelerator ? "가속기" : "없음"}
                accent={workerFlavor?.accelerator ? (workerFlavor.accelerators?.[0]?.kind === "GPU" ? "green" : "purple") : undefined}
              />
              <ReviewRow label="합계" value={totals ? `VM ${totals.vms}대 · ${totals.vcpu} vCPU · ${totals.ramGb} GB` : undefined} mono />
              <ReviewRow label="키페어" value={keypairLabel} mono />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="bg-secondary/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">네트워크</div>
            <div className="divide-y divide-border">
              <ReviewRow label="희망 망" value={selectedNetworkObj ? `${selectedNetworkObj.label} (${selectedNetworkObj.sublabel})` : undefined} />
              <ReviewRow label="네임스페이스" value={selectedProject ? "프로젝트 이름으로 함께 생성" : undefined} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            {["신청 접수", "관리자 승인", "노드 VM 생성", "클러스터 구성", "네임스페이스·접근 권한"].map((s, i, arr) => (
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
      {step === "nodes" && (
        <p className={cn("flex-1 self-center px-3 text-[13px]", nodesMissing.length ? "text-orange-700" : "text-brand-mint-700")}>
          {nodesMissing.length ? `선택 필요: ${nodesMissing.join(", ")}` : `노드 ${nodes.masterCount + nodes.nodeCount}대 구성 준비됨`}
        </p>
      )}
      {step === "review" ? (
        <Button onClick={submit} disabled={createTicket.isPending}>
          <CheckCircle2 className="size-3.5" /> {createTicket.isPending ? "제출 중…" : "클러스터 신청 제출"}
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
