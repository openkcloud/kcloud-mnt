"use client";
import * as React from "react";
import {
  Folder,
  Network,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Server,
  Wifi,
  Globe,
  AlertCircle,
  AlertTriangle,
  HardDrive,
  Boxes,
  Disc3,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PANEL } from "@/components/request-detail";
import { useAuth } from "@/lib/auth";
import { useNovaKeypairs, useProjectFlavors, useProjectImages, useProjectQuotas, type FlavorSummary, type ProjectImage } from "@/lib/iaas-api";
import { useClusterTemplates, type ClusterTemplate } from "@/lib/paas-api";
import {
  projectsLoadingText, useClusterNameCheck, useCreateClusterTicket, useCreateTicket, useTicketProjects, useVmNameCheck,
  type TicketProject,
} from "@/lib/ticket-api";
import { useSshKeys, type SshKey } from "@/lib/sshkey-api";
import { WorkspaceRequestForm } from "@/components/workspace-requests";
import {
  CLUSTER_FLOW, ClusterReview, FlowLine, USER_NETWORKS, VM_FLOW, VmReview, diskQuota, flavorAccel, imageFormat, imageLine, imageOs, nodeView,
  quotaLeft, showLeft, templateDefaultRows,
} from "@/components/request-review";
import {
  AccelTags, ClusterNodeConfigPanel, EMPTY_NODE_CONFIG, HiddenCardHint, KeypairTable, NodeCard, PICK_LINE, PickerHeader, RequiredProgress,
  SearchInput, Segment, SpecPicker, TotalAccel,
  TotalsBlock, WorkerAccel, accelChoices, accelGroup, effectiveNodes, keyIcon, keyType, nodeConfigMissing, nodesValid,
  serverIcon, useAccelModel, useHiddenBelow, workerFlavorBlock,
  type ClusterNodeConfig,
} from "@/components/cluster-node-fields";

// 단계 내용(본문) — 머리·바닥 사이 남는 높이만 쓰고 넘치면 여기만 스크롤. 좌우 4px 은 입력 포커스 테두리가 잘리지 않게
const STEP_BODY = "-mx-1 min-h-[340px] flex-1 overflow-y-auto px-1 py-2";

// 서비스 클러스터 신청과 같은 흐름 — 기본(제목·용도) → 프로젝트/템플릿 → 구성(이름·네트워크·스펙·키페어) → 신청
const STEPS = [
  { key: "basic", title: "기본" },
  { key: "source", title: "프로젝트/템플릿" },
  { key: "config", title: "가상머신 구성" },
  { key: "review", title: "가상머신 신청" },
] as const;

type StepKey = typeof STEPS[number]["key"];

// 부팅 볼륨 최대 크기 (GB)
const MAX_VOLUME_GB = 500;

// VM 이름 = 서버 이름 = hostname. Nova hostname 규칙(^[a-zA-Z0-9]+[a-zA-Z0-9-]*[a-zA-Z0-9]+$, 2~63자)에서
// 영문은 소문자만 허용. 생성 시 hostname 에도 같은 값을 지정한다(microversion 2.90+).
const VM_NAME_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

interface ResourceRequestWizardProps {
  open: boolean;
  onClose: () => void;
}

// 신청 유형 — 첫 화면의 선택 카드. 선택하면 해당 신청 흐름(단계)으로 진행한다.
const REQUEST_TYPES = [
  { key: "vm", icon: Server, title: "가상머신 신청", heading: "가상머신 자원 신청", desc: "단일 가상머신(VM)을 생성합니다." },
  { key: "cluster", icon: Boxes, title: "서비스 클러스터 신청", heading: "서비스 클러스터 자원 신청", desc: "쿠버네티스 서비스 클러스터를 생성합니다." },
  { key: "ai-workspace", icon: BrainCircuit, title: "AI 워크스페이스 신청", heading: "AI 워크스페이스 자원 신청", desc: "프로젝트 전용 AI 워크스페이스를 생성합니다." },
] as const;

type RequestTypeKey = typeof REQUEST_TYPES[number]["key"];

/**
 * 자원 신청 통합 모달 — 첫 화면에서 유형 카드(가상머신 · 서비스 클러스터 · AI 워크스페이스)를 고르고,
 * 선택한 유형의 단계로 진행한다(상단 탭 없음). 유형을 바꾸려면 '유형 다시 선택'으로 첫 화면으로.
 * 각 폼은 선택 시 마운트·뒤로가기/닫힘 시 언마운트되므로 입력값은 그때 초기화된다.
 */
export function ResourceRequestWizard({ open, onClose }: ResourceRequestWizardProps) {
  const [type, setType] = React.useState<RequestTypeKey | null>(null);
  const wide = type === "cluster" || type === "vm";

  function close() {
    onClose();
    setType(null); // 다시 열면 항상 유형 선택 화면부터
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {/* 서비스 클러스터·가상머신 신청은 구성 단계(왼쪽 카드 + 오른쪽 고르기)가 넓어 모달을 넓힌다 */}
      {/* 유형을 고르면 제목이 그 유형의 신청 이름이 되고 설명은 없다(설명 연결도 끊어 경고를 막는다) */}
      {/* 가상머신·서비스 클러스터는 세로 flex — 제목·단계 카드·이전/다음은 고정, 가운데 본문만 스크롤(창이 아주 낮으면 창이 스크롤) */}
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", wide ? "flex max-w-5xl flex-col" : "max-w-3xl")}
        {...(type ? { "aria-describedby": undefined } : {})}>
        <DialogHeader>
          <DialogTitle>{REQUEST_TYPES.find((t) => t.key === type)?.heading ?? "자원 신청"}</DialogTitle>
          {!type && <DialogDescription>신청할 자원 유형을 선택하세요.</DialogDescription>}
        </DialogHeader>

        {type === null ? (
          <div className="grid gap-3 py-2 sm:grid-cols-3">
            {REQUEST_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className="group flex cursor-pointer flex-col items-start gap-2.5 rounded-xl border border-border p-4 text-left transition-colors hover:border-brand-indigo-400 hover:bg-secondary/50"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
                  <t.icon className="size-5" />
                </div>
                <div className="font-semibold">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className={wide ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-3"}>
            <button
              type="button"
              onClick={() => setType(null)}
              className="inline-flex cursor-pointer items-center gap-1 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> 유형 다시 선택
            </button>
            {type === "vm" && <VmRequestForm onDone={close} />}
            {type === "cluster" && <ClusterRequestForm onDone={close} />}
            {/* AI 워크스페이스 = 프로젝트 1:1 (Kubeflow Profile) — 승인 후 관리자가 생성 시작 */}
            {type === "ai-workspace" && <WorkspaceRequestForm onDone={close} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── 서비스 클러스터 신청 ──────────────────────────────────────
// 가상머신 신청과 같은 흐름 — 기본(제목·용도) → 프로젝트/템플릿 → 노드 구성(이름·CP·Worker·키페어) → 신청
const CLUSTER_STEPS = [
  { key: "basic", title: "기본" },
  { key: "source", title: "프로젝트/템플릿" },
  { key: "nodes", title: "노드 구성" },
  { key: "review", title: "서비스 클러스터 신청" },
] as const;

type ClusterStepKey = typeof CLUSTER_STEPS[number]["key"];

// 클러스터 이름 — MNT-PAAS·MNT-CORE 와 같은 규칙(영문 소문자로 시작, 소문자·숫자·하이픈, 하이픈으로 끝나지 않음, 40자 이내)
const CLUSTER_NAME_RE = /^[a-z]([a-z0-9-]{0,38}[a-z0-9])?$/;
const PURPOSE_MAX = 300;
const TITLE_MAX = 60; // 신청 제목 — 목록·알림에 한 줄로

// 신청 키페어 목록 — 사용자 = 본인 SSH 키(포털 DB), 관리자 = OpenStack(Nova) 키페어(식별자가 이름이라 id 에 이름).
// 제출 때 사용자는 keypairId, 관리자는 novaKeypair 로 보낸다.
function useRequestKeypairs() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "admin";
  const mine = useSshKeys(isAdmin ? undefined : user?.username);
  const nova = useNovaKeypairs(isAdmin);
  if (!isAdmin) return { isAdmin, data: mine.data, isLoading: mine.isLoading, error: mine.error };
  const data = nova.data?.map((k): SshKey => ({
    id: k.name, name: k.name, publicKey: k.publicKey, fingerprint: k.fingerprint, createdAt: "", vmCount: 0,
  }));
  return { isAdmin, data, isLoading: nova.isLoading, error: nova.error };
}

// ── 가상머신 신청 탭 ──────────────────────────────────────────
// 탭이 바뀌거나 모달이 닫히면 언마운트되므로 입력값은 자동으로 초기화된다.
// 프로젝트 = 포털 DB(멤버십) + OpenStack 이름, 스펙·템플릿 = OpenStack 라이브, 키페어 = 포털 DB(본인 키) · 관리자는 OpenStack
// 티켓 관련 조회·제출은 목업으로 폴백하지 않는다 — 실패하면 오류를 보여준다.
function VmRequestForm({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const createTicket = useCreateTicket();
  const { data: projects = [], isLoading: projLoading, error: projError, failureCount: projFails } = useTicketProjects(user?.username);

  const [step, setStep] = React.useState<StepKey>("basic");
  const [vmName, setVmName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [role, setRole] = React.useState<"net" | "spec" | "key">("net"); // 가상머신 구성 — 오른쪽에 보일 고르기
  const [project, setProject] = React.useState<string>("");
  const [network, setNetwork] = React.useState<string>("");
  const [floatingIp, setFloatingIp] = React.useState(false);
  const [flavor, setFlavor] = React.useState<string>("");
  const [image, setImage] = React.useState<string>("");
  const [volumeGb, setVolumeGb] = React.useState<number>(0);
  const [keypair, setKeypair] = React.useState<string>(""); // 키페어 이름
  const modelOf = useAccelModel();
  const [accel, setAccel] = React.useState(""); // 스펙 표의 가속기 고르기 — "" = 가속기 없음

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

  // 키페어 — 사용자는 본인 키만(iam_ssh_key.owner = username), 관리자는 OpenStack(Nova) 키페어
  const { isAdmin, data: myKeypairs = [] } = useRequestKeypairs();

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

  // 부팅 볼륨 크기는 템플릿을 바꿀 때마다 그 템플릿의 최소 디스크로 맞춘다. 고른 스펙 디스크가 새 템플릿보다 작으면 스펙을 비운다
  function handleImageSelect(img: ProjectImage) {
    setImage(img.id);
    if (!img.cloudInit) setKeypair(""); // cloud-init 없으면 키페어 주입 불가
    setVolumeGb(Math.max(1, img.minVolumeGb));
    if (selectedFlavor && selectedFlavor.diskGb > 0 && selectedFlavor.diskGb < img.minVolumeGb) setFlavor("");
  }
  // 부팅 볼륨 = 플레이버 디스크 — 고른 템플릿의 최소 디스크보다 작은 스펙은 쓸 수 없다(디스크 0 스펙은 부팅 볼륨 크기를 입력)
  const tooSmall = (f: FlavorSummary) => selectedImage && f.diskGb > 0 && f.diskGb < selectedImage.minVolumeGb
    ? `템플릿 최소 디스크(${selectedImage.minVolumeGb} GB)보다 작은 스펙` : null;
  const noCloudInit = !!selectedImage && !selectedImage.cloudInit;
  const keyValue = noCloudInit ? "미적용 (cloud-init 없음)" : keypair || "사용 안 함";
  // 키페어 카드가 스크롤 아래로 가려지면 칸 아래에 알린다
  const { hidden: keyHidden, setRoot: setKeyRoot, setTarget: setKeyTarget, reveal: revealKey } = useHiddenBelow();

  // 가속기(종류·모델·노드당 개수 묶음) — 스펙을 고르면 그 스펙의 가속기. 바꿔서 고른 스펙과 맞지 않으면 스펙 선택을 비운다
  const sameAccel = accelGroup(accelChoices(flavors, modelOf));
  function handleAccel(dp: string) {
    setAccel(dp);
    if (selectedFlavor && workerFlavorBlock(selectedFlavor, dp, sameAccel)) setFlavor("");
  }

  function handleFlavorSelect(f: FlavorSummary) {
    setFlavor(f.name);
    setAccel(f.accelerator ?? "");
    // 디스크 없는 스펙 — 부팅 볼륨을 템플릿 최소 디스크로 맞춘다
    if (f.diskGb === 0) setVolumeGb(Math.max(1, selectedImage?.minVolumeGb ?? 1));
  }

  const volumeValid = !needVolume || (volumeGb >= minVolume && volumeGb <= MAX_VOLUME_GB);
  // 부팅 볼륨 크기(Cinder 쿼터에서 차감) — 디스크 없는 스펙은 입력한 크기
  const bootGb = needVolume ? volumeGb : selectedFlavor?.diskGb ?? 0;
  const bootLabel = needVolume ? `부팅 볼륨 ${volumeGb} GB` : `${bootGb} GB`;

  const specOk = !!selectedFlavor && volumeValid && !tooSmall(selectedFlavor);
  const canProceed: Record<StepKey, boolean> = {
    basic: !!title.trim() && purpose.length <= PURPOSE_MAX,
    source: !!project && !!image,
    config: nameOk && !!network && specOk,
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
        title: title.trim() || undefined,
        vmName,
        purpose: purpose.trim(),
        networkType: network,
        floatingIp,
        flavorId: flv.id, // Nova 생성 시 flavorRef
        imageId: img.id,
        volumeGb: needVolume ? volumeGb : undefined,
        keypairId: isAdmin ? undefined : myKeypairs.find((k) => k.name === keypair)?.id,
        novaKeypair: isAdmin && keypair ? keypair : undefined, // 관리자는 OpenStack 키페어 이름
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
    <StepCards steps={STEPS} currentIdx={stepIdx} onJump={(i) => setStep(STEPS[i].key)} summaries={[
      [title.trim(), purpose.trim()],
      [selectedProject?.name, selectedImage?.name],
      [vmName || undefined, selectedFlavor?.name],
      [],
    ]} />

    {/* 단계 내용 — 여기만 스크롤. 구성 단계는 세로 flex 로 패널이 남는 높이에 맞춰 줄어든다(최소 420px) */}
    <div className={cn(STEP_BODY, step === "config" && "flex flex-col")}>

      {/* ── 1. 기본 — 신청 제목 · 용도 ── */}
      {step === "basic" && (
        <BasicFields title={title} onTitle={setTitle} purpose={purpose} onPurpose={setPurpose}
          titlePlaceholder="예: NPU 추론 성능 검증용 가상머신" purposePlaceholder="예: 모델 학습·추론 실험" />
      )}

      {/* ── 2. 프로젝트/템플릿 — 템플릿(이미지)은 프로젝트를 고른 뒤 불러온다 ── */}
      {step === "source" && (
        <div className="space-y-6">
          <ProjectPicker projects={projects} loading={projLoading} loadingText={projectsLoadingText(projFails)} error={projError?.message}
            selected={project} onSelect={handleProjectSelect}
            hint="가상머신은 고른 프로젝트 쿼터에서 차감됩니다" />
          <div className="space-y-2.5">
            <div className="flex items-baseline gap-3">
              <span className="text-[15px] font-semibold">템플릿<span className="ml-0.5 text-[#d92d20]">*</span></span>
              <span className="text-xs text-muted-foreground">다음 단계에서는 이 이미지의 최소 디스크 이상인 스펙만 보입니다</span>
            </div>
            {!project ? <NeedProject what="템플릿" /> : (
              <>
                {imageLoading && <p className="text-xs text-muted-foreground">템플릿을 불러오는 중…</p>}
                {imageError && <LoadError what="템플릿" message={imageError.message} />}
                {!imageLoading && !imageError && images.length === 0 && (
                  <p className="text-xs text-muted-foreground">이 프로젝트에서 사용할 수 있는 템플릿이 없습니다.</p>
                )}
                {images.length > 0 && <ImagePicker images={images} selected={image} onSelect={handleImageSelect} />}
              </>
            )}
            {selectedImage && !selectedImage.cloudInit && (
              <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">키페어 미적용</span> — cloud-init이 없는 이미지는 키페어가 주입되지 않습니다. 이미지의 기본 계정으로 접속하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. 가상머신 구성 — 왼쪽 카드(네트워크·스펙·키페어) + 오른쪽 고르기. 서비스 클러스터 노드 구성과 같은 2단 ── */}
      {step === "config" && (
        // 높이 660px 에서 시작해 본문이 낮으면 최소 420px 까지 줄어든다 — 좌우 칸은 각자 스크롤
        <div className={cn(PANEL.grid, "min-h-[420px]")}>
          <div className={cn(PANEL.left, "overflow-hidden")}>
            <div ref={setKeyRoot} className={PANEL.leftScroll}>
            <RequiredProgress title="가상머신 구성" items={[nameOk, !!network, specOk]} />
            <NameCard icon={serverIcon} title="가상서버명" value={vmName} onChange={setVmName} placeholder="예: research-trainer-04" maxLength={63}
              status={nameOk ? "done" : vmName && nameFormatOk && (!nameCheckReady || nameChecking) ? undefined : "missing"}>
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
            </NameCard>
            <NodeCard className={PANEL.card} icon={<Network className="size-4 text-primary" />} title="네트워크" required
              status={network ? "done" : "missing"} placeholder="네트워크를 고르세요" value={selectedNetworkObj?.label}
              line={selectedNetworkObj
                ? `${selectedNetworkObj.sublabel}${selectedNetworkObj.fipAvailable ? (floatingIp ? " / 공인 IP 희망" : " / 공인 IP 희망 안 함") : ""}`
                : PICK_LINE}
              selected={role === "net"} onSelect={() => setRole("net")} />
            <NodeCard className={PANEL.card} icon={serverIcon} title="스펙" required
              status={specOk ? "done" : "missing"} placeholder="스펙을 고르세요" value={selectedFlavor?.name}
              line={!selectedFlavor ? PICK_LINE
                : needVolume && !volumeValid ? "부팅 볼륨 크기를 확인하세요"
                : <>{`${selectedFlavor.vcpus} vCPU / ${selectedFlavor.ramMb / 1024} GB RAM / ${needVolume ? `부팅 볼륨 ${volumeGb} GB` : `${selectedFlavor.diskGb} GB Disk`}`}
                  <WorkerAccel f={selectedFlavor} model={modelOf(selectedFlavor.accelerator)} /></>}
              selected={role === "spec"} onSelect={() => setRole("spec")} />
            <div ref={setKeyTarget} className="flex flex-none flex-col">
            <NodeCard className={PANEL.card} icon={keyIcon} title="키페어" optional
              value={keyValue} valueMuted={noCloudInit || !keypair}
              line={noCloudInit ? "이 템플릿은 키페어를 넣을 수 없습니다" : keypair ? undefined : "VM 에 SSH 키를 넣지 않습니다"}
              selected={role === "key"} onSelect={() => setRole("key")} />
            </div>
            </div>
            {keyHidden && <HiddenCardHint label="키페어 (옵션)" value={keyValue} onClick={() => { revealKey(); setRole("key"); }} />}
            <TotalsBlock rows={[
              { k: "VM", v: "1대" },
              { k: "vCPU", v: selectedFlavor && `${selectedFlavor.vcpus}` },
              { k: "RAM", v: selectedFlavor && `${selectedFlavor.ramMb / 1024} GB` },
              { k: "Disk", v: selectedFlavor && (needVolume ? `부팅 볼륨 ${volumeGb} GB` : `${selectedFlavor.diskGb} GB`) },
              { k: "가속기", v: selectedFlavor && <TotalAccel f={selectedFlavor} model={modelOf(selectedFlavor.accelerator)} n={1} /> },
            ]} />
          </div>

          {/* 오른쪽 — 넘치면 여기만 스크롤 */}
          <div className={PANEL.right}>
            {role === "net" ? (
              <>
                <PickerHeader title="네트워크" hint="희망 망 — 실제 네트워크와 IP 는 관리자가 승인 때 정합니다" />
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
                    {n.id === "external" ? <Globe className="size-5 shrink-0 text-amber-600" /> : <Wifi className="size-5 shrink-0 text-sky-600" />}
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
            ) : role === "spec" ? (
              <>
                <PickerHeader title="스펙" hint="가속기를 고르면 맞는 스펙만 보입니다" />
                {flavorLoading && <p className="text-xs text-muted-foreground">스펙을 불러오는 중…</p>}
                {flavorError && <LoadError what="스펙" message={flavorError.message} />}
                {!flavorLoading && !flavorError && (
                  <SpecPicker flavors={flavors} role="w" fixed={false} selected={selectedFlavor?.id ?? ""}
                    onSelect={(id) => { const f = flavors.find((x) => x.id === id); if (f) handleFlavorSelect(f); }}
                    accel={accel} onAccel={handleAccel} refLabel="" refId="" sortSelect groupAccel zeroDisk="Disk 볼륨 지정"
                    extraBlock={tooSmall} />
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
              </>
            ) : (
              <>
                <PickerHeader title="키페어" hint="부팅 때 공개키를 넣어 SSH 접속에 씁니다 · 다시 누르면 해제" />
                {noCloudInit ? (
                  <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">키페어 미적용</span> — cloud-init이 없는 이미지는 키페어가 주입되지 않습니다. 이미지의 기본 계정으로 접속하세요.
                    </p>
                  </div>
                ) : (
                  <KeypairTable
                    rows={myKeypairs.map((k) => ({ id: k.name, name: k.name, fingerprint: k.fingerprint, type: keyType(k.publicKey) }))}
                    selected={keypair || null} refLabel="" paged
                    onSelect={(id) => setKeypair((cur) => (cur === id ? "" : id))}
                    empty={<>등록된 키페어가 없습니다. <span className="font-semibold">키페어</span> 메뉴에서 생성할 수 있습니다.</>}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 4. 신청 — 왼쪽 카드(보기 = 상세 창, 수정 = 그 단계로) + 오른쪽 총 자원 · 프로젝트 쿼터. 신청 상세와 같은 부품(request-review) ── */}
      {step === "review" && selectedFlavor && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{REVIEW_LEAD}</p>
          <VmReview onEdit={(c) => setStep(c === "info" ? "basic" : c === "source" ? "source" : "config")} v={{
            title, purpose, projectId: project, projectName: selectedProject?.name, orgName: selectedProject?.orgName,
            imageName: selectedImage?.name, image: selectedImage, cloudInit: !noCloudInit,
            vmName, networkType: network, floatingIp,
            flavorName: selectedFlavor.name, vcpus: selectedFlavor.vcpus, ramGb: selectedFlavor.ramMb / 1024, diskGb: bootGb, diskLabel: bootLabel,
            accel: flavorAccel(selectedFlavor, modelOf), keypair: keypair || undefined,
          }} />
        </div>
      )}
    </div>

    <DialogFooter className="flex items-center sm:justify-between">
      <Button variant="outline" onClick={prev} disabled={stepIdx === 0}>
        <ChevronLeft className="size-3.5" /> 이전
      </Button>
      {step === "source" && selectedImage && (
        <span className="min-w-0 flex-1 truncate px-3 text-[13px] text-[#0f7a58]">
          {selectedImage.name} 선택됨 · 다음 단계에서 디스크 {selectedImage.minVolumeGb} GB 이상 스펙만 보입니다
        </span>
      )}
      {step === "review" && <FlowLine label="제출 후" steps={VM_FLOW} current={0} className="flex-1 justify-center self-center px-3" />}
      {step === "review" ? (
        <Button onClick={submit} disabled={createTicket.isPending}>
          <CheckCircle2 className="size-3.5" /> {createTicket.isPending ? "제출 중…" : "가상머신 신청 제출"}
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

/** 신청 프로젝트 고르기(가상머신·서비스 클러스터 공용) — 검색 + 2열 카드: 이름·조직, 남은 vCPU·RAM·Disk(프로젝트 쿼터 − 사용량).
 *  남은 vCPU 나 RAM 이 0 이면 '쿼터 부족'(주황) — 고를 수는 있다(승인 전에 쿼터를 늘릴 수 있고, 프로비저닝 때 서버가 다시 확인).
 *  가속기(NPU) 쿼터는 OpenStack 에 없어 표시하지 않는다. */
function ProjectPicker({ projects, loading, loadingText, error, selected, onSelect, hint }: {
  projects: TicketProject[]; loading: boolean; loadingText: string; error?: string; selected: string;
  onSelect: (id: string) => void; hint: string;
}) {
  const [query, setQuery] = React.useState("");
  const { data: quotas, isLoading: quotaLoading } = useProjectQuotas(projects.length > 0);
  const byId = new Map((quotas ?? []).map((t) => [t.id, t]));
  const q = query.trim().toLowerCase();
  const shown = projects.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.orgName ?? "").toLowerCase().includes(q));
  return (
    <div className="space-y-2.5">
      {/* 머리 줄도 카드와 같은 2열 — 검색칸이 오른쪽 열 너비 */}
      <div className="grid items-center gap-2.5 pr-1 sm:grid-cols-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="flex-none text-[15px] font-semibold">프로젝트<span className="ml-0.5 text-[#d92d20]">*</span></span>
          <span className="min-w-0 text-xs text-muted-foreground">{hint}</span>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="프로젝트 검색" />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{loadingText}</p>
      ) : error ? (
        <LoadError what="프로젝트" message={error} />
      ) : projects.length === 0 && (
        <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">신청할 수 있는 프로젝트가 없습니다(프로젝트 owner·member만 신청 가능). 조직 관리자에게 프로젝트 할당을 요청하세요.</p>
        </div>
      )}
      {/* 2행(카드 66.5px)까지 보이고 넘치면 스크롤 */}
      <div className="grid max-h-[143px] gap-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] sm:grid-cols-2">
        {shown.map((p) => {
          const sel = selected === p.id;
          const t = byId.get(p.id);
          const vcpu = t && quotaLeft(t.quotaVcpu, t.usedVcpu);
          const ram = t && quotaLeft(t.quotaRamGb, t.usedRamGb);
          const d = t && diskQuota(t);
          const disk = d && quotaLeft(d.limit, d.used);
          const short = !!t && ((vcpu !== null && vcpu! <= 0) || (ram !== null && ram! <= 0));
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors",
                // 테두리 색은 important — globals.css 의 레이어 밖 `* { border-color }` 가 Tailwind 유틸리티를 이긴다
                sel ? "border-primary! bg-brand-indigo-50/50" : "border-border hover:bg-secondary/40",
              )}
            >
              <Folder className="size-[18px] flex-none text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-mono text-[15px] font-semibold">{p.name}</span>
                  {p.orgName && <span className="flex-none text-xs text-muted-foreground">{p.orgName}</span>}
                </div>
                <div className={cn("mt-0.5 text-xs", short ? "text-[#e8823f]" : "text-muted-foreground")}>
                  {t ? <>남은 vCPU {showLeft(vcpu!)} / RAM {showLeft(ram!, " GB")} / Disk {showLeft(disk!, " GB")}
                    {short && <span className="ml-1.5 font-semibold">쿼터 부족</span>}</>
                    : quotaLoading ? "남은 자원 확인 중…" : null}
                </div>
              </div>
              {sel && <CheckCircle2 className="size-[18px] flex-none fill-brand-mint-500 text-white" />}
            </button>
          );
        })}
      </div>
      {projects.length > 0 && shown.length === 0 && <p className="text-center text-[13px] text-muted-foreground">조건에 맞는 프로젝트가 없습니다</p>}
    </div>
  );
}

/** 가상머신 템플릿(OS 이미지) 고르기 — 형식(QCOW2·RAW …) 필터 + 이름 검색 + 2열 카드.
 *  카드: 이름, 형식 · OS(os_distro os_version) · 최소 디스크. cloud-init 없는 이미지는 고른 뒤 아래 안내로 알린다. */
function ImagePicker({ images, selected, onSelect }: { images: ProjectImage[]; selected: string; onSelect: (img: ProjectImage) => void }) {
  const [fmt, setFmt] = React.useState("all");
  const [osSel, setOsSel] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const formats = Array.from(new Set(images.map(imageFormat)));
  const q = query.trim().toLowerCase();
  const shown = images.filter((i) => (fmt === "all" || imageFormat(i) === fmt) && (osSel === "all" || imageOs(i) === osSel)
    && (!q || i.name.toLowerCase().includes(q)));
  return (
    <>
      {/* 프로젝트와 같은 2열 — 검색칸이 오른쪽 열 너비 */}
      <div className="grid items-center gap-2.5 pr-1 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <Segment
            options={[["all", `전체 (${images.length} 개)`], ...formats.map((f) => [f, `${f} (${images.filter((i) => imageFormat(i) === f).length} 개)`] as const)]}
            value={fmt} onChange={setFmt} />
          <VersionSelect values={images.map(imageOs)} value={osSel} onChange={setOsSel} allLabel="전체 OS" unknownLabel="OS 정보 없음" />
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="이미지 이름 검색" />
      </div>
      {/* 3행(카드 68.5px)까지 보이고 넘치면 스크롤 */}
      <div className="grid max-h-[226px] gap-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] sm:grid-cols-2">
        {shown.map((img) => {
          const sel = selected === img.id;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(img)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors",
                sel ? "border-primary! bg-brand-indigo-50/50" : "border-border hover:bg-secondary/40",
              )}
            >
              <Disc3 className="size-[18px] flex-none text-primary" />
              <div className="min-w-0 flex-1">
                <div title={img.name} className="truncate font-mono text-[15px] font-semibold">{img.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{imageLine(img)}</div>
              </div>
              {sel && <CheckCircle2 className="size-[18px] flex-none fill-brand-mint-500 text-white" />}
            </button>
          );
        })}
        {shown.length === 0 && <div className="p-5 text-center text-[13px] text-muted-foreground sm:col-span-2">조건에 맞는 이미지가 없습니다</div>}
      </div>
    </>
  );
}

const ACCEL_TABS = [["all", "전체"], ["none", "가속기 없음"], ["NPU", "NPU"], ["GPU", "GPU"]] as const;
type AccelTab = typeof ACCEL_TABS[number][0];

// 버전 내림차순(1.36.2 → 1.34.8, ubuntu 22.04 → ubuntu), 정보 없음('')은 맨 뒤
function byVersionDesc(a: string, b: string) {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return b.localeCompare(a, undefined, { numeric: true });
}

/** 버전 고르기(K8s 버전 · OS) — 전체 + 값(내림차순), 정보 없음('')은 unknownLabel. */
function VersionSelect({ values, value, onChange, allLabel, unknownLabel, label = (v) => v }: {
  values: string[]; value: string; onChange: (v: string) => void; allLabel: string; unknownLabel: string; label?: (v: string) => string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2 text-[13px]">
      <option value="all">{allLabel}</option>
      {Array.from(new Set(values)).sort(byVersionDesc).map((v) => <option key={v} value={v}>{v ? label(v) : unknownLabel}</option>)}
    </select>
  );
}

/** 서비스 클러스터 템플릿 고르기 — 가속기 탭 + K8s 버전 + 이름 검색 + 2열 카드(1행 이름 — 잘리지 않게 한 줄을 다 쓴다, 2행 K8s 버전 · Worker 가속기 배지 + CP·WK 스펙).
 *  가속기 종류는 Worker 스펙을 고른 프로젝트의 스펙 목록에서 찾아 정한다 — 못 찾으면(이 프로젝트에서 쓸 수 없음) '전체'에만 보이고
 *  카드에 'Worker 스펙 확인 필요'를 붙인다.
 *  K8s 버전은 템플릿 이미지의 Glance 속성 kube_version(MNT-PAAS 가 채운다 — Magnum 템플릿 자체에는 버전 값이 없다). */
function TemplatePicker({ templates, flavors, flavorsLoading, modelOf, selected, onSelect }: {
  templates: ClusterTemplate[]; flavors: FlavorSummary[]; flavorsLoading: boolean; modelOf: (dp: string | null | undefined) => string | null;
  selected: string; onSelect: (id: string) => void;
}) {
  const [tab, setTab] = React.useState<AccelTab>("all");
  const [ver, setVer] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const workerOf = (t: ClusterTemplate) => flavors.find((f) => f.id === t.flavor_id || f.name === t.flavor_id);
  const kinds = (t: ClusterTemplate): string[] => {
    const w = workerOf(t);
    if (!w) return [];
    return w.accelerator ? (w.accelerators ?? []).map((a) => a.kind) : ["none"];
  };
  const inTab = (t: ClusterTemplate, k: AccelTab) => k === "all" || kinds(t).includes(k);
  const q = query.trim().toLowerCase();
  const shown = templates.filter((t) => inTab(t, tab) && (ver === "all" || (t.kubeVersion || "") === ver)
    && (!q || t.name.toLowerCase().includes(q)));
  return (
    <>
      <div className="grid items-center gap-2.5 pr-1 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <Segment options={ACCEL_TABS.map(([k, label]) => [k, `${label} (${templates.filter((t) => inTab(t, k)).length} 개)`] as const)}
            value={tab} onChange={setTab} />
          <VersionSelect values={templates.map((t) => t.kubeVersion || "")} value={ver} onChange={setVer} allLabel="전체 버전"
            unknownLabel="버전 정보 없음" label={(v) => `v${v}`} />
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="템플릿 이름 검색" />
      </div>
      {/* 3행(카드 72.5px — 2행 배지 높이 20px)까지 보이고 넘치면 스크롤 */}
      <div className="grid max-h-[238px] gap-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] sm:grid-cols-2">
        {shown.map((t) => {
          const sel = selected === t.id;
          const w = workerOf(t);
          // Worker 스펙을 이 프로젝트에서 못 찾음(삭제·이름 변경·접근 불가) 또는 가리키는 device-profile 이 없음 — 다음 단계에서 템플릿 값을 쓸 수 없다
          const workerCheck = !flavorsLoading && !!t.flavor_id && (!w || !!w.deviceProfileMissing);
          const line = `CP(${t.master_flavor_id ?? "—"}) / WK(${t.flavor_id ?? "—"})`;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors",
                sel ? "border-primary! bg-brand-indigo-50/50" : "border-border hover:bg-secondary/40",
              )}
            >
              <Boxes className="size-[18px] flex-none text-primary" />
              <div className="min-w-0 flex-1">
                <div title={t.name} className="truncate font-mono text-[15px] font-semibold">{t.name}</div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                  <Badge variant="ghost" className={cn("h-5 shrink-0 px-1.5 text-[10px]",
                    t.kubeVersion ? "bg-brand-indigo-100/70 font-mono text-primary" : "bg-secondary text-muted-foreground")}>
                    {t.kubeVersion ? `v${t.kubeVersion}` : "버전 정보 없음"}
                  </Badge>
                  {workerCheck ? (
                    <Badge variant="ghost" title={`Worker 스펙(${t.flavor_id})을 이 프로젝트에서 쓸 수 없습니다. 다음 단계에서 직접 고르거나 관리자에게 문의하세요`}
                      className="h-5 shrink-0 bg-amber-100 px-1.5 text-[10px] text-amber-800">Worker 스펙 확인 필요</Badge>
                  ) : w && <AccelTags f={w} model={modelOf(w.accelerator)} />}
                  <span title={line} className="min-w-0 truncate text-xs text-muted-foreground">{line}</span>
                </div>
              </div>
              {sel && <CheckCircle2 className="size-[18px] flex-none fill-brand-mint-500 text-white" />}
            </button>
          );
        })}
        {shown.length === 0 && <div className="p-5 text-center text-[13px] text-muted-foreground sm:col-span-2">조건에 맞는 템플릿이 없습니다</div>}
      </div>
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

const REVIEW_LEAD = "아래 내용을 확인하고 신청하세요. 이 내용 그대로 관리자에게 전달됩니다.";

// 클러스터와 함께 만들 프로젝트 네임스페이스 — 미리 보기. MNT-CORE _namespace_name 과 같은 규칙(실제 값은 서버가 신청 때 정해 저장)
const NS_NAME_RE = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;
function namespaceName(projectName: string, projectId: string) {
  const name = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 63).replace(/^-+|-+$/g, "");
  const ok = NS_NAME_RE.test(name) && name !== "default" && !name.startsWith("kube-");
  return ok ? name : `ws-${projectId.replace(/-/g, "").slice(0, 8).toLowerCase()}`;
}

// ── 서비스 클러스터 신청 탭 ───────────────────────────────────
// 사용자는 클러스터를 직접 만들지 않고 템플릿·노드 구성(가속기 포함)을 정해 신청한다(망은 묻지 않는다 — 내부망/인터넷망 선택은
// 헷갈릴 위험). 승인 뒤 관리자가 망·서브넷을 골라 프로비저닝하면 Magnum 클러스터 + 프로젝트 네임스페이스 + 접근 권한(프로젝트
// 멤버)이 만들어진다.
// 프로젝트·이름 확인 = 포털 DB·MNT-PAAS, 템플릿 = MNT-PAAS, 스펙 = 프로젝트 플레이버(MNT-IAAS) — 목업으로 폴백하지 않는다.
function ClusterRequestForm({ onDone }: { onDone: () => void }) {
  const user = useAuth((s) => s.user);
  const createTicket = useCreateClusterTicket();
  const { data: projects = [], isLoading: projLoading, error: projError, failureCount: projFails } = useTicketProjects(user?.username);
  const { data: allTemplates = [], isLoading: tplLoading, error: tplError } = useClusterTemplates();

  const [step, setStep] = React.useState<ClusterStepKey>("basic");
  const [project, setProject] = React.useState("");
  const [clusterName, setClusterName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [nodeCfg, setNodeCfg] = React.useState<ClusterNodeConfig>(EMPTY_NODE_CONFIG);

  const { data: flavors = [], isLoading: flavorLoading, error: flavorError } = useProjectFlavors(project || undefined);
  const { isAdmin, data: myKeypairs = [], isLoading: keyLoading, error: keyError } = useRequestKeypairs();
  // 신청할 수 있는 템플릿 — 숨김이 아니고 공개이거나 고른 프로젝트 소유(MNT-CORE 확인과 같음)
  const templates = allTemplates.filter((t) => !t.hidden && (t.public || t.project_id === project));
  const modelOf = useAccelModel();

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
  // 실제로 신청할 노드 — 항목별로 템플릿 값 또는 직접 고른 값
  const nodes = effectiveNodes(flavors, nodeCfg, selectedTemplate ?? { master_flavor_id: null, flavor_id: null });
  const nodesMissing = nodeConfigMissing(nodes);
  // 직접 고른 키 — 템플릿 값이거나 고르지 않았으면 템플릿 키페어
  const chosenKey = nodeCfg.source.key === "custom" ? nodeCfg.keypairId || undefined : undefined;
  const keyName = chosenKey ? myKeypairs.find((k) => k.id === chosenKey)?.name ?? chosenKey : selectedTemplate?.keypair_id || undefined;
  const masterFlavor = flavors.find((f) => f.id === nodes.masterFlavorId);
  const workerFlavor = flavors.find((f) => f.id === nodes.flavorId);
  // 신청 단계 — 템플릿 기본값의 노드 이미지 이름
  const { data: images = [] } = useProjectImages(step === "review" ? project : undefined);

  // 프로젝트를 바꾸면 쓸 수 있는 스펙이 달라지므로 템플릿·노드 선택을 비운다
  function handleProjectSelect(id: string) {
    setProject(id);
    setTemplateId("");
    setNodeCfg(EMPTY_NODE_CONFIG);
  }

  // 템플릿을 (새로) 고르면 노드 구성은 '템플릿 그대로 생성'(모든 항목 템플릿 값)에서 시작한다 — 같은 템플릿이면 고친 값 유지
  function handleTemplateSelect(id: string) {
    if (id === templateId) return;
    setTemplateId(id);
    setNodeCfg({ ...EMPTY_NODE_CONFIG, source: { cp: "tpl", w: "tpl", key: "tpl" } });
  }

  const canProceed: Record<ClusterStepKey, boolean> = {
    basic: !!title.trim() && purpose.length <= PURPOSE_MAX,
    source: !!project && !!templateId,
    nodes: nameOk && nodesValid(nodes) && nodesMissing.length === 0,
    review: true,
  };

  function submit() {
    if (!selectedProject || !selectedTemplate || !canProceed.nodes) return;
    // 이름·템플릿·스펙 정보는 서버가 라이브 조회로 다시 확인해 저장한다 — 화면은 식별자만 보낸다
    createTicket.mutate(
      {
        projectId: selectedProject.id,
        title: title.trim() || undefined,
        clusterName,
        templateId: selectedTemplate.id,
        masterCount: nodes.masterCount,
        masterFlavorId: nodes.masterFlavorId,
        nodeCount: nodes.nodeCount,
        flavorId: nodes.flavorId,
        // 직접 선택 — 사용자는 본인 키(id), 관리자는 OpenStack 키페어(이름). 없으면 템플릿 키페어
        keypairId: isAdmin ? undefined : chosenKey,
        novaKeypair: isAdmin ? chosenKey : undefined,
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
    <StepCards steps={CLUSTER_STEPS} currentIdx={stepIdx} onJump={(i) => setStep(CLUSTER_STEPS[i].key)} summaries={[
      [title.trim(), purpose.trim()],
      [selectedProject?.name, selectedTemplate?.name],
      [clusterName || undefined, masterFlavor && workerFlavor ? `CP × ${nodes.masterCount} / WK × ${nodes.nodeCount}` : undefined],
      [],
    ]} />

    {/* 단계 내용 — 여기만 스크롤. 노드 구성 단계는 세로 flex 로 패널이 남는 높이에 맞춰 줄어든다(최소 420px) */}
    <div className={cn(STEP_BODY, step === "nodes" && "flex flex-col")}>

      {/* ── 1. 기본 — 신청 제목 · 용도 ── */}
      {step === "basic" && (
        <BasicFields title={title} onTitle={setTitle} purpose={purpose} onPurpose={setPurpose}
          titlePlaceholder="예: LLM 평가용 클러스터 신설" purposePlaceholder="예: LLM 평가 서비스 배포" />
      )}

      {/* ── 2. 프로젝트/템플릿 — K8s 버전과 기본 노드 스펙은 템플릿이 정한다. 템플릿은 프로젝트를 고른 뒤 ── */}
      {step === "source" && (
        <div className="space-y-6">
          <ProjectPicker projects={projects} loading={projLoading} loadingText={projectsLoadingText(projFails)} error={projError?.message}
            selected={project} onSelect={handleProjectSelect}
            hint="노드 VM 은 고른 프로젝트 쿼터에서 차감됩니다." />
          <div className="space-y-2.5">
            <div className="flex items-baseline gap-3">
              <span className="text-[15px] font-semibold">템플릿<span className="ml-0.5 text-[#d92d20]">*</span></span>
              <span className="text-xs text-muted-foreground">Kubernetes 버전과 기본 노드 스펙은 템플릿이 정합니다. 노드 스펙은 다음 단계에서 바꿀 수 있습니다</span>
            </div>
            {!project ? <NeedProject what="템플릿" /> : (
              <>
                {tplLoading && <p className="text-xs text-muted-foreground">템플릿을 불러오는 중…</p>}
                {tplError && <LoadError what="클러스터 템플릿" message={tplError.message} />}
                {!tplLoading && !tplError && templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">신청할 수 있는 클러스터 템플릿이 없습니다. 관리자에게 문의하세요.</p>
                )}
                {templates.length > 0 && (
                  <TemplatePicker templates={templates} flavors={flavors} flavorsLoading={flavorLoading} modelOf={modelOf} selected={templateId} onSelect={handleTemplateSelect} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 3. 노드 — Control Plane · Worker(가속기) · 키페어, 항목별로 직접 선택 또는 템플릿 값 ── */}
      {step === "nodes" && selectedTemplate && (
        <div className="flex min-h-0 flex-col gap-2">
          {(flavorLoading || keyLoading) && <p className="text-xs text-muted-foreground">스펙·키페어를 불러오는 중…</p>}
          {flavorError && <LoadError what="스펙" message={flavorError.message} />}
          {keyError && <LoadError what="키페어" message={keyError.message} />}
          {!flavorLoading && !keyLoading && !flavorError && !keyError && (
            <ClusterNodeConfigPanel flavors={flavors} keypairs={myKeypairs} template={selectedTemplate} value={nodeCfg} onChange={setNodeCfg}
              nameOk={nameOk} nameCard={
                <NameCard icon={<Boxes className="size-4 text-primary" />} title="클러스터명" value={clusterName} onChange={setClusterName}
                  placeholder="예: svc-llm-eval" maxLength={40}
                  status={nameOk ? "done" : clusterName && nameFormatOk && (!nameCheckReady || nameChecking) ? undefined : "missing"}>
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
                </NameCard>
              } />
          )}
        </div>
      )}

      {/* ── 4. 신청 — 왼쪽 카드(보기 = 상세 창, 수정 = 그 단계로) + 오른쪽 총 자원 · 프로젝트 쿼터. 신청 상세와 같은 부품(request-review) ── */}
      {step === "review" && selectedProject && selectedTemplate && masterFlavor && workerFlavor && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{REVIEW_LEAD}</p>
          <ClusterReview onEdit={(c) => setStep(c === "info" ? "basic" : c === "cluster" ? "source" : "nodes")} c={{
            title, purpose, projectId: project, projectName: selectedProject.name,
            clusterName, templateName: selectedTemplate.name, kubeVersion: selectedTemplate.kubeVersion,
            namespace: namespaceName(selectedProject.name, selectedProject.id),
            master: nodeView(nodes.masterCount, masterFlavor), worker: nodeView(nodes.nodeCount, workerFlavor),
            workerAccel: flavorAccel(workerFlavor, modelOf), keypair: keyName, keyFromTemplate: !chosenKey && !!keyName,
            templateRows: templateDefaultRows(selectedTemplate, flavors, images, modelOf),
          }} />
        </div>
      )}
    </div>

    <DialogFooter className="flex sm:justify-between">
      <Button variant="outline" onClick={() => stepIdx > 0 && setStep(CLUSTER_STEPS[stepIdx - 1].key)} disabled={stepIdx === 0}>
        <ChevronLeft className="size-3.5" /> 이전
      </Button>
      {step === "review" && <FlowLine label="제출 후" steps={CLUSTER_FLOW} current={0} className="flex-1 justify-center self-center px-3" />}
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

/** 단계 표시(카드형) — 번호·단계 이름·입력 요약(두 줄). 지금 단계는 남색 테두리, 끝난 단계는 초록 체크(눌러서 돌아감), 남은 단계는 점선. */
function StepCards({ steps, currentIdx, summaries, onJump }: {
  steps: readonly { key: string; title: string }[];
  currentIdx: number;
  summaries: (string | undefined)[][];
  onJump: (idx: number) => void;
}) {
  return (
    <div className="flex items-stretch gap-1.5 border-b border-border pb-4">
      {steps.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        // 남은 단계는 요약을 보이지 않는다(템플릿 기본값이 입력처럼 보이지 않게)
        const [main, sub] = i > currentIdx ? [] : (summaries[i] ?? []).filter(Boolean);
        return (
          <React.Fragment key={s.key}>
            <button
              type="button"
              disabled={i > currentIdx}
              onClick={() => i < currentIdx && onJump(i)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border-[1.5px] px-3 py-2.5 text-left transition-colors",
                // 테두리 색은 important — globals.css 의 레이어 밖 `* { border-color }` 가 Tailwind 유틸리티를 이긴다
                active ? "border-primary! bg-brand-indigo-50/40" : done ? "cursor-pointer bg-card hover:bg-secondary/40" : "cursor-default border-dashed bg-card",
              )}
            >
              {done ? <CheckCircle2 className="size-6 flex-none fill-brand-mint-500 text-white" /> : (
                <span className={cn("flex size-6 flex-none items-center justify-center rounded-full text-xs font-bold",
                  active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("truncate text-[13px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.title}</span>
                {main && <span title={main} className={cn("truncate text-[13px] font-semibold", active ? "text-primary" : "text-foreground")}>{main}</span>}
                {sub && <span title={sub} className="truncate text-[11px] text-muted-foreground">{sub}</span>}
              </span>
            </button>
            {i < steps.length - 1 && <ChevronRight className="size-4 flex-none self-center text-muted-foreground/50" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** 기본 단계 — 신청 제목(필수, 60자) · 용도(옵션, 여러 줄 300자). 가상머신·서비스 클러스터 공용. */
function BasicFields({ title, onTitle, purpose, onPurpose, titlePlaceholder, purposePlaceholder }: {
  title: string; onTitle: (v: string) => void; purpose: string; onPurpose: (v: string) => void;
  titlePlaceholder: string; purposePlaceholder: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="req-title" className="text-[15px]">신청 제목<span className="ml-0.5 text-[#d92d20]">*</span></Label>
        <Input id="req-title" placeholder={titlePlaceholder} value={title} maxLength={TITLE_MAX} onChange={(e) => onTitle(e.target.value)} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>신청 목록과 관리자 알림에 이 제목이 표시됩니다</span>
          <span className="font-mono">{title.length} / {TITLE_MAX}</span>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="req-purpose" className="text-[15px]">
          용도<span className="ml-2 text-xs font-normal text-muted-foreground">옵션 · 관리자가 승인할 때 참고합니다</span>
        </Label>
        <textarea
          id="req-purpose"
          rows={5}
          placeholder={purposePlaceholder}
          value={purpose}
          maxLength={PURPOSE_MAX}
          onChange={(e) => onPurpose(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-right font-mono text-xs text-muted-foreground">{purpose.length} / {PURPOSE_MAX}</p>
      </div>
    </div>
  );
}

/** 구성 단계 왼쪽 맨 위 이름 카드 — 입력 + 형식·중복 확인 문구(children). 확인되면 초록 체크, 아니면 빨간 카드(확인 중엔 기본). */
function NameCard({ icon, title, value, onChange, placeholder, maxLength, status, children }: {
  icon: React.ReactNode; title: string; value: string; onChange: (v: string) => void; placeholder: string; maxLength: number;
  status?: "done" | "missing"; children: React.ReactNode;
}) {
  const missing = status === "missing";
  return (
    <div className={cn("flex flex-none flex-col gap-2 rounded-[10px] border-[1.5px] px-3.5 py-3",
      missing ? "border-[#f1aca5]! bg-[#fff5f4]" : "bg-card")}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={cn("flex-1 text-sm font-semibold", missing && "text-[#b42318]")}>
          {title}<span className="ml-0.5 text-[#d92d20]">*</span>
        </span>
        {status === "done" && <CheckCircle2 className="size-[18px] flex-none fill-brand-mint-500 text-white" />}
        {missing && <AlertCircle className="size-[18px] flex-none fill-[#d92d20] text-white" />}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={placeholder} maxLength={maxLength}
        className={cn("h-9 bg-card font-mono text-[13px]", status === "done" && "border-brand-mint-500!")} />
      {children}
    </div>
  );
}

/** 프로젝트를 고르기 전 자리 표시. */
function NeedProject({ what }: { what: string }) {
  return <div className="rounded-[10px] border border-dashed p-6 text-center text-[13px] text-muted-foreground">프로젝트를 먼저 고르면 {what}을(를) 불러옵니다</div>;
}
