"use client";
import { Settings, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="시스템 설정"
        description="플랫폼 운영 메뉴/배치/에이전트 — NIRS CMP 7번 시스템관리 패턴"
      />
      <EmptyState
        icon={Wrench}
        title="메뉴 · 배치 · 에이전트 관리"
        description="플랫폼 메뉴 정의, 배치 스케줄 등록/실행 이력, OpenStack(Nova·Neutron·Cinder) 에이전트 연결 상태는 2차년도 후반 구현 예정."
      />
    </div>
  );
}
