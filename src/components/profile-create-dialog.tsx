"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProfile, KF_API } from "@/lib/notebook-api";

export function ProfileCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [cpu, setCpu] = React.useState("8");
  const [memoryGi, setMemoryGi] = React.useState("16");
  const [gpu, setGpu] = React.useState("1");
  const [storageGi, setStorageGi] = React.useState("50");

  const create = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      toast.success(`Profile "${name}" 생성 — 네임스페이스·쿼터 프로비저닝 중`);
      qc.invalidateQueries({ queryKey: ["kf", "profiles"] });
      onOpenChange(false);
      setName("");
    },
    onError: (e: Error) => toast.error(`생성 실패: ${e.message}`),
  });

  const valid =
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && ownerEmail.includes("@");

  function submit() {
    if (!KF_API) {
      toast.info("mock 모드 — NEXT_PUBLIC_KF_API 설정 시 실제 생성됩니다");
      onOpenChange(false);
      return;
    }
    create.mutate({
      name,
      ownerEmail,
      cpu: Number(cpu),
      memoryGi: Number(memoryGi),
      acceleratorCount: Number(gpu),
      storageGi: Number(storageGi),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 Profile</DialogTitle>
          <DialogDescription>
            Profile CRD 생성 → 컨트롤러가 Namespace·ResourceQuota·RBAC를 자동 프로비저닝
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Profile 이름</Label>
            <Input
              id="pf-name"
              placeholder="예: ai-research-2 (소문자·숫자·하이픈)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-owner">소유자 이메일</Label>
            <Input
              id="pf-owner"
              placeholder="owner@okestro.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-cpu">vCPU</Label>
              <Input id="pf-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-mem">MEM (Gi)</Label>
              <Input id="pf-mem" value={memoryGi} onChange={(e) => setMemoryGi(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-gpu">GPU</Label>
              <Input id="pf-gpu" value={gpu} onChange={(e) => setGpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-sto">Storage (Gi)</Label>
              <Input id="pf-sto" value={storageGi} onChange={(e) => setStorageGi(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? "생성 중…" : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
