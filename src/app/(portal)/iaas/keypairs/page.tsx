"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import { Key, Plus, Search, Trash2, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";

interface KeyPair {
  id: string;
  name: string;
  type: "SSH-RSA" | "SSH-ED25519" | "ECDSA";
  fingerprint: string;
  owner: string;
  project: string;
  createdAt: string;
  usedBy: number;
}

const INITIAL: KeyPair[] = [
  {
    id: "kp-001",
    name: "hy-yun-laptop",
    type: "SSH-ED25519",
    fingerprint: "SHA256:8s0k+aFzZ2GxjP9NLcv1XoQnEd8H4RmqA5oV6WuZ2t0",
    owner: "hy.yun",
    project: "proj-ai-research",
    createdAt: "2026-03-15",
    usedBy: 4,
  },
  {
    id: "kp-002",
    name: "etri-shared-01",
    type: "SSH-RSA",
    fingerprint: "SHA256:X9pQmR3vN2s8YkA4dLcE7BgV1oF6WuHtZjK5NqPxRxo",
    owner: "hhchoi",
    project: "proj-llm-serving",
    createdAt: "2026-04-01",
    usedBy: 12,
  },
  {
    id: "kp-003",
    name: "ci-runner-key",
    type: "SSH-ED25519",
    fingerprint: "SHA256:Z1kL5nM8pQrS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lMn",
    owner: "system.ci",
    project: "proj-platform-ops",
    createdAt: "2026-02-10",
    usedBy: 3,
  },
  {
    id: "kp-004",
    name: "hy-yun-desktop",
    type: "ECDSA",
    fingerprint: "SHA256:R7qWsX8yZ9aB0cD1eF2gH3iJ4kL5mN6oP7qR8sT9uVw",
    owner: "hy.yun",
    project: "proj-ai-research",
    createdAt: "2026-05-20",
    usedBy: 1,
  },
];

export default function KeyPairsPage() {
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [items, setItems] = React.useState<KeyPair[]>(INITIAL);
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [imported, setImported] = React.useState<KeyPair | null>(null);

  const filtered = items.filter((k) => !q || k.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <ChangeMark ids={["CR-IAAS-04"]}>
      <PageHeader
        title="키페어"
        description={isAdmin ? "OpenStack Nova SSH 키페어 — 생성·업로드·삭제는 관리자 권한" : "OpenStack Nova SSH 키페어 — 관리자가 등록한 키페어를 VM 신청 시 선택한다. 생성·삭제는 관리자 권한"}
        actions={
          isAdmin && <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 키페어 생성·업로드
          </Button>
        }
      />
      </ChangeMark>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="키페어" value={items.length} unit="개" icon={Key} accent="indigo" />
        <StatCard label="적용된 인스턴스" value={items.reduce((s, x) => s + x.usedBy, 0)} unit="대" icon={Key} accent="mint" />
        <StatCard label="등록 사용자" value={new Set(items.map((x) => x.owner)).size} unit="명" icon={Key} accent="amber" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="키페어 이름 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length}/{items.length}개 표시
          </span>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>타입</TableHead>
              <TableHead>Fingerprint (SHA256)</TableHead>
              <TableHead>소유자</TableHead>
              <TableHead>프로젝트</TableHead>
              <TableHead className="text-center">사용 중</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((k) => (
              <TableRow key={k.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Key className="size-3.5 text-brand-indigo-600" />
                    <span className="font-medium">{k.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="ghost" className="font-mono text-[10px]">{k.type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {k.fingerprint.slice(0, 24)}…
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(k.fingerprint);
                        toast.success("Fingerprint 복사됨");
                      }}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{k.owner}</TableCell>
                <TableCell className="font-mono text-xs">{k.project}</TableCell>
                <TableCell className="text-center font-mono">{k.usedBy}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{k.createdAt}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toast.success(`${k.name}.pem 다운로드 — 소유자만 가능`)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (k.usedBy > 0) {
                            toast.error(`삭제 거부 — ${k.usedBy}개 인스턴스가 사용 중`);
                            return;
                          }
                          setItems((prev) => prev.filter((x) => x.id !== k.id));
                          toast.success(`${k.name} 삭제됨`);
                        }}
                      >
                        <Trash2 className="size-3.5 text-rose-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateKeyPairDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(k, isGenerated) => {
          setItems((prev) => [...prev, k]);
          if (isGenerated) {
            setImported(k);
          } else {
            toast.success(`${k.name} 등록됨`);
          }
        }}
      />

      <Dialog open={!!imported} onOpenChange={(o) => !o && setImported(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>키페어 생성 완료 — {imported?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>비공개 키(.pem)는 지금 한 번만 다운로드할 수 있다.</strong>
              화면을 닫으면 재발급 불가능하니 반드시 안전한 곳에 저장하기.
            </div>
            <Button
              className="w-full"
              onClick={() => {
                toast.success(`${imported?.name}.pem 다운로드 시작`);
                setImported(null);
              }}
            >
              <Download className="size-4" /> {imported?.name}.pem 다운로드
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateKeyPairDialog({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (k: KeyPair, isGenerated: boolean) => void;
}) {
  const [mode, setMode] = React.useState<"generate" | "import">("generate");
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<KeyPair["type"]>("SSH-ED25519");
  const [publicKey, setPublicKey] = React.useState("");
  const [project, setProject] = React.useState("proj-ai-research");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(
      {
        id: `kp-${Date.now()}`,
        name: name.trim(),
        type,
        fingerprint: `SHA256:${Array.from({ length: 43 }, () => "abcdefghijkmnpqrstuvwxyz023456789"[Math.floor(Date.now() % 32)]).join("")}`,
        owner: "hy.yun",
        project,
        createdAt: new Date().toISOString().slice(0, 10),
        usedBy: 0,
      },
      mode === "generate",
    );
    setName("");
    setPublicKey("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>키페어 생성 · 업로드</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>방식</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "generate" | "import")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="generate">새로 생성 (플랫폼에서 키페어 생성)</SelectItem>
                <SelectItem value="import">기존 공개키 업로드</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-laptop-key" />
          </div>
          <div>
            <Label>타입</Label>
            <Select value={type} onValueChange={(v) => setType(v as KeyPair["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SSH-ED25519">SSH-ED25519 (권장)</SelectItem>
                <SelectItem value="SSH-RSA">SSH-RSA</SelectItem>
                <SelectItem value="ECDSA">ECDSA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "import" && (
            <div>
              <Label>공개키 (id_rsa.pub 내용)</Label>
              <textarea
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
                placeholder="ssh-rsa AAAAB3NzaC1yc2EAAA..."
              />
            </div>
          )}
          <div>
            <Label>프로젝트</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proj-ai-research">proj-ai-research</SelectItem>
                <SelectItem value="proj-llm-serving">proj-llm-serving</SelectItem>
                <SelectItem value="proj-edge-inference">proj-edge-inference</SelectItem>
                <SelectItem value="proj-platform-ops">proj-platform-ops</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>{mode === "generate" ? "생성" : "업로드"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
