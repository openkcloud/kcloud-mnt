# 인계 문서 (HANDOFF) — openKcloud CMP Mockup

> **목적**: 다른 Claude 세션(Mac Mini 등)이 이 저장소를 clone 후 **컨텍스트를 100% 복원**하고 즉시 이어서 작업할 수 있도록 하는 완전 인계.
> **기준 시점**: 2026-09-14 · 최신 커밋 `112a6d6` + 미커밋 작업(버전 이력 · 260702 회의록 반영, v1.2)

---

## 0. 첫 30초에 파악할 것

- **누구**: 오케스트로(주) 윤호영(hy.yun@okestro.com)이 개발
- **뭐**: 정부 IITP R&D 과제 "AI반도체 클라우드 플랫폼" CMP UI 목업 (Next.js)
- **어디**: https://github.com/YunHoYoung-okestro/openkcloud (`main`)
- **왜**: ETRI 260615 검토 의견 반영 후 시연·평가 자료로 사용
- **지금 진행률**: **30/44건 반영 완료 (68%)**, 이노그리드 대기 6건 제외 실질 92%. **260702 회의록 결정이 §4의 v1.1 결정 일부를 대체함(§4-2)**

---

## 1. 프로젝트 정체성

**정체성**: openKcloud CMP는 이종 AI반도체(GPU·NPU·PIM·HBM-PIM)를 단일 콘솔에서 관리하는 CMP(Cloud Management Platform) UI 목업. OpenStack(IaaS) + Kubernetes(PaaS) + Kubeflow(AI 개발환경) + Rebellions ModelZoo(마켓플레이스) 통합.

**주요 참여기관**:
- **오케스트로(주)**: 포탈 UI·통합 관리 프레임워크 (본 저장소 담당)
- **이노그리드**: 옵저버빌리티 데이터·API (모니터링·트레이스)
- **ETRI**: 검토·명세 · 자원할당 프레임워크
- **KETI**: 최적화 알고리즘
- **경희대**: 초거대 AI 클라우드

**스택** (변경 시 참고):
- Next.js 16 (App Router · **Webpack build** — Turbopack 아님, Netlify 배포 시 필터 문자 이슈로 전환)
- React 19 · TypeScript · Tailwind 4 · shadcn/ui (New York)
- TanStack Query v5 · Zustand · react-hook-form · zod
- MSW v2 (Service Worker 목업, `src/mocks/`)
- Recharts + 자체 viz 컴포넌트
- Netlify (정적 export 배포)

---

## 2. 현재까지 완료된 작업 (스프린트 8건 + 정리 2건)

| 순서 | 커밋 | 스프린트 | ETRI 대응 § | 주요 파일 |
|--:|---|---|---|---|
| 1 | `47139b3` | 사이드바 역할 분기 + 대시보드 옵저버빌리티 바로가기 | §3 | `src/lib/nav.ts`, `src/components/app-sidebar.tsx`, `src/app/(portal)/dashboard/page.tsx` |
| 2 | `1bede22` | IaaS 자원 관리 (보안그룹·키페어·라우터 신설 + FIP 회수·해제) | §4.A | `src/app/(portal)/iaas/{security-groups,keypairs,routers}/page.tsx`, `iaas/networks/page.tsx` |
| 3 | `5436795` | PaaS 완성도 (워크로드 생성·PV/SC 관리자·Ingress 관계) | §4.B, §8.i | `src/app/(portal)/paas/{workloads,storage,services}/page.tsx` |
| 4 | `99e9cfa` | 마켓플레이스 시그니처 시나리오 + 4단계 배포 위저드 | §5 | `src/app/(portal)/catalog/page.tsx` |
| 5 | `755af71` | AI 개발환경 UX (8단계 흐름·YAML 업로드·HPO·MLPerf·TTFT/TPOT/E2E) | §6 | `src/app/(portal)/ai-development/{page,pipelines,experiments,model-insights}` |
| 6 | `eba9349` | IAM 인터랙티브 권한 매트릭스 (Switch + 커스텀 권한) | §7 | `src/app/(portal)/iam/roles/page.tsx` |
| 정리 | `dc05fee` | 스코프 제외 — `/ai-accelerators` 페이지 제거 + 네트워크 생성 버튼 제거 | §4.A.iii, §4.A.v (트랙 D) | `nav.ts`, dashboard QuickLink, 여러 참조 파일 |
| 하향 | `91cf747` | 권장조치 자동 적용 → 정보 제공 수준으로 하향 | §2.B.i | `src/app/(portal)/monitoring/insights/page.tsx` |
| 트랙B | `248cd51` | SLO 제외 + 알람 CRUD + OpenShift 제외 + 생성 주체 명시 | §2.E, §4.A | `monitoring/alerts`, `iaas/{providers,networks,volumes}`, `nav.ts` |
| 문서 | `477eac9` | README에 피드백 반영 매트릭스 + 프로젝트 개요 정리 | — | `README.md` |
| 이관 | `88970df` | Mac 이관 가이드 + `deploy.sh` (macOS 배포) | — | `MAC_SETUP.md`, `deploy.sh` |
| CR체계 | (Mac, 2026-09-15) | **산출물 4종 정리** — 변경 요구사항 코드(CR) 대비표 59건(`src/lib/change-requests.ts` → `docs/변경요구사항_대비표.md`), `/changes` 페이지(코드별 상세·초기 스냅샷 비교), 헤더 "변경 표시" 모드(ChangeMark 배지·패널·상세 시트), 2차 워크샵 반영(가속기 공통 지표 6종 CR-OBS-04, 이상감지 정책 6종 CR-OBS-11, 워크로드 정책 OPA 탭 CR-IAM-03, 비용 Open API 초안 CR-IAM-04, 스케줄링 힌트 CR-PAAS-07, ETRI Chatbot 연계 CR-MKT-03). 버전은 v1.0 초기 / v2.0 반영본으로 단순화 | 회의록·워크샵 | `src/lib/{change-requests,change-mode,versions}.ts`, `src/components/{change-mark,change-panel}.tsx`, `src/app/(portal)/changes/page.tsx`, `scripts/export-change-requests.mjs` |
| 회의반영 | (Mac, 2026-09-14) | **260702 회의록 반영 (v1.2)** — 포털 형상 설정(`/settings`, 2차년도/최종 형상 프리셋 + 기능 12개 토글), 관리자 사이드바에 "네트워크·볼륨·서비스 구성" 섹션, 네트워크·볼륨·키페어·라우터·보안그룹·FIP 관리자 권한, 공급자 관리 삭제 → 인프라 관리 탭(헬스체크 052·스토리지 자원풀 048), 클러스터 사용자 신청 + 관리자 승인·Magnum 5단계, 자원 신청 위저드 재정비, 마켓 앱 레벨(최종 형상), 옵저버빌리티 회의 결과 표기·SLO 문구 정리, v1.1 스냅샷 | 회의록 2.1~2.8 | `src/lib/scope.ts`, `src/components/feature-gate.tsx`, `src/lib/nav.ts`, `src/app/(portal)/settings/page.tsx`, `paas/clusters/page.tsx`, `infrastructure/servers/page.tsx`, `iaas/{networks,volumes,keypairs,routers,security-groups}`, `catalog/page.tsx`, `resource-request-wizard.tsx`, `monitoring/*`, `public/versions/v1.1/` |
| 버전 | (Mac, 2026-09-07) | **목업 버전 이력·변경 비교 페이지** `/versions` — 버전 카드(v1.0/v1.1/v1.2 예정) → 메뉴별 신규·변경·삭제·대기 배지 → 이전/이후 상세 → v1.0 정적 스냅샷과 현재 화면 iframe 나란히 비교. 사이드바 "목업 관리" 섹션 + 헤더 배지 | — | `src/lib/versions.ts`, `src/app/(portal)/versions/page.tsx`, `scripts/build-version-snapshot.sh`, `public/versions/v1.0/`(16MB 스냅샷), `next.config.ts`(dev rewrite), `public/_headers` |

---

## 3. ETRI 260615 피드백 44건 — 현재 상태

**진척 요약** (README와 동일 · 참고용):
- ✅ 반영 완료: 28건 (64%)
- 🟡 부분 반영: 5건 (11%)
- ⚙️ 이노그리드 대기: 6건 (14%)
- ❌ 스코프 제외: 4건 (9%)
- 📝 명세 갱신: 1건 (2%)
- ➖ 이슈 없음: 1건 (2%)

**전체 44건 매트릭스는 `README.md`의 §"ETRI 260615 피드백 반영 현황" 참조**.
**원본 PDF**: `H:\내 드라이브\정부R&D과제(수행)\★16-2. AI반도체 클라우드 플랫폼 구축 및 최적화 기술 개발\10. 목업자료\ETRI 피드백 자료\260615_openKcloud Portal 검토 의견_v1.0.pdf` (Mac에서는 Google Drive 경로).

**피드백 정리 xlsx**: 같은 폴더의 `ETRI_피드백_정리_260615.xlsx` (44행 매트릭스, 오케스트로가 만든 조치사항 초안 포함).

---

## 4. 결정 사항 이력 (트랙 B — 무엇을 왜 그렇게 결정했나)

다른 Claude가 결정 배경을 알아야 스코프를 흔들지 않는다.

| # | 항목 | 최종 결정 | 결정 이유 |
|--:|---|---|---|
| §2.B.i | 권장조치 자동 적용 | **정보 제공까지만, 자동 적용은 차차년도** | 이노그리드는 정보 제공까지만 담당. 자동 적용은 과업 범위 외. |
| §2.E SLO | SLO 정의 | **제외** | SLO를 이번 과제에 도입하지 않기로 결정. nav 라벨 "알람"으로. |
| §2.E 알람 CRUD | 알람 관리 기능 | **반영** | 알람 정책·채널 CRUD UI 신설. |
| §4.A.i.2 네트워크 주체 | 네트워크 생성 주체 정의 | **반영 (관리자/사용자 이중 시나리오)** | 관리자: 공용·외부망, 사용자: 프로젝트 전용 내부 네트워크. |
| §4.A.i.4 볼륨 사용자 생성 | 사용자 직접 생성 여부 | **반영 (사용자 자율)** | 관리자 승인 없이 프로젝트 쿼터 내 CRUD 가능. |
| §4.A.vi OpenShift | 지원 범위 | **제외** | 자원풀 유형에서 OpenShift 옵션 삭제. |
| §4.A.iii 네트워크 생성(C) | 명세 없는 UI | **스코프 제외** | 버튼 제거, 안내 문구로 대체. |
| §4.A.v AI반도체 관리 | 명세 없는 UI | **스코프 제외** | `/ai-accelerators` 페이지 전체 삭제. 단, fixture(accelerators)와 VM/워크로드/마켓의 가속기 정보 표시는 유지 (참조 안 다침). |

### 4-2. 260702 포털 기능 검토 회의록 결정 (2026-09-14 반영 · 위 표보다 우선)

회의록: `~/Downloads/260702_AI반도체클라우드플랫폼_포털기능검토_회의록_v1.1.docx` (ETRI 최현화 외 4, 이노그리드 김바울 외 1, 오케스트로 이은경 외 2 · 2026.07.02). 사용자가 추가 논의를 반영한 v1.1. **아래 결정이 위 §4 표의 같은 항목을 대체한다.**

| 회의록 | 최종 결정 | 대체되는 §4 결정 | 반영 |
|---|---|---|---|
| 2.5 네트워크 | **네트워크 생성은 관리자 기능**, 사용자는 관리자가 만든 네트워크 선택 | 네트워크 주체 이중 시나리오 | 사용자 생성 버튼 제거, FIP 액션 관리자 |
| 2.5 스토리지 | **볼륨은 Flavor 선택 시 자동 생성**, 기존 스토리지 재사용은 고도화(최종 형상) | 볼륨 사용자 자율 CRUD | 배너 교체, 생성·삭제 관리자, 재사용은 `iaas.volumes.reuse` 최종 형상 |
| 2.5 권한 | 키페어·라우터·Floating IP·보안그룹 생성은 **관리자 권한** (키페어 포함, 2026-09-14 확인) | — | 4개 화면 관리자 전용, 사용자는 조회·선택 |
| 2.5 공급자 | **공급자 관리 메뉴 전체 삭제**(단일 클러스터). 052 헬스체크·048 스토리지 자원풀은 인프라 관리 탭으로(2026-09-14 확인) | OpenShift 옵션 제거(페이지 유지) | `/iaas/providers` 삭제, `/infrastructure/servers` 3탭 |
| 2.6 클러스터 | **사용자는 클러스터 직접 생성 불가**, VM 수·Flavor·가속기 입력해 신청, 관리자 승인 후 Magnum 5단계 | §5 "클러스터 생성 위저드" 계획 | 사용자 신청 위저드 + 관리자 승인·진행 화면 |
| 2.2 메뉴 | 관리자 메뉴에 **네트워크·볼륨·서비스 구성** 섹션. AI 개발환경·운영은 유지(2026-09-14 확인) | 관리자 순서(v1.1) | `nav.ts` SECTION_CONFIG_ADMIN |
| 2.1·2.4 형상 | **2차년도 과업 외 기능은 최종 형상 설계안에만, 시범서비스 포털에서 제외**. 회의록에서 논의된 기능 외는 최종 형상(2026-09-14 확인) | — | `src/lib/scope.ts` FEATURES + `/settings` 포털 형상 |
| 2.1 모델 분석 | AI 모델 분석은 AIOps 성격, **오케스트로 과업**, 하반기 구체화 | 권장조치 정보 제공까지 | 자동 진단·권장 조치·핫스팟 최종 형상 태그 |
| 2.1 알람 | 알람 임계치 필요(반영됨). **SLO 포함 여부는 오케스트로 정리** → 제외 유지 | SLO 제외 | 잔여 SLO 문구를 목표 지연 1초로 |
| 2.3 마켓 | **애플리케이션 레벨 실행**까지. 7/15 분과 워크샵에서 구체화 | — | 앱 카드 3종(최종 형상). 워크샵 결과는 미반영 |
| 2.8 패키징 | 오케스트로 미고려, **ETRI 개발 시 이미지 메뉴 연동** | #44 협의 필요 | 패키징 탭 자리(최종 형상), #44 종결 |
| 2.1 이노그리드 | P99·에러율·RPS 대체 지표 검토, 히트맵 API 수정 검토, 트레이스+서비스 흐름 통합 정의, 로그 UI 목업 제안 | 이노그리드 대기 6건 | 화면에 회의 결과 표기(자리표시자 유지) |

---

## 5. 남은 작업 — 우선순위별

### ✅ 2026-09-14 완료 (v1.2)
#16 자원 신청 위저드 재정비, #25+#27 클러스터 신청(사용자)·승인·Magnum 5단계(관리자) — 260702 회의록 2.5·2.6 흐름으로 구현. #44는 ETRI 연동으로 종결.

### 🟡 부분 반영 2건 — 문서·프로세스
| # | 항목 | 비고 |
|--:|---|---|
| 43 | 스토리지 명세 갱신 | 문서 담당 몫. 회의록 2.8 "명세 반영완료 vs 사이트 미지원" 불일치 정리 포함 |
| 2 | 명세↔목업 정기 검토 채널 | 회의록 3.2: 명세서는 오케스트로 내부 문서, 공유 여부 내부 판단 |

### ⚙️ 이노그리드 대기 6건 — 오케스트로 몫 아님
3·4·5·7·8·9번. 회의록 3.1: 대체 지표 검토, 히트맵 API 수정, 트레이스+서비스 흐름 통합 정의, 로그 UI 목업 제안. 받으면 `/monitoring/*` 자리표시자 교체.

### 🔜 다음 버전(v1.3) 후보 — 2차 워크샵(2026.08.27~28) 반영
회의록·발표자료: `~/Downloads/AI반도체 클라우드 2차워크샵 자료/` (요약은 `~/claude/kcloud-code-project/docs/035_openkcloud_knowledge.md` §7.1). 오케스트로는 워크샵 발표 없이 메일 공유(8/31~9/4), **9/16 14:00 오케스트로 회의**에서 연구내용별 진행현황·2차년도 결과물·openKcloud 통합 현황 제시.
- **옵저버빌리티 화면 정합**: 이노그리드 Monitor API v2(13 도메인 116 API, `/clusters/{c}/nodes/{n}/power`, `/monitoring/power/summary` 등)와 공통 지표 6종(온도·전력·사용률·메모리 사용량·메모리 총량·health) + 파생 2종(전력효율·TDP 대비)으로 `/monitoring` 카드·히트맵 항목을 맞춘다. 2차년도 옵저버빌리티 2종 = Loki 실시간 로그 + 정책 기반 이상감지(Alertmanager) → `/monitoring/logs`·`/monitoring/alerts`가 대상. 트레이스(Tempo)는 3차년도 로드맵 → 현재 최종 형상 태그 유지. 이상감지 시나리오 6종(알림 묶기·상대 비교·알람 억제·시간대 baseline·spike 무시·NPU 신규 지표)을 알람 정책 예시로 반영 가능
- **화면 책임 경계**: 이노그리드가 검증용 옵저버빌리티 UI를 프로토타입으로 구현(발표자료 p.32). 포털은 iframe 임베드 또는 API 직접 소비 중 결정 필요 — 9/16 회의 안건
- **IAM**: 공인인증시험(10/15~11/10, ETRI·이노그리드·오케스트로) 대상 정량지표 "접근제어 2종(RBAC + Workload 기반)" → `/iam/roles`에 Workload 기반 정책(OPA) 화면 필요
- **KETI 논의사항 ⑥** "오케스트로·KETI: 개방형 인터페이스를 통한 비용 정보 제공 범위" 후속 협의 → Open API(kcloud-mnt) 비용 도메인 범위 답변 준비
- 마켓플레이스 앱 레벨 세부(7/15 분과 워크샵 결과) + ETRI Chatbot 서비스(DevDay "Chatbot + 자원할당") 연계
- AI 모델 분석(AIOps) 오케스트로 하반기 구체화안
- 포털 형상 기본 분류 조정(사용자가 `/settings`에서 확인 후 `src/lib/scope.ts` FEATURES 수정)
- 일정: DevDay 11/10 STCenter(오케스트로AGI Tech session), 공개SW 지표 11/15, 연차보고서 취합 11/30·12/7·12/14, 등록 12/24

---

### 🗂️ 변경 요구사항 대비표·변경 표시 운영 규칙 (2026-09-15 개정)

- 산출물은 4개로 정리한다: ① 초기 전달본 v1.0 스냅샷(`public/versions/v1.0/`) ② 반영본 v2.0(현재 작업 트리) ③ 변경 요구사항 대비표 `docs/변경요구사항_대비표.md`(생성 문서) ④ 화면 안 변경 표시(헤더 "변경 표시" + `/changes`).
- **로고(2026-09-15)**: 사이드바·로그인·IDE 헤더의 "K" 그라데이션 마크를 GitHub 조직 아바타(구름 K)로 교체 — `public/logo/openkcloud-mark.png`(투명 배경 256px), `public/logo/openkcloud-logo.png`(OPENCLOUD 워드마크 포함), `src/app/icon.png`(파비콘). v1 사이트도 같은 로고로 재빌드(`4bf38da` + 로고).
- **v1 전수 점검(2026-09-15)**: `docs/초기전달본_v1_전수점검_20260915.md` — 라우트 96개·탭·행·버튼·메뉴 항목 자동 클릭, 회의자료 언급 요소 48건 대조. 결함: 워크로드 행 메뉴 "상세 보기"가 이름으로 이동해 404(v2에서 id로 수정), 헤더·상세 액션의 무반응 버튼 121개(v2에도 39개 남아 있어 2026-09-15 토스트·상태 응답 추가 — 옵저버빌리티 조회 구간 순환·자동 새로고침 토글, 트레이스 선택, API Key 행 버튼, VM·워크로드·노트북·서버 상세 액션). 도구는 `~/claude/kcloud-code-project/docs/artifact-build/qa-v1.mjs`.
- **배포(2026-09-15, 사이트 분리)**: 초기 전달본 v1.0 → `openkcloud-cmp-v1` https://openkcloud-cmp-v1.netlify.app/ (커밋 4bf38da 단독 빌드, frozen). 반영본 v2.0 → `openkcloud-cmp-v2` https://openkcloud-cmp-v2.netlify.app/ (`/changes/` 대비표, `/versions/v1.0/` 비교용 스냅샷 포함). 이 폴더는 v2 사이트에 링크되어 `netlify deploy --dir=out --prod`로 갱신. 2026-06-04에 만든 무작위 이름 사이트 5개(dazzling-kringle 등)는 초기 전달본 배포 흔적이며 더 쓰지 않는다.
- **단일 원천은 `src/lib/change-requests.ts`.** 요구사항 하나 = CR 코드 하나(`CR-<영역>-<번호>`). 출처(`SOURCES`: ETRI-260615 / MTG-260702 / WS-260828 / OKE-260914)와 항목 참조, 초기/반영본 상태, 이력(날짜·커밋), 형상 태그, 결정 사안 번호를 적는다.
- 화면의 바뀐 영역은 `<ChangeMark ids={["CR-…"]}>`로 감싼다. 감싸지 않아도 `pages`에 적힌 경로의 패널 목록에는 뜬다.
- 문서는 `node scripts/export-change-requests.mjs`로 다시 만든다. 손으로 고치지 않는다.
- 이전 버전 화면이 더 필요하면 `scripts/build-version-snapshot.sh <id> <commit>`로 스냅샷을 추가하고 `versions.ts`에 등록한다. v1.1(`112a6d6`) 스냅샷은 초기 대비 비교로 정리하면서 제거했다.

### (구) 버전 이력 운영 규칙 (2026-09-07)

- 목업 버전은 `src/lib/versions.ts`의 `VERSIONS`로 관리한다. 항목마다 메뉴(href) 단위로 `kind`(added/modified/removed/pending/unchanged)·before/after·ETRI 의견 번호·커밋을 적는다.
- 이전 버전 화면은 `scripts/build-version-snapshot.sh <id> <commit>`로 `public/versions/<id>/`에 정적 스냅샷(basePath `/versions/<id>`)을 만든다. v1.0(`4bf38da`)은 생성·커밋됨. 스냅샷은 frozen이라 재빌드하지 않는다.
- v1.1(`112a6d6`) 스냅샷은 2026-09-14 생성·커밋 대상(`public/versions/v1.1/`, 14MB). v1.2가 현재 버전(`CURRENT_VERSION`), 커밋 후 `versions.ts`의 v1.2 `commit: "작업 중"`을 실제 해시로 바꾼다.
- 다음 버전(v1.3)을 확정할 때: v1.2 커밋을 `build-version-snapshot.sh v1.2 <commit>`으로 스냅샷, `versions.ts`에 v1.3 메뉴 변경(`minutes`·`feedback` 근거 포함)을 채우고 `CURRENT_VERSION`을 옮긴다.
- 메뉴 항목의 `minutes`는 `MINUTES_260702` 키(예: "2.5-네트워크"), 형상 태그는 `src/lib/scope.ts`의 `FEATURES.href`로 자동 연결된다.
- `next.config.ts`의 `rewrites()`는 dev 전용(스냅샷 디렉터리 → index.html). 빌드에서는 빈 배열이라 `output: "export"`와 충돌하지 않는다.

## 6. 프로젝트 구조 · 주요 파일 위치

```
openkcloud-cmp/
├── src/
│   ├── app/
│   │   ├── (portal)/          # 로그인 후 화면
│   │   │   ├── dashboard/     # 통합 대시보드
│   │   │   ├── monitoring/    # 옵저버빌리티 5개 페이지
│   │   │   ├── iaas/          # OpenStack 자원 9개 페이지
│   │   │   ├── paas/          # K8s 자원 5개 페이지
│   │   │   ├── resource-map/  # 6계층 자원 모델
│   │   │   ├── infrastructure/servers/  # 물리 서버
│   │   │   ├── topology/      # 기술인벤토리 (Smartscape)
│   │   │   ├── ai-development/ # Kubeflow 6개 페이지
│   │   │   ├── catalog/       # 마켓플레이스 (SignatureShowcase)
│   │   │   ├── iam/           # IAM (users·roles·api-keys·audit)
│   │   │   └── settings/
│   │   ├── (fullscreen)/notebooks/[id]/ide/   # Code Server iframe
│   │   └── login/
│   ├── components/
│   │   ├── ui/                # shadcn/ui
│   │   ├── viz/               # 시각화 컴포넌트
│   │   ├── app-sidebar.tsx    # role 기반 사이드바
│   │   ├── page-header.tsx    # 공용 PageHeader
│   │   └── resource-request-wizard.tsx  # 자원 신청 위저드 (개선 대상 #16)
│   ├── lib/
│   │   ├── nav.ts             # NAV_SECTIONS + getNavByRole
│   │   ├── auth.ts            # useAuth (Zustand) · MOCK_USERS
│   │   ├── api.ts             # TanStack Query hooks
│   │   ├── types.ts           # 도메인 타입
│   │   └── model-zoo.ts       # 마켓플레이스 모델 데이터
│   └── mocks/
│       ├── browser.ts         # MSW setup
│       ├── fixtures.ts        # 모든 도메인 시드 데이터 (976줄)
│       └── handlers/          # 도메인별 API 핸들러
├── docs/
│   ├── 요구사항_정의서_mockup_반영_검토서.{docx,xlsx}
│   ├── IaaS_PaaS_기능명세서.xlsx  # 113개 기능 매트릭스
│   └── generate_*.py           # xlsx/docx 자동 생성 스크립트
├── public/
│   ├── fonts/PretendardVariable.woff2
│   ├── mockServiceWorker.js   # MSW 워커 (Netlify _headers로 MIME 명시)
│   └── _headers               # Netlify: SW MIME + no-cache
├── next.config.ts             # output:'export', webpack build, ignoreBuildErrors
├── deploy.bat                 # Windows Netlify 배포
├── deploy.sh                  # macOS/Linux Netlify 배포 (100755)
├── README.md                  # 프로젝트 소개 + 피드백 매트릭스
├── MAC_SETUP.md               # Mac 이관 가이드
└── HANDOFF.md                 # 이 파일
```

---

## 7. 자주 참조되는 코드 패턴

### 로그인·역할
```ts
// src/lib/auth.ts
Role = "admin" | "user"
MOCK_USERS = { admin: {password:"admin", user:{displayName:"최현화", org:"ETRI"}},
               user:  {password:"user",  user:{displayName:"윤호영", org:"오케스트로(주)"}} }
```

### 사이드바 순서 (role별 분기)
```ts
// src/lib/nav.ts — getNavByRole(role) 사용
// admin: 개요→옵저버빌리티→클라우드→마켓→AI개발→AI인프라→운영
// user:  개요→클라우드→마켓→AI개발→옵저버빌리티→AI인프라
```

### MSW mock 호출
```ts
// src/lib/api.ts
const { data, isLoading } = api.iaas.instances(filters);
// → /api/iaas/instances 요청, src/mocks/handlers/iaas.ts가 응답
```

### 페이지 헤더
```tsx
import { PageHeader } from "@/components/page-header";
<PageHeader title="..." description="..." actions={<Button>...</Button>} />
// description은 ReactNode 허용 (JSX 가능)
```

### 액션 피드백 (mock)
```ts
import { toast } from "sonner";
toast.success("생성됨", { description: "..." });
toast.error("삭제 거부 — 사용 중");
```

### 톤 (설명 서술 시)
평어체 (`~한다`) · dry 톤 · 강조 부사 제거 (`즉시`, `한눈에`, `매우` 등 사용 금지).
docs/generate_iaas_paas_spec.py의 `to_dry()` 함수 참조.

---

## 8. 배포 · 실행 · 검증

### 로컬 실행
```sh
npm install
npm run dev   # http://localhost:3000 (또는 3001)
```

### 프로덕션 빌드 · 배포
```sh
npm run build    # → out/ 정적 파일
./deploy.sh      # (Mac) 또는 deploy.bat (Windows)
```

### Windows dev 서버 종료
```powershell
Get-Process node | Stop-Process -Force
# 또는 taskkill //IM node.exe //F
```

### 라우트 헬스 체크
```sh
for path in /dashboard/ /iaas/security-groups/ /catalog/ /iam/roles/; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001$path")
  echo "$code  $path"
done
```

### 흔한 트러블
- **Slack/GitHub 아이콘 없음**: lucide-react v1.x 제한. `MessageSquare`(Slack), 커스텀 SVG(GitHub, `src/components/icons.tsx`) 사용.
- **Turbopack 빌드 시 `~` 문자 파일명**: Netlify 404 유발. `next build --webpack`으로 해결됨 (`package.json` scripts).
- **한글이 든 .bat 파일 실행 오류**: CP949/UTF-8 mangling. `deploy.bat`은 ASCII만 사용.
- **폴더 드래그 시 Netlify Drop 빈 배포**: 브라우저 API 이슈. `deploy.sh`/`deploy.bat`으로 CLI 배포 권장.

---

## 9. Next Actions — 인수자가 바로 시작할 수 있는 것

인수자가 이 프로젝트 재개할 때 우선순위:

1. **git pull** — Mac에서 최신 반영
2. **npm install** — 의존성
3. **npm run dev** — 로컬 확인 (5분)
4. 남은 작업 중 선택:
   - (A) **#25+27 K8s 클러스터 생성 위저드** — `src/app/(portal)/paas/clusters/page.tsx`에 신규 다이얼로그 추가. Portal→Magnum→Nova VM→Neutron Network→K8s Cluster(Control+Worker) 5단계 시각화. 위저드 각 단계별 진행 상태 표시. 참조: 스프린트 3 `CreateWorkloadDialog`(workloads/page.tsx) 패턴.
   - (B) **#16 자원 신청 통합 위저드 재정비** — `src/components/resource-request-wizard.tsx` 확장. 프로젝트→네트워크→볼륨→가속기→VM 5단계, 각 단계에서 기존 자원 선택 or 새로 생성. 스프린트 4 `DeploymentWizard`(catalog/page.tsx) 패턴 참조.
   - (C) **이노그리드 후속 데이터 문의** — 이노그리드에 일정 확인 메일 초안 작성.

---

## 10. 기타 컨텍스트

- **Google Drive 문서 접근**:
  - Windows: `H:\내 드라이브\정부R&D과제(수행)\★16-2. AI반도체 클라우드 플랫폼 구축 및 최적화 기술 개발\10. 목업자료\ETRI 피드백 자료\`
  - Mac: `~/Library/CloudStorage/GoogleDrive-hy.yun@okestro.com/내 드라이브/정부R&D과제(수행)/★16-2. AI반도체 클라우드 플랫폼 구축 및 최적화 기술 개발/10. 목업자료/ETRI 피드백 자료/`
- **한글 파일명 처리**: Git·Bash에서는 문제없지만 일부 스크립트에서 quoting 필요.
- **CRLF/LF 경고**: Windows에서 만든 파일은 CRLF. Mac에서 pull 시 자동 변환. `.gitattributes` 없이도 동작.
- **user memory**: `~/.claude/projects/C--Users-YUN--claude-cloudnative/memory/project_openkcloud_cmp.md` (요약본), MEMORY.md 인덱스에 등록됨.

---

**이 문서를 시작점으로 Claude가 즉시 이어서 작업 가능**. 질문이 있으면 저장소 README·docs/·과거 커밋 메시지를 우선 참조.
