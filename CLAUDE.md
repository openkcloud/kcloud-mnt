@AGENTS.md

# openKcloud CMP Mockup

IITP-2025-035 「AI반도체 클라우드 플랫폼(openKcloud)」 과제에서 오케스트로가 담당하는 kcloud-mnt(통합 관리 포털) UI 목업. Next.js 16 App Router, MSW 목업 데이터, Netlify 정적 배포.

## 시작 전 반드시 읽을 것
- `HANDOFF.md` — 완전 인계 문서. 프로젝트 정체성, 스프린트 이력, ETRI 피드백 44건 상태, **결정 사항 이력(§4)**, 남은 작업(§5), 코드 패턴(§7)
- `README.md` — ETRI 260615 피드백 반영 매트릭스(44건)와 페이지 인벤토리
- `MAC_SETUP.md` — Mac 환경 절차, 트러블슈팅
- 과제 배경(컨소시엄, 요구사항 SFR.MNT, 정량지표, 설계서): `~/claude/kcloud-code-project/docs/035_openkcloud_knowledge.md`

## 핵심 규칙
- **스코프 결정을 되돌리지 않는다** (HANDOFF §4 → **§4-2 260702 회의록이 우선**): 네트워크·볼륨·키페어·라우터·보안그룹·FIP 생성은 관리자 권한(사용자는 조회·선택), 볼륨은 Flavor 선택 시 자동 생성, 공급자 관리 메뉴 삭제(헬스체크·스토리지 자원풀은 인프라 관리 탭), 사용자는 클러스터 신청만(관리자 승인·Magnum 5단계), SLO 제외, OpenShift 제외, `/ai-accelerators` 제거 유지, 권장조치·AIOps 기능은 최종 형상 태그
- **포털 형상**: 2차년도 시범서비스 / 최종 형상은 `src/lib/scope.ts`의 `FEATURES`로 관리. 메뉴는 `nav.ts` `feature` 필드, 화면 안 기능은 `<FeatureGate id>`. 새 기능을 만들면 회의록·SFR 근거로 scope를 정해 FEATURES에 등록한다. 기본 분류: 회의록에서 논의된 기능 외는 최종 형상
- **빌드는 Webpack** (`next build --webpack`). Turbopack은 `~` 문자 파일명으로 Netlify 404 유발
- **설명문 톤**: 평어체(`~한다`), dry, 강조 부사 금지(`즉시`, `한눈에`, `매우`). `docs/generate_iaas_paas_spec.py`의 `to_dry()` 참조
- 액션 피드백은 `sonner` toast, 페이지 상단은 `PageHeader`, 데이터는 `src/lib/api.ts`의 TanStack Query 훅 + `src/mocks/handlers/`
- 로그인 계정: `admin/admin`(최현화, ETRI), `user/user`(윤호영, 오케스트로). 사이드바는 `src/lib/nav.ts`의 `getNavByRole`
- 아이콘: lucide-react v1.x. Slack은 `MessageSquare`, GitHub은 `src/components/icons.tsx` 커스텀 SVG

## 실행·배포
```bash
npm install
npm run dev        # http://localhost:3000 (사용 중이면 3001)
npm run build      # → out/
./deploy.sh        # Netlify CLI 배포 (첫 실행 시 브라우저 로그인 1회)
```

## 변경 요구사항 대비표·변경 표시 (`/changes`, 2026-09-15 정리)
- 산출물 4종: ① 초기 전달본 v1.0 스냅샷 `public/versions/v1.0/`(`4bf38da`) ② 반영본 v2.0(작업 트리) ③ `docs/변경요구사항_대비표.md` ④ 헤더 "변경 표시" + `/changes`
- **단일 원천 `src/lib/change-requests.ts`**: CR 코드(`CR-<영역>-<번호>`), 출처(ETRI-260615/MTG-260702/WS-260828/OKE-260914)와 항목 참조, 초기/반영본, 이력, 형상 태그, 결정 사안. 새 요구사항은 여기 추가 → 화면 영역을 `<ChangeMark ids>`로 감싸기 → `node scripts/export-change-requests.mjs`로 문서 재생성
- 버전 메타는 `src/lib/versions.ts`(INITIAL_VERSION v1.0, CURRENT_VERSION v2.0). 스냅샷 추가는 `scripts/build-version-snapshot.sh <id> <commit>`, dev 전용 rewrite는 HANDOFF.md 참조

## 남은 작업 (HANDOFF §5)
1. 이노그리드 대기 6건(#3·4·5·7·8·9): 대체 지표·히트맵 API·트레이스 정의·로그 UI 제안 수신 후 `/monitoring/*` 자리표시자 교체
2. 마켓플레이스 애플리케이션 레벨 세부(7/15 분과 워크샵 결과), 8월 워크샵 피드백, AI 모델 분석(AIOps) 하반기 구체화 → v1.3
3. #2 정기 검토 채널, #43 스토리지 명세 갱신(문서)

## 주요 파일
`src/lib/{nav,auth,api,types,model-zoo}.ts` · `src/mocks/{fixtures.ts,handlers/}` · `src/components/{app-sidebar,page-header,resource-request-wizard}.tsx` · `src/app/(portal)/{dashboard,monitoring,iaas,paas,ai-development,catalog,iam,resource-map,topology,infrastructure}` · `docs/*.xlsx` + `generate_*.py`
