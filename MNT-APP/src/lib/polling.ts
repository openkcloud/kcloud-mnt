"use client";
// IaaS 목록 화면 자동 폴링 주기(사용자 설정, localStorage 저장). 0 = 수동(폴링 끔).
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PollingState {
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
}

export const usePollingInterval = create<PollingState>()(
  persist(
    (set) => ({ intervalMs: 30000, setIntervalMs: (ms) => set({ intervalMs: ms }) }),
    { name: "openkcloud-polling-interval" },
  ),
);

export const POLL_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "수동" },
  { value: 10000, label: "10초" },
  { value: 30000, label: "30초" },
  { value: 60000, label: "1분" },
  { value: 300000, label: "5분" },
];
