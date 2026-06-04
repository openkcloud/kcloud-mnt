"use client";
import * as React from "react";
import {
  Settings2,
  Lock,
  Search,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Download,
  Activity,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CM = { id: string; name: string; namespace: string; keys: string[]; dataSize: string; age: string };
type Secret = { id: string; name: string; namespace: string; type: string; keys: number; age: string };

const CMS: CM[] = [
  { id: "cm-1", name: "vllm-solar-config", namespace: "llm-serving", keys: ["model.yaml", "scheduler.json"], dataSize: "2.4 KB", age: "12d" },
  { id: "cm-2", name: "kubeflow-config", namespace: "kubeflow", keys: ["centraldashboard-config.json", "spawner_ui_config.yaml"], dataSize: "8.1 KB", age: "30d" },
  { id: "cm-3", name: "prometheus-rules", namespace: "monitoring", keys: ["alert_rules.yaml", "recording_rules.yaml"], dataSize: "12.4 KB", age: "30d" },
  { id: "cm-4", name: "kserve-router-config", namespace: "llm-serving", keys: ["routes.json"], dataSize: "0.8 KB", age: "8d" },
  { id: "cm-5", name: "research-experiment-cfg", namespace: "ai-research", keys: ["hp.yaml", "data_paths.json"], dataSize: "1.6 KB", age: "5d" },
];

const SECRETS: Secret[] = [
  { id: "s-1", name: "harbor-registry-creds", namespace: "ai-research", type: "kubernetes.io/dockerconfigjson", keys: 1, age: "23d" },
  { id: "s-2", name: "huggingface-token", namespace: "ai-research", type: "Opaque", keys: 1, age: "45d" },
  { id: "s-3", name: "kubeflow-pipelines-mlpipeline-minio-artifact", namespace: "kubeflow", type: "Opaque", keys: 2, age: "30d" },
  { id: "s-4", name: "tls-openkcloud-local", namespace: "kube-system", type: "kubernetes.io/tls", keys: 2, age: "60d" },
  { id: "s-5", name: "openstack-keystone-token", namespace: "platform-ops", type: "Opaque", keys: 1, age: "12d" },
  { id: "s-6", name: "rbln-license", namespace: "edge-inference", type: "Opaque", keys: 1, age: "14d" },
];

// 샘플 ConfigMap 데이터
const CM_DATA: Record<string, Record<string, string>> = {
  default: {
    "model.yaml": `model: meta-llama/Llama-3.1-8B-Instruct
precision: bf16
max_tokens: 4096
temperature: 0.7
top_p: 0.95`,
    "scheduler.json": `{
  "policy": "priority",
  "max_concurrent": 16,
  "batch_size": 8,
  "queue_timeout_ms": 30000
}`,
  },
};

// 샘플 Secret 데이터 (마스킹 가능)
const SECRET_DATA: Record<string, Record<string, string>> = {
  default: {
    "token": "hf_abcdef0123456789xyzABCDEFGHIJ",
  },
  "kubernetes.io/dockerconfigjson": {
    ".dockerconfigjson": `{"auths":{"harbor.openkcloud.local":{"username":"admin","password":"<masked>"}}}`,
  },
  "kubernetes.io/tls": {
    "tls.crt": "-----BEGIN CERTIFICATE-----\nMIIDazCCAlOg...\n-----END CERTIFICATE-----",
    "tls.key": "-----BEGIN PRIVATE KEY-----\nMIIE6QIBAA...\n-----END PRIVATE KEY-----",
  },
};

export default function PaasConfigPage() {
  const [selectedCm, setSelectedCm] = React.useState<CM | undefined>();
  const [selectedSecret, setSelectedSecret] = React.useState<Secret | undefined>();
  const [createCmOpen, setCreateCmOpen] = React.useState(false);
  const [createSecretOpen, setCreateSecretOpen] = React.useState(false);
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
  const [q, setQ] = React.useState("");

  const filteredCms = CMS.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const filteredSecrets = SECRETS.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="ConfigMap" value={CMS.length} icon={Settings2} accent="indigo" />
        <StatCard label="Secret" value={SECRETS.length} icon={Lock} accent="amber" />
        <StatCard label="총 데이터" value="24.3 KB" icon={Settings2} accent="mint" />
      </div>

      <Tabs defaultValue="cms">
        <TabsList>
          <TabsTrigger value="cms">ConfigMap ({CMS.length})</TabsTrigger>
          <TabsTrigger value="secrets">Secret ({SECRETS.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cms">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input placeholder="ConfigMap·키 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
              </div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.success("ConfigMap YAML 다운로드")}>
                <Download className="size-3.5" /> 내보내기
              </Button>
              <Button size="sm" onClick={() => setCreateCmOpen(true)}>
                <Plus className="size-3.5" /> ConfigMap 생성
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>네임스페이스</TableHead>
                  <TableHead>키 (Data)</TableHead>
                  <TableHead>크기</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCms.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCm(c)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Settings2 className="size-4 text-brand-indigo-600" />
                        <span className="font-medium hover:text-primary">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.namespace}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.keys.map((k) => (
                          <Badge key={k} variant="ghost" className="font-mono text-[10px]">{k}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{c.dataSize}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.age}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreVertical className="size-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedCm(c)}><Activity className="size-3.5" /> 상세 보기</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`${c.name} 편집기 열림`)}><Edit className="size-3.5" /> 편집</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(JSON.stringify(CM_DATA.default)); toast.success("Data 복사됨"); }}><Copy className="size-3.5" /> Data 복사</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${c.name} 삭제`)}><Trash2 className="size-3.5" /> 삭제</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="secrets">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input placeholder="Secret·타입 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-9" />
              </div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.success("Secret 백업")}>
                <Download className="size-3.5" /> 백업
              </Button>
              <Button size="sm" onClick={() => setCreateSecretOpen(true)}>
                <Plus className="size-3.5" /> Secret 생성
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>네임스페이스</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>키 수</TableHead>
                  <TableHead>값</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSecrets.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedSecret(s)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Lock className="size-4 text-amber-600" />
                        <span className="font-medium hover:text-primary">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.namespace}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{s.type}</TableCell>
                    <TableCell className="font-mono tabular-nums">{s.keys}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setRevealed((r) => ({ ...r, [s.id]: !r[s.id] }))}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                      >
                        {revealed[s.id] ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        {revealed[s.id] ? "hf_abcdef0123..." : "•••••••••••••"}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.age}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm"><MoreVertical className="size-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedSecret(s)}><Activity className="size-3.5" /> 상세</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`${s.name} 로테이션 시작`)}><RefreshCw className="size-3.5" /> 로테이션</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${s.name} 삭제`)}><Trash2 className="size-3.5" /> 삭제</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CM Detail Sheet */}
      <Sheet open={!!selectedCm} onOpenChange={(o) => !o && setSelectedCm(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedCm && <CmDetailPanel cm={selectedCm} />}
        </SheetContent>
      </Sheet>

      {/* Secret Detail Sheet */}
      <Sheet open={!!selectedSecret} onOpenChange={(o) => !o && setSelectedSecret(undefined)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedSecret && <SecretDetailPanel secret={selectedSecret} />}
        </SheetContent>
      </Sheet>

      {/* Create Dialogs */}
      <CreateCmDialog open={createCmOpen} onClose={() => setCreateCmOpen(false)} />
      <CreateSecretDialog open={createSecretOpen} onClose={() => setCreateSecretOpen(false)} />
    </div>
  );
}

function CmDetailPanel({ cm }: { cm: CM }) {
  const [selectedKey, setSelectedKey] = React.useState(cm.keys[0]);
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-indigo-100 text-brand-indigo-700">
            <Settings2 className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{cm.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{cm.namespace}/{cm.id} · ConfigMap</SheetDescription>
          </div>
          <Badge variant="ghost" className="font-mono text-[10px]">{cm.dataSize}</Badge>
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6">
        <Tabs defaultValue="data">
          <TabsList>
            <TabsTrigger value="data">Data ({cm.keys.length})</TabsTrigger>
            <TabsTrigger value="info">정보</TabsTrigger>
            <TabsTrigger value="users">사용 Pod</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="space-y-2 pt-3">
            <div className="flex gap-1.5">
              {cm.keys.map((k) => (
                <Button key={k} variant={selectedKey === k ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedKey(k)}>
                  {k}
                </Button>
              ))}
            </div>
            <Card className="overflow-hidden bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
              <pre className="overflow-x-auto">{CM_DATA.default[selectedKey] ?? "# (예시 데이터가 없음)"}</pre>
            </Card>
            <Button variant="outline" size="sm" onClick={() => toast.success(`${selectedKey} 편집기 열림`)}>
              <Edit className="size-3.5" /> 편집
            </Button>
          </TabsContent>
          <TabsContent value="info" className="space-y-2 pt-3">
            <Card className="space-y-2 p-4 text-xs">
              <KV label="이름" value={cm.name} mono />
              <KV label="네임스페이스" value={cm.namespace} mono />
              <KV label="키 개수" value={cm.keys.length.toString()} mono />
              <KV label="총 크기" value={cm.dataSize} mono />
              <KV label="생성" value={`${cm.age} 전`} />
              <KV label="UID" value="cm-d7e3...c4a8" mono />
            </Card>
          </TabsContent>
          <TabsContent value="users" className="space-y-2 pt-3">
            <Card className="p-3 text-xs space-y-1">
              <div className="font-mono">vllm-solar-10b-7f9b8 <span className="ml-2 text-muted-foreground">(envFrom)</span></div>
              <div className="font-mono">vllm-solar-10b-9c2da <span className="ml-2 text-muted-foreground">(volumeMounts: /etc/config)</span></div>
            </Card>
          </TabsContent>
          <TabsContent value="yaml" className="pt-3">
            <Card className="overflow-hidden bg-slate-950 p-3 font-mono text-[11px] text-slate-100">
              <pre>
{`apiVersion: v1
kind: ConfigMap
metadata:
  name: ${cm.name}
  namespace: ${cm.namespace}
data:
${cm.keys.map((k) => `  ${k}: |
    ${(CM_DATA.default[k] ?? "...").split("\n").join("\n    ")}`).join("\n")}`}
              </pre>
            </Card>
          </TabsContent>
        </Tabs>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${cm.name} 편집기`)}><Edit className="size-3.5" /> 편집</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Pod 재시작 — 변경사항 적용")}><RefreshCw className="size-3.5" /> Pod 재시작</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${cm.name} 삭제`)}><Trash2 className="size-3.5" /> 삭제</Button>
        </div>
      </div>
    </>
  );
}

function SecretDetailPanel({ secret }: { secret: Secret }) {
  const [reveal, setReveal] = React.useState(false);
  const sampleData = SECRET_DATA[secret.type] ?? SECRET_DATA.default;
  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Lock className="size-5" />
          </div>
          <div className="flex-1">
            <SheetTitle className="text-lg">{secret.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{secret.namespace}/{secret.id} · Secret</SheetDescription>
          </div>
          <Badge variant="warning" className="font-mono text-[10px]">{secret.type}</Badge>
        </div>
      </SheetHeader>
      <div className="space-y-4 p-6">
        <Card className="space-y-2 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Secret 값 표시</span>
            <Button size="sm" variant="ghost" onClick={() => setReveal((r) => !r)}>
              {reveal ? <><EyeOff className="size-3.5" /> 숨기기</> : <><Eye className="size-3.5" /> 표시</>}
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          {Object.entries(sampleData).map(([k, v]) => (
            <Card key={k} className="p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold">{k}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(v); toast.success(`${k} 복사됨`); }}>
                  <Copy className="size-3" />
                </Button>
              </div>
              <pre className="overflow-x-auto bg-slate-950 p-2 font-mono text-[11px] text-slate-100">
                {reveal ? v : "•".repeat(Math.min(60, v.length))}
              </pre>
            </Card>
          ))}
        </div>

        <Card className="p-3 text-xs space-y-1">
          <div className="text-muted-foreground">사용 중인 Pod</div>
          <div className="font-mono">vllm-solar-10b-7f9b8</div>
          <div className="font-mono">research-trainer-01</div>
        </Card>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => toast.success(`${secret.name} 로테이션 시작 — Vault에서 새 값 가져옴`)}><RefreshCw className="size-3.5" /> 로테이션</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(`${secret.name} 편집`)}><Edit className="size-3.5" /> 편집</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => toast.error(`${secret.name} 삭제`)}><Trash2 className="size-3.5" /> 삭제</Button>
        </div>
      </div>
    </>
  );
}

function CreateCmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [ns, setNs] = React.useState("default");
  const [key, setKey] = React.useState("config.yaml");
  const [value, setValue] = React.useState("");
  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`ConfigMap ${ns}/${name} 생성됨`, { description: `${key}: ${value.length}자` });
    onClose();
    setName(""); setValue("");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ConfigMap 생성</DialogTitle>
          <DialogDescription>설정 파일을 ConfigMap으로 K8s에 저장합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-config" />
            </div>
            <div className="space-y-1.5">
              <Label>네임스페이스</Label>
              <Select value={ns} onValueChange={setNs}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">default</SelectItem>
                  <SelectItem value="ai-research">ai-research</SelectItem>
                  <SelectItem value="llm-serving">llm-serving</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="app.properties" />
          </div>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-32 w-full rounded-md border border-input bg-card p-2 font-mono text-xs"
              placeholder="server.port=8080&#10;app.name=myapp"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSecretDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [ns, setNs] = React.useState("default");
  const [type, setType] = React.useState("Opaque");
  const [key, setKey] = React.useState("token");
  const [value, setValue] = React.useState("");
  function submit() {
    if (!name) return toast.error("이름을 입력하세요");
    toast.success(`Secret ${ns}/${name} 생성됨`, { description: `Type: ${type}, ${key} (base64 encoded)` });
    onClose();
    setName(""); setValue("");
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Secret 생성</DialogTitle>
          <DialogDescription>민감 정보를 Secret으로 K8s에 저장합니다. 자동으로 base64 인코딩됩니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-token" />
            </div>
            <div className="space-y-1.5">
              <Label>네임스페이스</Label>
              <Select value={ns} onValueChange={setNs}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">default</SelectItem>
                  <SelectItem value="ai-research">ai-research</SelectItem>
                  <SelectItem value="llm-serving">llm-serving</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>타입</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Opaque">Opaque (일반)</SelectItem>
                <SelectItem value="kubernetes.io/dockerconfigjson">Docker Registry 인증</SelectItem>
                <SelectItem value="kubernetes.io/tls">TLS 인증서</SelectItem>
                <SelectItem value="kubernetes.io/basic-auth">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="민감 정보" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; accent: "indigo" | "mint" | "amber" }) {
  const map = { indigo: "bg-brand-indigo-100 text-brand-indigo-700", mint: "bg-brand-mint-50 text-brand-mint-700", amber: "bg-amber-100 text-amber-700" };
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </div>
      <div className={cn("flex size-10 items-center justify-center rounded-md", map[accent])}><Icon className="size-5" /></div>
    </Card>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-right" : "text-right"}>{value}</span>
    </div>
  );
}
