/* ════════════════════════════════════════════════════════════════════
 * Notebook API — Kubeflow Notebook Controller 연동 인터페이스
 * ────────────────────────────────────────────────────────────────────
 * 이 파일의 모든 함수는 현재 mock 응답을 반환하지만,
 * 실제 구현 시 fetch 호출만 교체하면 됩니다.
 * UI 계층은 이 인터페이스에만 의존합니다.
 * ──────────────────────────────────────────────────────────────────── */

import { useQuery } from "@tanstack/react-query";

/** Kubeflow Notebook CRD에 매핑되는 응답 모델 */
export interface NotebookResource {
  /** 네임스페이스 (Kubeflow Profile 매핑) */
  namespace: string;
  /** Notebook CRD name */
  name: string;
  /** Pod 상태 */
  status: "Running" | "Starting" | "Stopped" | "Error";
  /** 컨테이너 이미지 */
  image: string;
  /** 리소스 요청 (K8s ResourceRequirements) */
  resources: {
    cpu: string;
    memory: string;
    /** vendor.com/gpu 또는 vendor.com/npu 등 */
    accelerator?: { kind: string; count: number };
  };
  /** PVC 마운트 정보 */
  workspaceVolume: {
    pvcName: string;
    sizeGb: number;
    mountPath: string;
  };
  /**
   * ⭐ iframe src 로 사용될 URL
   *
   * 실제 구현 시 Kubeflow Notebook Controller가 제공하는 게이트웨이 경로:
   *   https://kubeflow.openkcloud.local/notebook/{namespace}/{name}/?folder=/home/kubeflow
   *
   * mock에서는 내부 시뮬레이션 페이지(/notebooks-preview/[id])로 fallback.
   */
  connectUrl: string;
  /** 연결 모드 — 실제 Kubeflow가 설치되면 "live", 그렇지 않으면 "mock" */
  connectMode: "live" | "mock";
  /** Kubeflow OAuth2 Proxy가 set-cookie로 발급한 토큰 만료 시각 */
  jwtExpiresAt?: string;
}

/** CMP 백엔드 주소 — 미설정 시 mock 모드로 동작 */
export const KF_API = process.env.NEXT_PUBLIC_KF_API;

/** 노트북 생성 (POST /api/v1/notebooks) */
export async function createNotebook(body: {
  name: string;
  namespace: string;
  image: string;
  cpu: string;
  memoryGi: number;
  acceleratorKind?: string;
  acceleratorCount: number;
  storageGb: number;
}): Promise<{ id: string }> {
  const res = await fetch(`${KF_API}/api/v1/notebooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

/** Profile 생성 (POST /api/v1/profiles) */
export async function createProfile(body: {
  name: string;
  ownerEmail: string;
  cpu: number;
  memoryGi: number;
  acceleratorCount: number;
  storageGi: number;
}): Promise<{ name: string }> {
  const res = await fetch(`${KF_API}/api/v1/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

/** 노트북 상세 조회 + Code Server 연결 URL 발급 */
async function fetchNotebookConnect(id: string): Promise<NotebookResource> {
  if (KF_API) {
    const res = await fetch(`${KF_API}/api/v1/notebooks/${id}/connect`, {
      credentials: "include", // OAuth2 Proxy 쿠키 포함
    });
    if (!res.ok) throw new Error(`Notebook connect failed: ${res.status}`);
    return res.json();
  }

  // ──────────────────────────────────────────────────────────────
  // 📦 Mock 응답 (NEXT_PUBLIC_KF_API 미설정 시)
  // ──────────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 300));
  return MOCK_NOTEBOOKS[id] ?? MOCK_NOTEBOOKS["nb-1"];
}

/** React Query hook */
export function useNotebookConnect(id: string) {
  return useQuery({
    queryKey: ["notebook-connect", id],
    queryFn: () => fetchNotebookConnect(id),
    refetchOnWindowFocus: false,
  });
}

/** 노트북 시작·정지·삭제 */
export async function notebookAction(
  id: string,
  action: "start" | "stop" | "restart" | "delete",
): Promise<void> {
  if (KF_API) {
    const method = action === "delete" ? "DELETE" : "POST";
    const path =
      action === "delete"
        ? `${KF_API}/api/v1/notebooks/${id}`
        : `${KF_API}/api/v1/notebooks/${id}/${action}`;
    const res = await fetch(path, { method });
    if (!res.ok) throw new Error(`Notebook ${action} failed: ${res.status}`);
    return;
  }
  await new Promise((r) => setTimeout(r, 500));
}

// ════════════════════════════════════════════════════════════════════
// Mock fixtures
// ════════════════════════════════════════════════════════════════════
const MOCK_NOTEBOOKS: Record<string, NotebookResource> = {
  "nb-1": {
    namespace: "ai-research",
    name: "research-llama-finetune",
    status: "Running",
    image: "kubeflow/codeserver-python:v1.10.0-cuda12.4",
    resources: { cpu: "16", memory: "64Gi", accelerator: { kind: "rebellions.ai/atom", count: 2 } },
    workspaceVolume: { pvcName: "research-llama-vol", sizeGb: 500, mountPath: "/home/kubeflow" },
    connectUrl: "/notebooks-preview/nb-1",
    connectMode: "mock",
  },
  "nb-2": {
    namespace: "ai-research",
    name: "solar-data-prep",
    status: "Running",
    image: "kubeflow/codeserver-python:v1.10.0",
    resources: { cpu: "8", memory: "32Gi" },
    workspaceVolume: { pvcName: "solar-data-vol", sizeGb: 200, mountPath: "/home/kubeflow" },
    connectUrl: "/notebooks-preview/nb-2",
    connectMode: "mock",
  },
  "nb-3": {
    namespace: "llm-serving",
    name: "vllm-benchmark",
    status: "Running",
    image: "openkcloud/kubeflow-vllm:0.6.5",
    resources: { cpu: "8", memory: "64Gi", accelerator: { kind: "nvidia.com/gpu", count: 1 } },
    workspaceVolume: { pvcName: "vllm-bench-vol", sizeGb: 100, mountPath: "/home/kubeflow" },
    connectUrl: "/notebooks-preview/nb-3",
    connectMode: "mock",
  },
  "nb-4": {
    namespace: "edge-inference",
    name: "rebellions-atom-finetune",
    status: "Starting",
    image: "openkcloud/kubeflow-rbln:1.4.0",
    resources: { cpu: "4", memory: "16Gi", accelerator: { kind: "rebellions.ai/atom", count: 1 } },
    workspaceVolume: { pvcName: "rbln-finetune-vol", sizeGb: 100, mountPath: "/home/kubeflow" },
    connectUrl: "/notebooks-preview/nb-4",
    connectMode: "mock",
  },
  "nb-6": {
    namespace: "ai-research",
    name: "pim-experiments",
    status: "Running",
    image: "openkcloud/kubeflow-pim:0.7",
    resources: { cpu: "8", memory: "64Gi", accelerator: { kind: "samsung.com/pim", count: 1 } },
    workspaceVolume: { pvcName: "pim-exp-vol", sizeGb: 200, mountPath: "/home/kubeflow" },
    connectUrl: "/notebooks-preview/nb-6",
    connectMode: "mock",
  },
};

/**
 * ════════════════════════════════════════════════════════════════════
 * 실제 구현 가이드 — 백엔드 / Kubeflow / K8s
 * ════════════════════════════════════════════════════════════════════
 *
 * 1️⃣ CMP 백엔드 (FastAPI 등)
 *     POST  /api/v1/notebooks                  # Notebook CRD 생성
 *     GET   /api/v1/notebooks                  # 목록
 *     GET   /api/v1/notebooks/{id}             # 상세
 *     GET   /api/v1/notebooks/{id}/connect     # connectUrl + Set-Cookie 발급
 *     POST  /api/v1/notebooks/{id}/start       # 시작 (annotation: kubeflow-resource-stopped=false)
 *     POST  /api/v1/notebooks/{id}/stop        # 정지 (annotation: kubeflow-resource-stopped=true)
 *     DELETE /api/v1/notebooks/{id}            # 삭제
 *
 * 2️⃣ Kubeflow Notebook Controller 설치
 *     $ kubectl apply -k "github.com/kubeflow/kubeflow/components/notebook-controller/config/overlays/standalone?ref=v1.10.0"
 *
 * 3️⃣ Notebook CRD 예시
 *     apiVersion: kubeflow.org/v1
 *     kind: Notebook
 *     metadata:
 *       name: research-llama-finetune
 *       namespace: ai-research            # = Kubeflow Profile = OpenStack 프로젝트
 *     spec:
 *       template:
 *         spec:
 *           containers:
 *             - name: notebook
 *               image: kubeflow/codeserver-python:v1.10.0-cuda12.4
 *               resources:
 *                 requests:
 *                   cpu: "16"
 *                   memory: "64Gi"
 *                   rebellions.ai/atom: "2"
 *                 limits:
 *                   cpu: "16"
 *                   memory: "64Gi"
 *                   rebellions.ai/atom: "2"
 *               volumeMounts:
 *                 - name: workspace
 *                   mountPath: /home/kubeflow
 *           volumes:
 *             - name: workspace
 *               persistentVolumeClaim:
 *                 claimName: research-llama-vol
 *
 * 4️⃣ Istio VirtualService — iframe 라우팅
 *     - match:
 *       - uri:
 *           prefix: /notebook/ai-research/research-llama-finetune/
 *       route:
 *       - destination:
 *           host: research-llama-finetune.ai-research.svc.cluster.local
 *           port:
 *             number: 80
 *
 * 5️⃣ oauth2-proxy + JWT
 *     CMP가 발급한 JWT를 Kubeflow의 oauth2-proxy 쿠키로 변환 →
 *     iframe 요청 시 인증 자동 통과
 *
 * 6️⃣ Code Server 컨테이너에 RBLN/CUDA SDK 미리 설치된 이미지 사용
 *     - openkcloud/codeserver-rbln:1.4.0
 *     - openkcloud/codeserver-cuda:12.4
 *     - openkcloud/codeserver-pim:0.7
 * ════════════════════════════════════════════════════════════════════
 */
