import { create } from "zustand";

export interface ProvStep {
  key: string;
  label: string;
  detail?: string;
}

export interface ProvEntry {
  steps: ProvStep[];
  current: number; // 완료된 단계 수 (current번째 단계가 진행중)
  status: "provisioning" | "completed" | "failed";
}

interface ProvisioningState {
  map: Record<string, ProvEntry>;
  timers: Record<string, ReturnType<typeof setInterval>>;
  // 승인 시 호출 — 진행 시뮬레이션 시작 (열고닫아도 진행 유지)
  start: (id: string, steps: ProvStep[]) => void;
}

// 목업: 승인 시 단계가 일정 간격으로 자동 진행 → 완료.
// 실제 연동 시엔 이 store 대신 GET /requests/:id 폴링 결과로 대체.
const STEP_INTERVAL_MS = 1800;

export const useProvisioning = create<ProvisioningState>((set, get) => ({
  map: {},
  timers: {},
  start: (id, steps) => {
    if (get().map[id]) return; // 이미 시작됨
    set((s) => ({ map: { ...s.map, [id]: { steps, current: 0, status: "provisioning" } } }));
    const timer = setInterval(() => {
      const entry = get().map[id];
      if (!entry) return;
      const next = entry.current + 1;
      if (next >= entry.steps.length) {
        clearInterval(get().timers[id]);
        set((s) => ({
          map: { ...s.map, [id]: { ...entry, current: entry.steps.length, status: "completed" } },
        }));
      } else {
        set((s) => ({ map: { ...s.map, [id]: { ...entry, current: next } } }));
      }
    }, STEP_INTERVAL_MS);
    set((s) => ({ timers: { ...s.timers, [id]: timer } }));
  },
}));
