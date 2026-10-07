/* openKcloud CMP — Domain Types
 * 시스템 구조설계서 v0.91 / 요구사항정의서 v1.1 / NIRS·PaaS CMP 기능명세서
 * + 이노그리드 KCloud Monitor API v2 (260409) — 6계층 자원 모델 기반.
 */

// ───────── Innogrid 6계층 자원 모델 ─────────
export type LayerId = "L0" | "L1" | "L2" | "L2b" | "L3" | "L4" | "L5" | "LA";
export const LAYER_INFO: Record<LayerId, { name: string; desc: string }> = {
  L0: { name: "Layer 0 · 물리 서버", desc: "BMC/IPMI 대상 최상위 하드웨어" },
  L1: { name: "Layer 1 · 관리 K8s 노드", desc: "물리 서버의 K8s 표현 (동일 실체)" },
  L2: { name: "Layer 2 · OpenStack Pod", desc: "관리 클러스터 위 OpenStack 제어면" },
  L2b: { name: "Layer 2b · Nova Compute", desc: "물리 서버 하이퍼바이저 (HW 직결)" },
  L3: { name: "Layer 3 · OpenStack VM", desc: "서비스 클러스터 노드의 실체" },
  L4: { name: "Layer 4 · 서비스 K8s 노드", desc: "VM 내부의 K8s Node" },
  L5: { name: "Layer 5 · 컨테이너", desc: "AI 서비스 실행 단위 (가속기 할당 단위)" },
  LA: { name: "Layer A · 가속기", desc: "L0에 부착, L3/L4/L5에서 소비되는 GPU/NPU" },
};

export type ClusterRole = "management" | "service";

// 응답 공통 메타 (모든 API 응답 wrap)
export interface ObservedMeta {
  observed_at: string;
  is_stale: boolean;
  warnings?: string[];
  partial_sources?: string[];
}

// 관리 클러스터 — 물리 인프라 + OpenStack
export interface ManagementCluster {
  id: string;            // ex: "mgmt"
  name: string;
  type: "management";
  description: string;
  nodeCount: number;       // L0/L1 (물리 서버)
  gpuCount: number;        // LA 합계
  totalPowerWatts: number;
  hasOpenstack: true;
  serviceClusters: string[]; // 자식 svc 클러스터 ID
  status: "healthy" | "warning" | "critical";
}

// 서비스 클러스터 — OpenStack Magnum이 프로젝트 단위로 생성한 K8s
export interface ServiceCluster {
  id: string;              // ex: "svc-ai-prod"
  name: string;
  type: "service";
  parentCluster: string;   // 관리 클러스터 ID
  openstackProject: string; // = tenant 매핑 (과금 단위)
  description: string;
  k8sVersion: string;
  cni: string;
  nodeCount: number;     // L3/L4 (VM 노드)
  vmIds: string[];         // L3 (VM)
  gpuCount: number;        // LA passthrough된 가속기
  totalCpu: number;
  totalMemGb: number;
  usedCpu: number;
  usedMemGb: number;
  totalPowerWatts: number;
  status: "healthy" | "warning" | "critical";
  createdAt: string;
}

// 파티션 — MIG / vGPU / mdev / NPU Slice (벤더 중립)
export type PartitionModel = "mig" | "mdev" | "vgpu" | "npu-slice";

export interface AcceleratorPartition {
  id: string;                // ex: "mig-1g10gb-gi0-ci0"
  acceleratorId: string;     // 부모 가속기
  model: PartitionModel;
  profileName: string;       // ex: "1g.10gb", "atom-1/4"
  gpuInstanceId?: number;
  computeInstanceId?: number;
  memoryTotalMb: number;
  memoryUsedMb: number;
  utilizationPercent: number;
  powerWatts: number;
  powerEstimation: "proportional" | "direct";
  workloadBinding?: {
    namespace: string;
    podName: string;
    podUid: string;
    containerName: string;
    workloadType: string;
  };
}

// 가속기 할당 상태 (이노그리드 명세 v2)
export type AllocationState = "allocated" | "releasing" | "idle";
export type PassthroughState =
  | "host_visible"
  | "passthrough_prepared"
  | "passthrough_attached"
  | "guest_visible"
  | "allocated_to_container";

// VM-GPU passthrough 관계
export interface VMGpuPassthrough {
  vmId: string;
  acceleratorId: string;
  hostPciBdf: string;
  state: PassthroughState;
  serviceCluster?: string;
}

// 자원 계보 그래프
export interface ResourceMapNode {
  id: string;
  layer: LayerId;
  type:
    | "physical-server"
    | "mgmt-node"
    | "openstack-vm"
    | "service-node"
    | "container"
    | "pod"
    | "accelerator"
    | "partition";
  label: string;
  meta: Record<string, string | number | boolean>;
}

export type RelationshipKind =
  | "attached_to"        // L0 ←→ LA
  | "passthrough_to"     // L0 → L3
  | "allocated_to"       // L3/L4 → L5
  | "runs_on"            // L4 → L3
  | "scheduled_to"       // L5 → L4
  | "partitioned_from";  // LA → Partition

export interface ResourceMapRelationship {
  source: string;
  target: string;
  kind: RelationshipKind;
  since?: string;
}

// ───────── 기존 (호환) ─────────

export type ProviderType = "OpenStack" | "OpenShift";
export type NetworkClass = "관리망" | "서비스망" | "데이터망";

export interface Center {
  id: string;
  name: string;
  code: string;
  location: string;
  createdAt: string;
}
export interface Zone {
  id: string;
  centerId: string;
  name: string;
  code: string;
}
export interface Network {
  id: string;
  zoneId: string;
  name: string;
  class: NetworkClass;
  cidr: string;
  vlan: number;
}
export interface Pool {
  id: string;
  name: string;
  type: ProviderType;
  zoneId: string;
  endpoint: string;
  status: "정상" | "주의" | "점검";
  capacity: { vcpu: number; ramGb: number; diskTb: number };
  used: { vcpu: number; ramGb: number; diskTb: number };
}

// ───────── AI Accelerators ─────────
export type AcceleratorVendor =
  | "NVIDIA"
  | "Furiosa"
  | "Rebellions"
  | "HyperAccel"
  | "Samsung"
  | "SK Hynix";
export type AcceleratorKind = "GPU" | "NPU" | "PIM";
export type SharingMode = "전용" | "시간분할" | "논리분할" | "멀티플렉싱";
export type Multiplexing = "1:1" | "1:N" | "N:1";

export interface Accelerator {
  id: string;
  name: string; // ex: NVIDIA A100-80GB
  vendor: AcceleratorVendor;
  kind: AcceleratorKind;
  model: string;
  memoryGb: number;
  nodeId: string;
  poolId: string;
  status: "Healthy" | "Allocated" | "Idle" | "Error" | "Maintenance";
  sharing: SharingMode;
  multiplexing: Multiplexing;
  utilization: number; // 0-100
  temperatureC: number;
  powerW: number;
  allocatedToWorkload?: string;
  allocatedToTenant?: string;
  driverVersion: string;
  firmwareVersion: string;
  pciAddress?: string;
  capabilities: string[];
  // Innogrid v2 확장
  allocationState?: AllocationState;
  passthroughTo?: VMGpuPassthrough; // 패스스루된 경우
  partitionMode?: PartitionModel | null;
}

export interface Node {
  id: string;
  hostname: string;
  poolId: string;
  zoneId: string;
  status: "Up" | "Down" | "Drain" | "Maint";
  vcpu: number;
  ramGb: number;
  diskTb: number;
  acceleratorIds: string[];
  ipAddress: string;
  powerW: number;
  uptimeDays: number;
}

// ───────── IaaS ─────────
export interface Tenant {
  id: string;
  name: string;
  orgId: string;
  description: string;
  quotaVcpu: number;
  quotaRamGb: number;
  quotaDiskTb: number;
  quotaAcc: number;
  usedVcpu: number;
  usedRamGb: number;
  usedDiskTb: number;
  usedAcc: number;
  members: number;
  createdAt: string;
  enabled?: boolean; // OpenStack Keystone 프로젝트 활성 여부 (목업엔 없을 수 있음)
}

export interface VM {
  id: string;
  name: string;
  tenantId: string;
  poolId: string;
  nodeId: string;
  flavor: string;
  vcpu: number;
  ramGb: number;
  diskGb: number;
  os: string;
  status: "Running" | "Stopped" | "Paused" | "Error" | "Building" | "Migrating";
  ipAddresses: string[];       // 사설(고정) IP — 항상 존재
  publicIp?: string;           // 공인 IP(Floating IP) — 인터넷망+FIP 신청 시 associate
  keyName?: string;            // 부팅 시 주입된 키페어(key_name) — SSH 접속 키
  owner?: string;              // 생성 사용자(= 키페어 소유자와 일치) — "내 가상서버" 필터용
  acceleratorIds: string[];
  createdAt: string;
  uptimeHours: number;
  // Innogrid v2 확장
  openstackProject?: string;     // = tenantId mapping
  serviceClusterId?: string;     // 이 VM이 노드인 svc 클러스터 (null이면 일반 VM)
  clusterRole?: "control-plane" | "worker";
  hypervisor?: string;           // 물리 호스트 노드 ID (= nodeId 와 동일)
  gpuPassthrough?: VMGpuPassthrough[];
}

export interface KeyPair {
  id: string;
  name: string;
  type: "SSH-RSA" | "SSH-ED25519" | "ECDSA";
  fingerprint: string;
  owner: string;
  project: string;
  createdAt: string;
  usedBy: number;              // 이 키페어로 부팅된 VM 수 (fixtures에서 실제 계산)
}

export interface Volume {
  id: string;
  name: string;
  tenantId: string;
  poolId: string;
  sizeGb: number;
  type: "ssd" | "nvme" | "hdd";
  attachedVmId?: string;
  bootable: boolean;
  status: "available" | "in-use" | "error";
}

export interface IaasNetwork {
  id: string;
  name: string;
  tenantId: string;
  poolId: string;
  cidr: string;
  vlan?: number;
  type: "tenant" | "external" | "shared";
  subnets: number;
  ports: number;
  status?: string;
  shared?: boolean;
}

export interface Image {
  id: string;
  name: string;
  os: string;
  arch: string;
  sizeMb: number;
  visibility: "public" | "private" | "shared";
  format: "qcow2" | "raw" | "iso";
  hasAcceleratorRuntime: boolean;
  createdAt: string;
}

// 자원 신청 템플릿 — Glance 이미지 + cloud-init 여부 · min_disk
export interface TemplateImage extends Image {
  cloudInit: boolean;      // cloud-init 포함 여부 (키페어 주입 가능)
  minDiskGb: number;       // Glance min_disk
}

// ───────── PaaS / K8s ─────────
export interface KCluster {
  id: string;
  name: string;
  provider: ProviderType;
  poolId: string;
  zoneId: string;
  version: string;
  status: "Ready" | "Provisioning" | "Upgrading" | "Error";
  nodeCount: number;
  controlPlanes: number;
  workers: number;
  cni: string;
  totalCpu: number;
  totalMemGb: number;
  totalAcc: number;
  usedCpu: number;
  usedMemGb: number;
  usedAcc: number;
  createdAt: string;
}

export interface KWorkload {
  id: string;
  name: string;
  clusterId: string;
  namespace: string;
  kind: "Deployment" | "StatefulSet" | "DaemonSet" | "Job" | "CronJob";
  replicas: number;
  ready: number;
  image: string;
  cpu: string;
  mem: string;
  accelerators: number;
  status: "Running" | "Pending" | "Failed" | "Succeeded";
  createdAt: string;
  labels: Record<string, string>;
}

export interface KService {
  id: string;
  name: string;
  clusterId: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "Ingress";
  ports: { port: number; targetPort: number; protocol: string }[];
  endpoints: number;
  externalIp?: string;
}

// ───────── Kubeflow ─────────
export interface KFNotebook {
  id: string;
  name: string;
  ownerId: string;
  namespace: string;
  image: string;
  cpu: string;
  memGb: number;
  acceleratorKind?: AcceleratorKind;
  acceleratorCount: number;
  storageGb: number;
  status: "Running" | "Starting" | "Stopped" | "Error";
  url: string;
  createdAt: string;
  lastActivity: string;
}
export interface KFPipeline {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  steps: number;
  runs: number;
  successRate: number;
  lastRun?: string;
  acceleratorKind?: AcceleratorKind;
  status: "Active" | "Archived";
}
export interface KFExperiment {
  id: string;
  name: string;
  pipelineId: string;
  ownerId: string;
  objective: string;
  goal: number;
  bestMetric: number;
  trials: number;
  status: "Running" | "Succeeded" | "Failed";
  createdAt: string;
}
export interface KFInferenceService {
  id: string;
  name: string;
  modelName: string;
  modelVersion: string;
  ownerId: string;
  acceleratorKind: AcceleratorKind;
  replicas: number;
  rpsAvg: number;
  p95LatencyMs: number;
  status: "Ready" | "Deploying" | "Failed";
  endpoint: string;
}

// ───────── Dashboard ─────────
export interface Activity {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  result: "success" | "warning" | "error";
}
export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  ts: string;
  source: string;
  message: string;
  acknowledged: boolean;
}

// ───────── 자원 신청 ─────────
export type RequestType = "vm" | "cluster";
export type RequestStatus =
  | "pending"
  | "approved"
  | "provisioning"
  | "completed"
  | "failed"
  | "rejected";

// 관리자 승인 입력 — 네트워크·IP·보안그룹 (OpenStack 라이브 조회 값)
export interface ProvisionSpec {
  networkId: string;
  networkName: string;
  networkKind: "project" | "shared" | "external";
  // 내부/공유망 + Floating IP 연결 시 FIP 풀(external 망)
  floatingNetworkId?: string;
  floatingNetworkName?: string;
  // external 망 직접 연결(Static IP) — fixedIp 없으면 자동 할당
  fixedIp?: string;
  securityGroups: string[];
}

// 프로비저닝 결과
export interface ProvisionResult {
  serverId?: string;
  fixedIp?: string;
  floatingIp?: string;
}

export interface ProvisionStepsResp {
  status: RequestStatus;
  attempt: number;         // 표시 중인 실행 회차 (MAX(attempt))
  errorMessage?: string;
  result?: ProvisionResult;
  items: ProvisionStep[];
}

export interface Org {
  id: string;
  name: string;
  superUserId?: string;
}

// 신청 마법사 — 사용자에게 할당된 프로젝트 (포털 DB)
export interface MyProject {
  id: string;
  name: string;
  orgId: string;
  orgName?: string;
  quota: string;
  accelerators: { kind: string; label: string; node: string }[];
}

// Nova 플레이버 — diskGb 0 이면 부팅 볼륨 크기 입력
export interface Flavor {
  id: string;
  name: string;
  vcpu: number;
  ramGb: number;
  diskGb: number;
  accel: { kind: string; label: string } | null;
}

// 승인용 Neutron 네트워크
export interface ProvNetwork {
  id: string;
  name: string;
  kind: "project" | "shared" | "external";
  projectId: string;
  cidr: string;
}

// 신청 마법사 키페어 — iam_ssh_key (owner = iam_user.username)
export interface SshKey {
  id: string;
  owner: string;
  name: string;
  type: string;
  fingerprint: string;
  createdAt: string;
}

export interface SecurityGroup {
  id: string;
  name: string;
  projectId: string;
  description: string;
}

export type ProvStepStatus = "waiting" | "running" | "done" | "failed" | "skipped";

// 상세 단계 (tkt_provision_substep) — label 은 cmn_code(TKT_PROVISION_SUBSTEP_IAAS).name
export interface ProvisionSubStep {
  code: string;
  label: string;
  value?: string;
  status: ProvStepStatus;
}

// 단계 5개 고정 (tkt_provision_step): create_server · attach_network · attach_volume · bind_accelerator · wait_active
export interface ProvisionStep {
  seq: number;
  code: string;
  message: string;         // 단계 제목 (cmn_code TKT_PROVISION_STEP_IAAS.name)
  status: ProvStepStatus;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  details: ProvisionSubStep[];
}

export interface ResourceRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  orgId?: string;
  orgName?: string;
  projectId: string;
  projectName: string;
  // VM
  vmName?: string;
  networkType?: "internal" | "external"; // 사용자 희망 망
  flavorId?: string;       // Nova flavorRef
  imageId?: string;
  imageName?: string;
  cloudInit?: boolean;
  volumeGb?: number;       // 플레이버 disk=0 일 때 부팅 볼륨 크기
  provisionSpec?: ProvisionSpec;
  result?: ProvisionResult;
  errorMessage?: string;
  flavorName?: string;
  vcpu?: number;
  ramGb?: number;
  diskGb?: number;         // 스펙 내장 시스템(루트) 디스크
  storageGb?: number;      // 추가 데이터 스토리지 (클러스터)
  networkName?: string;
  keypairId?: string;      // iam_ssh_key.id
  keypairName?: string;
  floatingIp?: boolean;    // 사용자 공인 IP 희망
  acceleratorKind?: string;
  acceleratorCount?: number;
  deviceProfile?: string;  // 플레이버의 Cyborg device-profile (실제 VM 티켓의 가속기 표시)
  // Cluster
  clusterName?: string;
  k8sVersion?: string;
  nodeCount?: number;      // Worker 노드 수
  masterCount?: number;    // Control Plane 노드 수
  // 처리 기록 — 승인 단계(승인 / 반려) · 프로비저닝 단계(시작 / 반려)
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  provisioningBy?: string;
  provisioningByName?: string;
  provisioningAt?: string;
  approvedRejectBy?: string;
  approvedRejectByName?: string;
  approvedRejectAt?: string;
  approvedRejectReason?: string;
  provisioningRejectBy?: string;
  provisioningRejectByName?: string;
  provisioningRejectAt?: string;
  provisioningRejectReason?: string;
  resultId?: string;
}
