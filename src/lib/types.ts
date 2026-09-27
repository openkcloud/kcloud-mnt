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
  ipAddresses: string[];
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
  /** Kubeflow Profile 네임스페이스 = 프로젝트 */
  namespace?: string;
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
  /** Kubeflow Profile 네임스페이스 = 프로젝트 */
  namespace?: string;
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
  /** Kubeflow Profile 네임스페이스 = 프로젝트 */
  namespace?: string;
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
