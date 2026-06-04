"""
openKcloud CMP — IaaS / PaaS 기능 명세서 (현재 mockup 기준)
generate xlsx file.
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Side, Font, PatternFill
from openpyxl.utils import get_column_letter

# ─────────────────────────────────────────────────────────────
# 스타일
# ─────────────────────────────────────────────────────────────
FONT_NAME = "맑은 고딕"
HDR_FILL = PatternFill("solid", fgColor="1B3A8A")
HDR_FONT = Font(name=FONT_NAME, size=10, bold=True, color="FFFFFF")
CELL_FONT = Font(name=FONT_NAME, size=10)
ID_FONT = Font(name="Consolas", size=9, bold=True, color="1B3A8A")
WRAP = Alignment(wrap_text=True, vertical="top", horizontal="left")
CENTER = Alignment(wrap_text=True, vertical="center", horizontal="center")
BORDER = Border(
    left=Side(style="thin", color="C7CFE2"),
    right=Side(style="thin", color="C7CFE2"),
    top=Side(style="thin", color="C7CFE2"),
    bottom=Side(style="thin", color="C7CFE2"),
)
STATUS_FILLS = {
    "구현 완료":  PatternFill("solid", fgColor="DCFCE7"),
    "UI 반영":   PatternFill("solid", fgColor="DBEAFE"),
    "향후 구현":  PatternFill("solid", fgColor="FEF3C7"),
}
CATEGORY_FILLS = {
    "IaaS": PatternFill("solid", fgColor="EEF2FF"),  # indigo-50
    "PaaS": PatternFill("solid", fgColor="ECFDF5"),  # mint-50
}

# ─────────────────────────────────────────────────────────────
# 데이터: IaaS 기능
# 컬럼: (화면코드, 화면명, 기능ID, 기능명, 설명, UI요소, API, 자원유형, 상태)
# ─────────────────────────────────────────────────────────────
IAAS_FUNCS = [
    # IaaS 개요
    ("OVR", "/iaas (개요)", "IAAS.OVR.001", "계층 구조 시각화",
     "Center → Zone → Pool → Project 4계층 구조를 카드 그리드로 표시",
     "Card grid · Building2/Network 아이콘",
     "/api/iaas/centers · /api/iaas/zones · /api/iaas/pools",
     "Topology", "구현 완료"),
    ("OVR", "/iaas (개요)", "IAAS.OVR.002", "테넌트 쿼터 요약",
     "프로젝트별 vCPU/RAM/GPU 쿼터 사용량을 진행률 바로 표시",
     "Progress bar · StatCard",
     "/api/iaas/projects",
     "Tenant", "구현 완료"),
    ("OVR", "/iaas (개요)", "IAAS.OVR.003", "자원 분포 통계",
     "센터·풀·프로젝트별 카운트 표시",
     "Stat cards · Recharts",
     "/api/iaas/centers · /api/iaas/zones · /api/iaas/pools",
     "Stats", "구현 완료"),

    # VM 인스턴스
    ("VM", "/iaas/instances (VM 인벤토리)", "IAAS.VM.001", "VM 목록 조회",
     "전체 VM을 테이블로 조회 (이름·테넌트·상태·vCPU·RAM·호스트·가속기)",
     "Table · Skeleton · 검색 Input",
     "GET /api/iaas/instances?tenantId=&status=",
     "VM", "구현 완료"),
    ("VM", "/iaas/instances", "IAAS.VM.002", "상태별 집계 카드",
     "전체 / Running / Stopped / Error 4종 집계",
     "StatBlock × 4",
     "GET /api/iaas/instances",
     "VM", "구현 완료"),
    ("VM", "/iaas/instances", "IAAS.VM.003", "테넌트·상태 필터",
     "테넌트 Select + 상태 Select + VM 이름 검색 동시 적용",
     "Select × 2 · Search Input",
     "GET /api/iaas/instances?tenantId={id}&status={status}",
     "VM", "구현 완료"),
    ("VM", "/iaas/instances/[id] (VM 상세)", "IAAS.VM.004", "VM 상세 패널",
     "기본 정보·상태·IP·호스트·가속기·프로젝트 + CPU/MEM/Disk/Network sparkline",
     "Card · Recharts AreaChart/LineChart · HealthRing",
     "GET /api/iaas/instances/:id",
     "VM", "구현 완료"),
    ("VM", "/iaas/instances/[id]", "IAAS.VM.005", "라이프사이클 액션 — 시작/중지/재시작",
     "Play/Square/RefreshCw 버튼으로 상태 전환 (mock toast)",
     "Button × 3 · DropdownMenu",
     "POST /api/iaas/instances/:id/{start|stop|restart} (계획)",
     "VM", "UI 반영"),
    ("VM", "/iaas/instances/[id]", "IAAS.VM.006", "라이브 마이그레이션",
     "Move 액션 — 다른 호스트로 이동 다이얼로그",
     "Button · Dialog",
     "POST /api/iaas/instances/:id/migrate (계획)",
     "VM", "UI 반영"),
    ("VM", "/iaas/instances/[id]", "IAAS.VM.007", "VM 스냅샷 생성",
     "현재 디스크 상태를 이미지로 저장",
     "Button · Dialog",
     "POST /api/iaas/instances/:id/snapshots (계획)",
     "VM/Image", "UI 반영"),
    ("VM", "/iaas/instances/[id]", "IAAS.VM.008", "VM 콘솔 접속",
     "iframe 기반 noVNC 콘솔 자리 (Kubeflow Code Server와 동일 패턴)",
     "iframe placeholder",
     "WS /api/iaas/instances/:id/console (계획)",
     "VM", "향후 구현"),
    ("VM", "/iaas/instances/[id]", "IAAS.VM.009", "GPU 패스스루 표시",
     "VM에 할당된 가속기 카운트 + 종류 표시",
     "Card · Badge",
     "GET /api/infrastructure/servers/:id (acceleratorIds)",
     "Accelerator", "구현 완료"),
    ("VM", "/iaas/instances/[id]", "IAAS.VM.010", "VM 삭제",
     "삭제 액션 — 연결된 볼륨·네트워크 정리 후 가능",
     "Button (destructive)",
     "DELETE /api/iaas/instances/:id (계획)",
     "VM", "UI 반영"),

    # 이미지
    ("IMG", "/iaas/images (이미지·Flavor)", "IAAS.IMG.001", "이미지 목록 조회",
     "Ubuntu+CUDA · RHEL+Furiosa SDK · Rocky+RBLN Runtime · vLLM Serving 등 OS·런타임 통합",
     "Table · Tabs (이미지/Flavor)",
     "GET /api/iaas/images",
     "Image", "구현 완료"),
    ("IMG", "/iaas/images", "IAAS.IMG.002", "Glance 카탈로그 동기화",
     "OpenStack Glance에서 이미지 목록 새로고침",
     "Button (outline)",
     "POST /api/iaas/images/sync (계획)",
     "Image", "UI 반영"),
    ("IMG", "/iaas/images", "IAAS.IMG.003", "이미지 업로드",
     "QCOW2/VMDK/RAW 등 디스크 이미지 업로드 다이얼로그",
     "Dialog · File input · Form",
     "POST /api/iaas/images (계획)",
     "Image", "UI 반영"),
    ("IMG", "/iaas/images", "IAAS.IMG.004", "이미지 상세 Sheet",
     "OS·런타임·가속기 지원·크기·SHA256·생성자 표시",
     "Sheet · Detail rows",
     "GET /api/iaas/images/:id (계획)",
     "Image", "구현 완료"),
    ("IMG", "/iaas/images", "IAAS.IMG.005", "이미지로부터 VM 생성",
     "이미지 컨텍스트에서 자원 신청 위저드 호출",
     "Button · ResourceRequestWizard",
     "POST /api/iaas/instances (계획)",
     "VM/Image", "UI 반영"),
    ("IMG", "/iaas/images", "IAAS.IMG.006", "이미지 다운로드",
     "이미지 파일을 로컬로 다운로드",
     "Button (outline)",
     "GET /api/iaas/images/:id/download (계획)",
     "Image", "UI 반영"),
    ("IMG", "/iaas/images", "IAAS.IMG.007", "이미지 삭제",
     "이미지 카탈로그에서 제거",
     "Button (destructive)",
     "DELETE /api/iaas/images/:id (계획)",
     "Image", "UI 반영"),
    ("IMG", "/iaas/images (Flavor 탭)", "IAAS.IMG.008", "Flavor 목록",
     "vCPU + RAM + GPU 사양 조합 카탈로그 (e.g. m1.xlarge.gpu1)",
     "Table",
     "/api/iaas/flavors (fixture)",
     "Flavor", "구현 완료"),
    ("IMG", "/iaas/images (Flavor 탭)", "IAAS.IMG.009", "Flavor 생성",
     "신규 Flavor 정의 다이얼로그 (vCPU/RAM/GPU/Disk)",
     "Dialog · Form",
     "POST /api/iaas/flavors (계획)",
     "Flavor", "UI 반영"),

    # 네트워크
    ("NET", "/iaas/networks (네트워크)", "IAAS.NET.001", "네트워크 목록",
     "관리망 / 서비스망 / 데이터망 분류로 표시 (VLAN, CIDR)",
     "Table · Badge (class)",
     "GET /api/iaas/networks",
     "Network", "구현 완료"),
    ("NET", "/iaas/networks", "IAAS.NET.002", "네트워크 상세 Sheet — 서브넷·포트·보안·라우터·FIP 5탭",
     "네트워크 클릭 시 우측 Sheet — 서브넷/포트/보안 그룹/라우터/Floating IP 정보 통합 조회",
     "Sheet · Tabs × 5",
     "GET /api/iaas/networks/:id (계획)",
     "Network", "구현 완료"),
    ("NET", "/iaas/networks", "IAAS.NET.003", "서브넷 추가",
     "서브넷 CIDR · 게이트웨이 · DHCP 설정 입력",
     "Button · Dialog",
     "POST /api/iaas/networks/:id/subnets (계획)",
     "Subnet", "UI 반영"),
    ("NET", "/iaas/networks", "IAAS.NET.004", "Floating IP 할당",
     "외부 노출용 Floating IP를 인스턴스·포트에 할당",
     "Button · Dialog",
     "POST /api/iaas/floatingips (계획)",
     "FloatingIP", "UI 반영"),
    ("NET", "/iaas/networks", "IAAS.NET.005", "보안 그룹 규칙 편집",
     "Ingress/Egress 규칙 추가·삭제",
     "Button · Dialog",
     "PATCH /api/iaas/security-groups/:id (계획)",
     "SecurityGroup", "UI 반영"),
    ("NET", "/iaas/networks", "IAAS.NET.006", "네트워크 삭제",
     "연결된 포트가 없을 때 가능",
     "Button (destructive)",
     "DELETE /api/iaas/networks/:id (계획)",
     "Network", "UI 반영"),
    ("NET", "/iaas/networks", "IAAS.NET.007", "CIDR/IP 클립보드 복사",
     "Subnet CIDR · Floating IP를 클립보드에 복사",
     "Button (icon) · clipboard API",
     "(client only)",
     "Network", "구현 완료"),

    # 프로젝트
    ("PRJ", "/iaas/projects (프로젝트)", "IAAS.PRJ.001", "프로젝트 목록",
     "테넌트 카드 그리드 (ETRI · 오케스트로 · KETI · 경희대 등)",
     "Card grid · Avatar",
     "GET /api/iaas/projects",
     "Tenant", "구현 완료"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.002", "프로젝트 상세 — 개요/쿼터/멤버/자원 4탭",
     "프로젝트 정보·쿼터·멤버 수·소유 자원을 탭으로 분리 조회",
     "Sheet · Tabs × 4",
     "GET /api/iaas/projects/:id (계획)",
     "Tenant", "구현 완료"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.003", "프로젝트 생성 다이얼로그",
     "이름·코드·소유기관·연락처 입력 후 생성",
     "Dialog · Form (react-hook-form + zod)",
     "POST /api/iaas/projects (계획)",
     "Tenant", "UI 반영"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.004", "쿼터 변경 요청",
     "vCPU/RAM/GPU 쿼터 증가 요청 → 관리자 승인 워크플로",
     "Button · Dialog",
     "POST /api/iaas/projects/:id/quota-request (계획)",
     "Tenant/Quota", "UI 반영"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.005", "멤버 초대",
     "이메일로 사용자 초대 + 역할 지정",
     "Button · Dialog",
     "POST /api/iaas/projects/:id/members (계획)",
     "Member", "UI 반영"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.006", "멤버 제거",
     "프로젝트에서 사용자 제거",
     "Button (icon)",
     "DELETE /api/iaas/projects/:id/members/:userId (계획)",
     "Member", "UI 반영"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.007", "프로젝트 편집",
     "이름·설명·연락처 수정",
     "Button · Dialog",
     "PATCH /api/iaas/projects/:id (계획)",
     "Tenant", "UI 반영"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.008", "프로젝트 활동 로그",
     "프로젝트 단위 감사 로그 조회",
     "Button → /iam/audit?projectId=",
     "GET /api/iam/audit?projectId= (계획)",
     "Audit", "UI 반영"),
    ("PRJ", "/iaas/projects", "IAAS.PRJ.009", "프로젝트 삭제",
     "자원 정리 후에만 삭제 가능 (안전 검증)",
     "Button (destructive)",
     "DELETE /api/iaas/projects/:id (계획)",
     "Tenant", "UI 반영"),

    # 프로바이더 (센터/존/풀)
    ("PRV", "/iaas/providers (프로바이더)", "IAAS.PRV.001", "센터 목록",
     "물리 데이터센터(대전 본센터 · 판교 클라우드센터) 카드",
     "Card grid",
     "GET /api/iaas/centers",
     "Center", "구현 완료"),
    ("PRV", "/iaas/providers", "IAAS.PRV.002", "센터 추가",
     "센터명·코드·위치 입력",
     "Dialog · Form",
     "POST /api/iaas/centers (계획)",
     "Center", "UI 반영"),
    ("PRV", "/iaas/providers", "IAAS.PRV.003", "센터 상세 — 존·네트워크 2탭",
     "센터별 존 목록과 네트워크 구성 조회",
     "Sheet · Tabs × 2",
     "GET /api/iaas/centers/:id (계획)",
     "Center", "구현 완료"),
    ("PRV", "/iaas/providers", "IAAS.PRV.004", "존 추가",
     "센터 내 새로운 가용 영역 추가",
     "Button (outline)",
     "POST /api/iaas/zones (계획)",
     "Zone", "UI 반영"),
    ("PRV", "/iaas/providers", "IAAS.PRV.005", "자원풀(OpenStack 클러스터) 목록",
     "각 풀의 OpenStack 엔드포인트·버전·노드 수 표시",
     "Card grid",
     "GET /api/iaas/pools",
     "Pool", "구현 완료"),
    ("PRV", "/iaas/providers", "IAAS.PRV.006", "자원풀 등록",
     "Keystone Endpoint · 자격증명 · Region 입력",
     "Dialog · Form",
     "POST /api/iaas/pools (계획)",
     "Pool", "UI 반영"),
    ("PRV", "/iaas/providers", "IAAS.PRV.007", "자원풀 상세 — 노드·서비스·헬스 3탭",
     "풀 내 노드 / OpenStack 서비스(Nova·Neutron·Glance·Cinder) / 종합 헬스",
     "Sheet · Tabs × 3",
     "GET /api/iaas/pools/:id (계획)",
     "Pool", "구현 완료"),
    ("PRV", "/iaas/providers", "IAAS.PRV.008", "풀 연결 테스트",
     "Keystone 인증 + 서비스 endpoint 응답 확인",
     "Button (outline)",
     "POST /api/iaas/pools/:id/test (계획)",
     "Pool", "UI 반영"),
    ("PRV", "/iaas/providers", "IAAS.PRV.009", "풀 동기화",
     "풀 상태·메타데이터를 다시 가져옴",
     "Button (outline)",
     "POST /api/iaas/pools/:id/sync (계획)",
     "Pool", "UI 반영"),
    ("PRV", "/iaas/providers", "IAAS.PRV.010", "종합 헬스체크",
     "모든 OpenStack 서비스 정상 여부 일괄 확인",
     "Button",
     "POST /api/iaas/pools/:id/healthcheck (계획)",
     "Pool", "UI 반영"),
    ("PRV", "/iaas/providers", "IAAS.PRV.011", "풀 제거",
     "연결 자원 정리 후 풀 등록 해제",
     "Button (destructive)",
     "DELETE /api/iaas/pools/:id (계획)",
     "Pool", "UI 반영"),

    # 볼륨
    ("VOL", "/iaas/volumes (볼륨)", "IAAS.VOL.001", "볼륨 목록",
     "28개 샘플 — 이름·크기·타입(SSD/HDD/NVMe)·연결 VM·상태",
     "Table",
     "GET /api/iaas/volumes",
     "Volume", "구현 완료"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.002", "볼륨 생성",
     "빈 볼륨 / 이미지로부터 / 스냅샷에서 복원 3가지 모드 + Cinder type 선택",
     "Dialog · Select · Form",
     "POST /api/iaas/volumes (계획)",
     "Volume", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.003", "볼륨 상세 Sheet — 정보·스냅샷·액션·메타 4탭",
     "볼륨 정보·스냅샷 목록·액션 그리드·메타데이터(YAML) 통합",
     "Sheet · Tabs × 4",
     "GET /api/iaas/volumes/:id (계획)",
     "Volume", "구현 완료"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.004", "볼륨 크기 확장",
     "현재 크기에서 신규 크기로 확장 (축소 불가)",
     "Button · Dialog",
     "PATCH /api/iaas/volumes/:id (계획)",
     "Volume", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.005", "볼륨 스냅샷 생성",
     "현재 시점의 볼륨 상태를 스냅샷으로 저장",
     "Button",
     "POST /api/iaas/volumes/:id/snapshots (계획)",
     "Snapshot", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.006", "스냅샷으로부터 복원",
     "스냅샷을 선택해 새 볼륨으로 복원",
     "Button (ghost)",
     "POST /api/iaas/volumes (from snapshot, 계획)",
     "Volume/Snapshot", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.007", "VM에 볼륨 연결",
     "available 상태 볼륨을 VM에 attach",
     "Button (outline)",
     "POST /api/iaas/volumes/:id/attach (계획)",
     "Volume/VM", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.008", "VM에서 볼륨 분리",
     "in-use 상태 볼륨을 detach",
     "Button (outline)",
     "POST /api/iaas/volumes/:id/detach (계획)",
     "Volume/VM", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.009", "볼륨을 이미지로 변환",
     "현재 볼륨 상태를 새 Glance 이미지로 변환",
     "Button (outline)",
     "POST /api/iaas/volumes/:id/upload-image (계획)",
     "Volume/Image", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.010", "볼륨 삭제",
     "in-use면 거부 (안전 검증)",
     "Button (destructive)",
     "DELETE /api/iaas/volumes/:id (계획)",
     "Volume", "UI 반영"),
    ("VOL", "/iaas/volumes", "IAAS.VOL.011", "CSV 내보내기",
     "볼륨 목록 CSV 다운로드",
     "Button (outline)",
     "(client only)",
     "Volume", "UI 반영"),
]

# ─────────────────────────────────────────────────────────────
# 데이터: PaaS 기능
# ─────────────────────────────────────────────────────────────
PAAS_FUNCS = [
    # PaaS 개요
    ("OVR", "/paas (개요)", "PAAS.OVR.001", "클러스터 분포 표시",
     "mgmt + svc 2-tier 구조와 각 클러스터 카드 표시",
     "Card grid · Badge",
     "GET /api/v2/clusters (mgmt + svc)",
     "Cluster", "구현 완료"),
    ("OVR", "/paas (개요)", "PAAS.OVR.002", "워크로드 상태 분포",
     "Running/Pending/Failed 등 상태별 카운트 요약",
     "StatCard × N",
     "GET /api/paas/workloads",
     "Workload", "구현 완료"),
    ("OVR", "/paas (개요)", "PAAS.OVR.003", "리소스 사용량 요약",
     "전체 클러스터의 CPU/메모리/GPU 사용량 진행률",
     "Progress bar",
     "GET /api/paas/clusters",
     "Stats", "구현 완료"),

    # 클러스터
    ("CLU", "/paas/clusters", "PAAS.CLU.001", "관리 클러스터 카드",
     "mgmt-prod-dj — L0+L1+L2/L2b 통합 정보 (master, worker, K8s version, CNI)",
     "MgmtClusterCard",
     "GET /api/v2/clusters (kind=mgmt)",
     "Cluster", "구현 완료"),
    ("CLU", "/paas/clusters", "PAAS.CLU.002", "서비스 클러스터 카드",
     "svc-ai-prod, svc-edge-staging — L3(VM)+L4(K8s node), Magnum 생성 클러스터",
     "SvcClusterCard",
     "GET /api/v2/clusters (kind=svc)",
     "Cluster", "구현 완료"),
    ("CLU", "/paas/clusters", "PAAS.CLU.003", "클러스터 상태 표시",
     "master/worker 수, K8s 버전, CNI(Calico/Cilium), 상태",
     "Badge · Stat row",
     "GET /api/paas/clusters",
     "Cluster", "구현 완료"),
    ("CLU", "/paas/clusters", "PAAS.CLU.004", "클러스터 자원 사용량",
     "CPU/메모리/스토리지 사용률 진행률 바",
     "Progress · HealthRing",
     "GET /api/paas/clusters/:id",
     "Cluster", "구현 완료"),
    ("CLU", "/paas/clusters", "PAAS.CLU.005", "노드 리스트 표시",
     "각 클러스터 소속 노드 수와 ID 목록",
     "Card · Link",
     "GET /api/paas/clusters/:id",
     "Node", "구현 완료"),
    ("CLU", "/paas/clusters", "PAAS.CLU.006", "클러스터 생성 위저드",
     "Magnum 기반 새 서비스 클러스터 프로비저닝",
     "(Wizard placeholder)",
     "POST /api/v2/clusters (계획)",
     "Cluster", "향후 구현"),
    ("CLU", "/paas/clusters", "PAAS.CLU.007", "kubeconfig 다운로드",
     "클러스터별 kubectl 자격증명 파일 다운로드",
     "Button (계획)",
     "GET /api/paas/clusters/:id/kubeconfig (계획)",
     "Cluster", "향후 구현"),

    # 워크로드
    ("WL", "/paas/workloads (워크로드)", "PAAS.WL.001", "워크로드 목록",
     "Deployment/StatefulSet/DaemonSet 통합 목록 (15+ 샘플)",
     "Table · Badge (kind)",
     "GET /api/paas/workloads?clusterId=&kind=",
     "Workload", "구현 완료"),
    ("WL", "/paas/workloads", "PAAS.WL.002", "워크로드 검색·필터",
     "클러스터·네임스페이스·종류·이름 필터",
     "Select × 3 · Input",
     "GET /api/paas/workloads",
     "Workload", "구현 완료"),
    ("WL", "/paas/workloads/[id]", "PAAS.WL.003", "워크로드 상세",
     "Pod 목록·리소스 사용·이벤트 타임라인·롤아웃 히스토리",
     "Tabs · Recharts · Timeline",
     "GET /api/paas/workloads/:id",
     "Workload", "구현 완료"),
    ("WL", "/paas/workloads", "PAAS.WL.004", "레플리카 스케일",
     "현재 replicas를 원하는 수로 변경 (HPA 충돌 경고 포함)",
     "DropdownMenu · Dialog · Input",
     "PATCH /api/paas/workloads/:id/scale (계획)",
     "Workload", "UI 반영"),
    ("WL", "/paas/workloads", "PAAS.WL.005", "매니페스트 편집",
     "YAML 편집기로 워크로드 매니페스트 직접 수정",
     "DropdownMenu · YAML editor",
     "PATCH /api/paas/workloads/:id (계획)",
     "Workload", "UI 반영"),
    ("WL", "/paas/workloads", "PAAS.WL.006", "롤아웃 재시작",
     "kubectl rollout restart — 모든 Pod 재생성",
     "DropdownMenu item",
     "POST /api/paas/workloads/:id/rollout/restart (계획)",
     "Workload", "UI 반영"),
    ("WL", "/paas/workloads", "PAAS.WL.007", "이전 버전 롤백",
     "revision 5 → 4 형태로 이전 상태로 복원",
     "DropdownMenu item",
     "POST /api/paas/workloads/:id/rollout/undo (계획)",
     "Workload", "UI 반영"),
    ("WL", "/paas/workloads", "PAAS.WL.008", "Pod 셸 진입",
     "kubectl exec — 컨테이너 셸 터미널",
     "DropdownMenu item · (Terminal placeholder)",
     "WS /api/paas/pods/:id/exec (계획)",
     "Pod", "UI 반영"),
    ("WL", "/paas/workloads", "PAAS.WL.009", "워크로드 삭제",
     "finalizer 실행 후 제거",
     "DropdownMenu item (rose)",
     "DELETE /api/paas/workloads/:id (계획)",
     "Workload", "UI 반영"),

    # 서비스
    ("SVC", "/paas/services (Service/Ingress)", "PAAS.SVC.001", "서비스 목록",
     "ClusterIP/NodePort/LoadBalancer 종류별 표시",
     "Table · Badge (type)",
     "GET /api/paas/services",
     "Service", "구현 완료"),
    ("SVC", "/paas/services", "PAAS.SVC.002", "서비스 상세 Sheet — 포트·엔드포인트·셀렉터·YAML 4탭",
     "서비스 구성 요소를 탭으로 분리 조회",
     "Sheet · Tabs × 4",
     "GET /api/paas/services/:id (계획)",
     "Service", "구현 완료"),
    ("SVC", "/paas/services", "PAAS.SVC.003", "서비스 생성 다이얼로그",
     "이름·종류·셀렉터·포트 매핑 입력",
     "Dialog · Form",
     "POST /api/paas/services (계획)",
     "Service", "UI 반영"),
    ("SVC", "/paas/services", "PAAS.SVC.004", "YAML 편집",
     "서비스 매니페스트 직접 편집",
     "Button · YAML editor",
     "PATCH /api/paas/services/:id (계획)",
     "Service", "UI 반영"),
    ("SVC", "/paas/services", "PAAS.SVC.005", "외부 IP 접속",
     "LoadBalancer external IP 새 탭에서 열기",
     "Button (outline)",
     "(client only)",
     "Service", "구현 완료"),
    ("SVC", "/paas/services", "PAAS.SVC.006", "kubectl port-forward",
     "로컬 포트 포워딩 명령 생성",
     "Button",
     "POST /api/paas/services/:id/port-forward (계획)",
     "Service", "UI 반영"),
    ("SVC", "/paas/services", "PAAS.SVC.007", "서비스 삭제",
     "Service 리소스 삭제",
     "Button (destructive)",
     "DELETE /api/paas/services/:id (계획)",
     "Service", "UI 반영"),
    ("SVC", "/paas/services", "PAAS.SVC.008", "YAML 다운로드",
     "전체 Service 매니페스트 YAML 일괄 다운로드",
     "Button (outline)",
     "GET /api/paas/services?export=yaml (계획)",
     "Service", "UI 반영"),

    # 스토리지
    ("STO", "/paas/storage (PVC/PV/StorageClass)", "PAAS.STO.001", "PVC 목록",
     "Namespace · 이름 · StorageClass · 크기 · 상태 표시",
     "Tabs · Table",
     "GET /api/paas/pvcs (계획)",
     "PVC", "구현 완료"),
    ("STO", "/paas/storage", "PAAS.STO.002", "PV 목록",
     "물리 볼륨(PV) 목록 — 용량·바인딩 상태·Reclaim Policy",
     "Table",
     "GET /api/paas/pvs (계획)",
     "PV", "구현 완료"),
    ("STO", "/paas/storage", "PAAS.STO.003", "StorageClass 목록",
     "Provisioner · 파라미터 · 기본 여부",
     "Table · Badge (default)",
     "GET /api/paas/storage-classes (계획)",
     "StorageClass", "구현 완료"),
    ("STO", "/paas/storage", "PAAS.STO.004", "PVC 생성",
     "이름·StorageClass·접근 모드(RWO/ROX/RWX)·크기",
     "Dialog · Form",
     "POST /api/paas/pvcs (계획)",
     "PVC", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.005", "PVC 상세 Sheet — 정보·이벤트·사용 Pod·YAML 4탭",
     "PVC 정보·바인딩 이벤트·연결된 Pod·매니페스트",
     "Sheet · Tabs × 4",
     "GET /api/paas/pvcs/:id (계획)",
     "PVC", "구현 완료"),
    ("STO", "/paas/storage", "PAAS.STO.006", "PVC 크기 확장",
     "AllowVolumeExpansion=true인 StorageClass에서만 가능",
     "Button · Dialog",
     "PATCH /api/paas/pvcs/:id (계획)",
     "PVC", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.007", "PVC 스냅샷 생성",
     "VolumeSnapshot CRD 생성",
     "Button · Dialog",
     "POST /api/paas/volume-snapshots (계획)",
     "Snapshot", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.008", "PVC 삭제",
     "ReclaimPolicy에 따라 PV 운명 결정",
     "Button (destructive)",
     "DELETE /api/paas/pvcs/:id (계획)",
     "PVC", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.009", "PV YAML 보기",
     "PV 매니페스트 토스트로 조회",
     "Button (icon)",
     "GET /api/paas/pvs/:id (계획)",
     "PV", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.010", "StorageClass 상세",
     "Provisioner · 파라미터 · Reclaim Policy",
     "Sheet",
     "GET /api/paas/storage-classes/:id (계획)",
     "StorageClass", "구현 완료"),
    ("STO", "/paas/storage", "PAAS.STO.011", "StorageClass 기본으로 설정",
     "storageclass.kubernetes.io/is-default-class annotation 토글",
     "Button",
     "PATCH /api/paas/storage-classes/:id (계획)",
     "StorageClass", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.012", "StorageClass 편집/삭제",
     "사용 중 PVC 있으면 삭제 거부",
     "Button × 2",
     "PATCH/DELETE /api/paas/storage-classes/:id (계획)",
     "StorageClass", "UI 반영"),
    ("STO", "/paas/storage", "PAAS.STO.013", "PVC CSV 다운로드",
     "전체 PVC 목록 CSV 내보내기",
     "Button (outline)",
     "(client only)",
     "PVC", "UI 반영"),

    # ConfigMap / Secret
    ("CFG", "/paas/config (ConfigMap·Secret)", "PAAS.CFG.001", "ConfigMap 목록",
     "Namespace · 이름 · keys 수 · 변경시각",
     "Tabs · Table",
     "GET /api/paas/configmaps (계획)",
     "ConfigMap", "구현 완료"),
    ("CFG", "/paas/config", "PAAS.CFG.002", "Secret 목록 (마스킹)",
     "Namespace · 이름 · 종류(Opaque/TLS/Docker) · 값은 마스킹",
     "Tabs · Table",
     "GET /api/paas/secrets (계획)",
     "Secret", "구현 완료"),
    ("CFG", "/paas/config", "PAAS.CFG.003", "ConfigMap 생성 다이얼로그",
     "이름·네임스페이스·key/value 쌍 입력",
     "Dialog · Form",
     "POST /api/paas/configmaps (계획)",
     "ConfigMap", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.004", "Secret 생성 다이얼로그",
     "Secret 종류 선택 + 데이터 입력 (base64 자동)",
     "Dialog · Form · Select",
     "POST /api/paas/secrets (계획)",
     "Secret", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.005", "ConfigMap 상세 Sheet — Data·정보·사용 Pod·YAML 4탭",
     "key별 값 조회 + 사용 중인 Pod 추적",
     "Sheet · Tabs × 4",
     "GET /api/paas/configmaps/:id (계획)",
     "ConfigMap", "구현 완료"),
    ("CFG", "/paas/config", "PAAS.CFG.006", "ConfigMap key 편집",
     "선택된 key 값을 편집기에서 수정",
     "Button · Dialog",
     "PATCH /api/paas/configmaps/:id (계획)",
     "ConfigMap", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.007", "Pod 재시작 (변경 적용)",
     "ConfigMap 변경 후 연결된 Pod에 재시작 트리거",
     "Button",
     "POST /api/paas/configmaps/:id/restart-consumers (계획)",
     "ConfigMap/Pod", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.008", "Secret 상세 — 값 reveal/mask",
     "보안을 위해 기본 마스킹 · Eye 아이콘으로 일시 노출",
     "Sheet · Toggle",
     "GET /api/paas/secrets/:id (계획)",
     "Secret", "구현 완료"),
    ("CFG", "/paas/config", "PAAS.CFG.009", "Secret 값 클립보드 복사",
     "마스킹 상태에서도 복사 가능 + 토스트 알림",
     "Button (icon) · clipboard API",
     "(client only)",
     "Secret", "구현 완료"),
    ("CFG", "/paas/config", "PAAS.CFG.010", "Secret 로테이션 (Vault 연동)",
     "Vault에서 새 값을 가져와 Secret 갱신",
     "Button",
     "POST /api/paas/secrets/:id/rotate (계획)",
     "Secret", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.011", "Secret 편집",
     "값 직접 수정",
     "Button · Dialog",
     "PATCH /api/paas/secrets/:id (계획)",
     "Secret", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.012", "ConfigMap YAML 다운로드",
     "ConfigMap 매니페스트 일괄 YAML 다운로드",
     "Button (outline)",
     "GET /api/paas/configmaps?export=yaml (계획)",
     "ConfigMap", "UI 반영"),
    ("CFG", "/paas/config", "PAAS.CFG.013", "Secret 백업",
     "전체 Secret 백업 (관리자만)",
     "Button (outline)",
     "GET /api/paas/secrets/backup (계획)",
     "Secret", "UI 반영"),
]

# ─────────────────────────────────────────────────────────────
# 시트 작성
# ─────────────────────────────────────────────────────────────

COLS = ["분류", "화면 코드", "화면명", "기능 ID", "기능명", "설명", "UI 요소", "API 경로", "관련 자원", "상태"]
COL_WIDTHS = [8, 10, 32, 16, 40, 56, 36, 50, 14, 12]


def setup_columns(ws):
    for i, w in enumerate(COL_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def write_header(ws, row=3, title=None):
    if title:
        ws.cell(row=1, column=1, value=title).font = Font(
            name=FONT_NAME, size=14, bold=True, color="1B3A8A"
        )
    for ci, label in enumerate(COLS, start=1):
        c = ws.cell(row=row, column=ci, value=label)
        c.fill = HDR_FILL
        c.font = HDR_FONT
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[row].height = 28


def write_row(ws, row, category, item):
    screen_code, screen, fid, name, desc, ui, api, res, status = item
    vals = [category, screen_code, screen, fid, name, desc, ui, api, res, status]
    for ci, val in enumerate(vals, start=1):
        c = ws.cell(row=row, column=ci, value=val)
        c.border = BORDER
        c.alignment = WRAP
        c.font = CELL_FONT
        if ci == 1:  # 분류
            c.fill = CATEGORY_FILLS.get(category, PatternFill())
            c.font = Font(name=FONT_NAME, size=10, bold=True)
            c.alignment = CENTER
        elif ci == 2:  # 화면 코드
            c.font = Font(name="Consolas", size=9, color="64748B")
            c.alignment = CENTER
        elif ci == 4:  # 기능 ID
            c.font = ID_FONT
            c.alignment = Alignment(wrap_text=False, vertical="top", horizontal="left")
        elif ci == 8:  # API
            c.font = Font(name="Consolas", size=9, color="334155")
        elif ci == 10:  # 상태
            c.alignment = CENTER
            c.fill = STATUS_FILLS.get(status, PatternFill())
            c.font = Font(name=FONT_NAME, size=9, bold=True)
    # 행 높이
    longest = max(len(str(desc)), len(str(ui)), len(str(api)))
    ws.row_dimensions[row].height = max(32, min(110, 18 + longest // 4))


def add_section_sheet(wb, sheet_name, title, items_with_category):
    ws = wb.create_sheet(title=sheet_name[:31])
    setup_columns(ws)
    write_header(ws, row=3, title=title)
    for i, (cat, item) in enumerate(items_with_category, start=4):
        write_row(ws, i, cat, item)
    last_row = 3 + len(items_with_category)
    ws.auto_filter.ref = f"A3:{get_column_letter(len(COLS))}{last_row}"
    ws.freeze_panes = "A4"


# ─────────────────────────────────────────────────────────────
# 표지·범례·집계
# ─────────────────────────────────────────────────────────────
def add_cover(wb):
    ws = wb.create_sheet(title="표지·범례·집계", index=0)
    for ci, w in enumerate([22, 14, 14, 14, 14], start=1):
        ws.column_dimensions[get_column_letter(ci)].width = w

    ws["A1"] = "openKcloud CMP — IaaS / PaaS 기능 명세서"
    ws["A1"].font = Font(name=FONT_NAME, size=18, bold=True, color="1B3A8A")
    ws["A2"] = "현재 mockup(v1.0) 기준 · OpenStack(IaaS) + Kubernetes(PaaS) 통합 관리"
    ws["A2"].font = Font(name=FONT_NAME, size=12, bold=True, color="475569")
    ws["A3"] = "작성: 오케스트로(주) · 2026.06.04 · 대상 저장소: github.com/YunHoYoung-okestro/openkcloud"
    ws["A3"].font = Font(name=FONT_NAME, size=10, color="64748B")

    # 범례
    ws["A5"] = "상태 범례"
    ws["A5"].font = Font(name=FONT_NAME, size=12, bold=True)

    legends = [
        ("구현 완료", "데이터 조회·표시·시각화가 mockup에서 실제로 동작", "DCFCE7"),
        ("UI 반영", "버튼·다이얼로그·폼이 보이고 toast로 시연 가능. 실제 백엔드 연동은 향후",  "DBEAFE"),
        ("향후 구현", "명세상 자리는 마련되어 있으나 위저드·터미널 등 구체 UI 미반영", "FEF3C7"),
    ]
    for i, (label, desc, color) in enumerate(legends, start=6):
        c = ws.cell(row=i, column=1, value=label)
        c.fill = PatternFill("solid", fgColor=color)
        c.font = Font(name=FONT_NAME, size=10, bold=True)
        c.alignment = CENTER
        c.border = BORDER
        d = ws.cell(row=i, column=2, value=desc)
        d.alignment = WRAP
        d.font = CELL_FONT
        ws.merge_cells(start_row=i, start_column=2, end_row=i, end_column=5)
        d.border = BORDER
        ws.row_dimensions[i].height = 22

    # 카테고리별 집계
    ws["A10"] = "카테고리별 기능 집계"
    ws["A10"].font = Font(name=FONT_NAME, size=12, bold=True)

    headers = ["화면 그룹", "총 건수", "구현 완료", "UI 반영", "향후 구현"]
    for ci, label in enumerate(headers, start=1):
        c = ws.cell(row=11, column=ci, value=label)
        c.fill = HDR_FILL
        c.font = HDR_FONT
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[11].height = 26

    # 화면 그룹별 함수
    GROUPS = [
        ("IaaS · 개요", [f for f in IAAS_FUNCS if f[0] == "OVR"]),
        ("IaaS · VM 인스턴스", [f for f in IAAS_FUNCS if f[0] == "VM"]),
        ("IaaS · 이미지·Flavor", [f for f in IAAS_FUNCS if f[0] == "IMG"]),
        ("IaaS · 네트워크", [f for f in IAAS_FUNCS if f[0] == "NET"]),
        ("IaaS · 프로젝트", [f for f in IAAS_FUNCS if f[0] == "PRJ"]),
        ("IaaS · 프로바이더", [f for f in IAAS_FUNCS if f[0] == "PRV"]),
        ("IaaS · 볼륨", [f for f in IAAS_FUNCS if f[0] == "VOL"]),
        ("PaaS · 개요", [f for f in PAAS_FUNCS if f[0] == "OVR"]),
        ("PaaS · 클러스터", [f for f in PAAS_FUNCS if f[0] == "CLU"]),
        ("PaaS · 워크로드", [f for f in PAAS_FUNCS if f[0] == "WL"]),
        ("PaaS · 서비스", [f for f in PAAS_FUNCS if f[0] == "SVC"]),
        ("PaaS · 스토리지", [f for f in PAAS_FUNCS if f[0] == "STO"]),
        ("PaaS · Config·Secret", [f for f in PAAS_FUNCS if f[0] == "CFG"]),
    ]

    row = 12
    tot = {"all": 0, "done": 0, "ui": 0, "fut": 0}
    for name, items in GROUPS:
        done = sum(1 for x in items if x[-1] == "구현 완료")
        ui_only = sum(1 for x in items if x[-1] == "UI 반영")
        fut = sum(1 for x in items if x[-1] == "향후 구현")
        ws.cell(row=row, column=1, value=name).font = CELL_FONT
        ws.cell(row=row, column=2, value=len(items)).font = CELL_FONT
        ws.cell(row=row, column=3, value=done).font = CELL_FONT
        ws.cell(row=row, column=4, value=ui_only).font = CELL_FONT
        ws.cell(row=row, column=5, value=fut).font = CELL_FONT
        for ci in range(1, 6):
            cell = ws.cell(row=row, column=ci)
            cell.border = BORDER
            cell.alignment = CENTER if ci > 1 else Alignment(
                wrap_text=True, vertical="center", horizontal="left"
            )
        tot["all"] += len(items)
        tot["done"] += done
        tot["ui"] += ui_only
        tot["fut"] += fut
        row += 1

    # 합계 — 리터럴 값 (Windows 환경에서 LibreOffice 수식 재계산 없이도 즉시 표시)
    sum_row = row
    ws.cell(row=sum_row, column=1, value="합계")
    ws.cell(row=sum_row, column=2, value=tot["all"])
    ws.cell(row=sum_row, column=3, value=tot["done"])
    ws.cell(row=sum_row, column=4, value=tot["ui"])
    ws.cell(row=sum_row, column=5, value=tot["fut"])
    for ci in range(1, 6):
        cell = ws.cell(row=sum_row, column=ci)
        cell.fill = PatternFill("solid", fgColor="F1F5F9")
        cell.border = BORDER
        cell.font = Font(name=FONT_NAME, size=10, bold=True)
        cell.alignment = CENTER if ci > 1 else Alignment(
            wrap_text=True, vertical="center", horizontal="left"
        )

    # 반영률
    ws.cell(row=sum_row + 2, column=1,
            value=f"전체 반영률 (구현+UI): {(tot['done'] + tot['ui']) / tot['all'] * 100:.1f}%").font = Font(
        name=FONT_NAME, size=11, bold=True, color="1B3A8A"
    )
    ws.cell(row=sum_row + 3, column=1,
            value=f"구현 완료율: {tot['done'] / tot['all'] * 100:.1f}%").font = Font(
        name=FONT_NAME, size=10, color="047857"
    )

    # 안내 노트
    ws.cell(row=sum_row + 5, column=1, value="시트 안내").font = Font(name=FONT_NAME, size=12, bold=True)
    notes = [
        "• 전체 기능 — IaaS·PaaS 전체 기능을 한 시트에서 필터·검색",
        "• IaaS 기능 명세 — OpenStack 자원(센터/풀/VM/이미지/네트워크/볼륨/프로젝트) 기능만",
        "• PaaS 기능 명세 — Kubernetes 자원(클러스터/워크로드/서비스/스토리지/Config) 기능만",
        "• 모든 시트에 자동 필터·첫 행 고정 적용 — 화면 코드별, 상태별, 자원 유형별 빠르게 조회 가능",
    ]
    for i, note in enumerate(notes, start=sum_row + 6):
        c = ws.cell(row=i, column=1, value=note)
        c.font = CELL_FONT
        c.alignment = WRAP
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=5)


# ─────────────────────────────────────────────────────────────
# main
# ─────────────────────────────────────────────────────────────
def main():
    wb = Workbook()
    wb.remove(wb.active)

    add_cover(wb)

    # 전체 통합 시트
    all_items = [("IaaS", f) for f in IAAS_FUNCS] + [("PaaS", f) for f in PAAS_FUNCS]
    add_section_sheet(wb, "전체 기능", "IaaS · PaaS 통합 기능 명세 (필터·검색용)", all_items)

    # IaaS 전용 시트
    iaas_items = [("IaaS", f) for f in IAAS_FUNCS]
    add_section_sheet(wb, "IaaS 기능 명세", "IaaS 기능 명세 — OpenStack 기반", iaas_items)

    # PaaS 전용 시트
    paas_items = [("PaaS", f) for f in PAAS_FUNCS]
    add_section_sheet(wb, "PaaS 기능 명세", "PaaS 기능 명세 — Kubernetes 기반", paas_items)

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "IaaS_PaaS_기능명세서.xlsx")
    wb.save(out_path)


if __name__ == "__main__":
    main()
