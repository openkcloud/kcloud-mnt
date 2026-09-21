/* 화면 안 변경 표시 모드 — 켜면 각 화면에서 초기 전달본 대비 바뀐 부분에 변경 요구사항 코드 배지가 붙고,
 * 우측 패널에 그 화면의 변경 요구사항 목록이 뜬다. 배지·목록을 누르면 코드·내용·출처·이전/이후를 본다. */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChangeModeState {
  on: boolean;
  /** 상세를 열어 둔 변경 요구사항 코드 */
  selected: string | null;
  toggle: () => void;
  setOn: (on: boolean) => void;
  select: (id: string | null) => void;
}

export const useChangeMode = create<ChangeModeState>()(
  persist(
    (set, get) => ({
      on: false,
      selected: null,
      toggle: () => set({ on: !get().on, selected: null }),
      setOn: (on) => set({ on, selected: on ? get().selected : null }),
      select: (id) => set({ selected: id }),
    }),
    { name: "openkcloud-changemode", partialize: (s) => ({ on: s.on }) },
  ),
);
