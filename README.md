# openKcloud CMP — AI반도체 클라우드 통합관리 플랫폼 (Mockup)

> **정부 R&D 과제**: AI반도체 클라우드 플랫폼 구축 및 최적화 기술 개발 (IITP)
> **작성**: 오케스트로(주) · **연동**: ETRI · 이노그리드 · KETI · 경희대
> **상태**: 목업 v2.0 반영본 (ETRI 260615 검토 의견 · 260702 회의록 · 2차 워크샵 반영 · 2026-09-15). 초기 전달본 v1.0(2026-06-04) 대비 변경 요구사항 59건은 `docs/변경요구사항_대비표.md`

이종 AI반도체(GPU·NPU·PIM·HBM-PIM)를 단일 콘솔에서 관리하는 CMP(Cloud Management Platform)의 UI 목업이다.
OpenStack(IaaS) · Kubernetes(PaaS) · Kubeflow(AI 개발환경) · Rebellions ModelZoo(마켓플레이스)를 하나의 포탈로 통합.

---

## 🚀 실행

### 로컬 개발
```bash
npm install
npm run dev            # http://localhost:3000 (또는 3001)
```

### 원격 배포 (Netlify · 원클릭)
```bash
# Windows
deploy.bat 더블클릭
```
첫 실행 시 브라우저로 Netlify 로그인 1회 후 자동 배포. 이후 실행은 같은 URL에 덮어쓰기.

### 로그인 계정
| 역할 | ID / PW | 사이드바 초점 |
|---|---|---|
| **관리자** | `admin` / `admin` | 개요 → 옵저버빌리티 → 클라우드자원 → 마켓플레이스 → AI개발환경 → AI인프라 → 운영 |
| **유저** | `user` / `user` | 개요 → 클라우드자원 → 마켓플레이스 → AI개발환경 → 옵저버빌리티 → AI인프라 |

---

## 🌐 배포 주소 (2026-09-15)

| 산출물 | Netlify 사이트 | URL |
|---|---|---|
| 초기 전달본 v1.0 (커밋 `4bf38da` 단독 빌드) | `openkcloud-cmp-v1` | https://openkcloud-cmp-v1.netlify.app/ |
| 반영본 v2.0 (헤더 "변경 표시"로 코드 배지, `/changes/` 대비표, `/versions/v1.0/` 비교용 스냅샷 포함) | `openkcloud-cmp-v2` | https://openkcloud-cmp-v2.netlify.app/ |

로그인 `admin/admin`(관리자) · `user/user`(사용자). 두 사이트 모두 팀 yunhoyoung-okestro. 로고는 GitHub 조직(github.com/openkcloud) 아바타의 구름 K 마크(`public/logo/openkcloud-mark.png`, 파비콘 `src/app/icon.png`)를 쓴다. v1 사이트는 `4bf38da`에 로고 교체만 더한 빌드다. v2.0 갱신은 이 폴더에서 `npm run build` 후 `netlify deploy --dir=out --prod`(폴더가 v2 사이트에 링크됨). v1.0은 frozen이라 재배포하지 않는다(필요 시 `git worktree add .snapshots/v1.0-root 4bf38da` → 빌드 → `netlify deploy --site 1d360e59-a4d6-4478-b7cd-1aa618c1499c --dir=.snapshots/v1.0-root/out --prod`).

## 🗂️ 산출물 구성 (2026-09-15 정리)

| # | 산출물 | 위치 |
|---|---|---|
| 1 | **목업 초기 전달본 v1.0** (2026-06-04, `4bf38da`) | 정적 스냅샷 `public/versions/v1.0/` — 배포 `https://openkcloud-cmp-v1.netlify.app/`, 포털 안 `/changes` 화면 비교의 왼쪽 |
| 2 | **목업 반영본 v2.0** (2026-09-15) — ETRI 260615 검토 의견, 260702 회의록, 2차 워크샵(08-27~28), 내부 확인(09-14)을 반영 | 이 저장소 `main` 작업 트리 — 배포 `https://openkcloud-cmp-v2.netlify.app/` |
| 3 | **변경 요구사항 대비표** — 코드(CR-영역-번호) 채번, 초기 대비 변경 내용, 출처 회의 | `docs/변경요구사항_대비표.md` (원천 `src/lib/change-requests.ts`, `node scripts/export-change-requests.mjs`로 생성) |
| 4 | **화면 안 변경 표시 기능** — 각 화면에서 요구사항 코드·내용을 바로 확인 | 헤더 "변경 표시" 토글 + `/changes` 대비표 페이지 |
| 5 | **변경 요구사항 반영 보고서** — 요구사항 한 건당 Before(v1.0)·After(v2.0) 캡처를 좌우 비교, 출처는 회의 날짜, 반영·부분 반영·대기·제외 절 분리 | 단일 파일 `docs/report/변경요구사항_반영보고서_20260915.html`(이미지 내장, 브라우저로 열기) · 분리본 `docs/report/index.html`(+ `img/`) — 생성 스크립트는 kcloud-code-project `docs/artifact-build/`(capture-cr.mjs · build_report.py · inline_report.py · add_marks.py) |
| 6 | **IaaS·PaaS 버튼 이벤트 명세·작동 점검** — 15개 화면 743개 컨트롤의 이벤트(정적 분석)와 실행 점검(관리자·사용자) 결과, 미작동 13건과 수정·실구현 계획 | `docs/IaaS_PaaS_버튼_이벤트명세_작동점검_20260916.md` — 생성 스크립트는 kcloud-code-project `docs/artifact-build/`(extract_controls.py · qa-iaas-paas.mjs · build_button_audit.py) |

### 변경 요구사항 대비표 (`/changes`) · 화면 안 변경 표시

- **코드 체계** `CR-<영역>-<번호>`: OVW 개요 · OBS 옵저버빌리티 · NAV 메뉴·형상 · IAAS · PAAS · MKT 마켓플레이스 · AID AI 개발환경 · IAM 운영 · INF AI 인프라 · DOC 문서. 총 59건(반영 48 · 부분 4 · 대기 5 · 제외 2).
- **출처** ETRI-260615(검토 의견 44건) · MTG-260702(포털 기능 검토 회의록) · WS-260828(2차 워크샵) · OKE-260914(내부 확인). 항목마다 어느 문서의 어느 항목이 무엇을 요구했는지 적는다.
- **`/changes` 페이지**: 상태·출처·영역 필터 → 코드 선택 → 초기 전달본/반영본 설명, 출처, 반영 이력(커밋), 형상 태그, 결정 사안 → 초기 스냅샷과 현재 화면 iframe 나란히 비교.
- **UI 문구 규칙**: 화면 문구에는 회의록·워크샵·검토 의견 인용이나 기관명(ETRI·KETI·이노그리드 등)의 협의 상태를 쓰지 않는다. 출처와 결정 근거는 `/changes` 대비표와 변경 표시 시트에만 둔다(2026-09-15 정리).
- **변경 표시 모드**: 헤더 "변경 표시"를 켜면 각 화면의 바뀐 영역에 점선 테두리와 코드 배지가 붙고, 우하단 패널에 그 화면의 변경 요구사항 목록이 뜬다. 배지·목록을 누르면 상세 시트. 코드는 `<ChangeMark ids={["CR-…"]}>`로 화면에 붙인다.

| 구성 | 위치 |
|---|---|
| 변경 요구사항 데이터(단일 원천) | `src/lib/change-requests.ts` (`CHANGE_REQUESTS`, `SOURCES`) |
| 버전 메타(v1.0 초기·v2.0 반영본) | `src/lib/versions.ts` |
| 대비표 페이지 | `src/app/(portal)/changes/page.tsx` |
| 변경 표시 모드 | `src/lib/change-mode.ts`, `src/components/change-mark.tsx`(ChangeMark·ChangeBadge·상세 시트), `src/components/change-panel.tsx`(헤더 토글·패널) |
| 문서 생성 | `scripts/export-change-requests.mjs` → `docs/변경요구사항_대비표.md` |
| 초기 스냅샷 | `public/versions/v1.0/` (`scripts/build-version-snapshot.sh v1.0 4bf38da`) |

새 요구사항이 생기면 ① `change-requests.ts`에 CR 항목 추가(출처·이전/이후·이력) ② 화면의 해당 영역을 `ChangeMark`로 감싸기 ③ `node scripts/export-change-requests.mjs`로 문서 재생성.

---

## 🧭 포털 형상 — 2차년도 시범서비스 / 최종 형상 (`/settings`, 2026-09-14 추가)

260702 회의록 2.1·2.4 결정("2차년도 과업 범위가 아닌 것은 최종 형상 설계안으로 유지하고 시범서비스 포털에서는 삭제")을 기능 단위로 구현했다.

- **환경설정 › 포털 형상**: 프리셋(2차년도 시범서비스 / 최종 형상 설계안) + 기능 12개의 표시 Switch. 브라우저(localStorage `openkcloud-scope`)에 저장, 사이드바·섹션 탭·화면 안 기능에 즉시 반영. 헤더 `형상 · …` 배지로 진입.
- **기본 분류**(2026-09-14 확인: 회의록에서 논의된 기능 외는 최종 형상): 최종 형상 전용 9개 — AI 모델 분석 자동 진단·권장 조치·핫스팟, 트레이스 vLLM 내부 span, 기존 볼륨 재사용, 이미지 패키징(ETRI 연동), 설정 관리(ConfigMap·Secret), 마켓 애플리케이션 레벨, Experiments(HPO)·MLPerf, 병목 분석 자동 진단·KV Cache, 기술인벤토리 관리. 2차년도 3개 — P99·에러율·RPS 카드(대체 지표 검토), Provider Health Check(052), 외부 블록스토리지 자원풀(048).
- 코드: 메뉴는 `nav.ts`의 `feature` 필드, 화면 안 기능은 `<FeatureGate id="…">`. 숨긴 기능은 안내 박스로 바뀌고 설정 링크가 붙는다.

---

## 📋 260702 포털 기능 검토 회의록 반영 현황 (v1.2, 2026-09-14)

| 회의록 | 결정 | 반영 |
|---|---|---|
| 2.1 인프라 모니터링 | P99·에러율·RPS 이노그리드 지원 어려움 → 대체 지표 검토, 히트맵 API 수정 검토 | 카드에 '대체 지표 검토' 표시, 안내 배너 (`/monitoring`) |
| 2.1 AI 모델 분석 | AIOps 성격, 오케스트로 과업, 하반기 구체화. 2차년도 외는 최종 형상 | 안내 배너, 자동 진단·권장 조치·핫스팟 최종 형상 태그, SLO 문구 정리 |
| 2.1 분산 트레이스 | 공통 서비스 트레이스, vLLM 내부 추적 미지원, 기본 정보 우선 | 배너, vLLM 내부 span·PurePath 최종 형상 태그 |
| 2.1 로그 이벤트 | 이노그리드가 UI 기능 정의·목업 제안 | 자리표시자 안내 |
| 2.1 알람·SLO | 알람 설정·임계치 필요, SLO는 오케스트로 정리 | 임계치 반영 완료 표기, SLO 제외 유지, 탭 라벨 잔여 정리 |
| 2.2 메뉴 구성 | 사용자/관리자 차별화, 관리자에 '네트워크·볼륨·서비스 구성' | 관리자 사이드바 재구성(AI 개발환경·운영 유지 — 2026-09-14 확인) |
| 2.3 마켓플레이스 | 애플리케이션 레벨 실행, 조합형 흐름, 통합 시연 | 앱 카드 3종 + 앱 선택 단계(최종 형상), 흐름 문구 통일. 7/15 워크샵 결과는 미반영 |
| 2.4 AI 노트북 | 2차년도 개발 기능만 시범서비스에 | 형상 안내, Experiments(HPO) 최종 형상 태그 |
| 2.5 자원 신청 | 쿼터로 프로젝트 생성 → 네트워크망 선택 → 신청 | 위저드 재정비(프로젝트 쿼터·관리자 네트워크·Flavor 볼륨 자동) |
| 2.5 네트워크 | 관리자 기능, 사용자는 선택 | 사용자 생성 버튼 제거, FIP 액션 관리자 |
| 2.5 스토리지 | Flavor 선택 시 볼륨 자동 생성, 재사용은 고도화 | 배너 교체, 생성·삭제 관리자, 재사용 최종 형상 |
| 2.5 권한 | 키페어·라우터·FIP·보안그룹 생성은 관리자 | 4개 화면 관리자 전용(키페어 포함 — 2026-09-14 확인), 라우터는 사용자 메뉴 제외 |
| 2.5 공급자 관리 | 메뉴 전체 삭제(단일 클러스터) | 페이지·nav·탭 삭제. 052 헬스체크·048 스토리지 자원풀은 인프라 관리 탭으로 |
| 2.6 PaaS | 사용자는 클러스터 신청만, VM 수·Flavor 입력, Magnum 5단계 | 신청 위저드 + 관리자 승인·Magnum 진행 화면 |
| 2.7 IAM | 검토의견 반영 방향 확정 | v1.1 반영 유지 |
| 2.8 명세서 | 명세-사이트 불일치 정리 | 문서 작업(미완, #2·#43) |
| 2.8 이미지 패키징 | 오케스트로 미고려, ETRI 개발 시 연동 | 패키징 탭 자리(최종 형상) |
| 3.2 워크샵 | 1단계·2차년도 형상·진행 상황 제시 | `/versions` 스냅샷(v1.0·v1.1) + 포털 형상 전환으로 제시 |

---

## 📊 ETRI 260615 피드백 반영 현황 (총 44건)

### 📈 진척 요약 (2026-09-14 · 260702 회의록 반영 후)
| 상태 | 건수 | 비율 |
|---|---:|---:|
| ✅ **반영 완료** | **30건** | **68%** |
| 🟡 부분 반영 | 2건 | 5% |
| ⚙️ 이노그리드 대기 | 6건 | 14% |
| ❌ 스코프 제외 | 4건 | 9% |
| 🔗 ETRI 연동(종결) | 1건 | 2% |
| ➖ 이슈 없음 | 1건 | 2% |

**이노그리드 대기 제외 실질 진행률 92%** (35/38) · 남은 부분 반영 2건은 문서·프로세스(#2 정기 검토 채널, #43 명세 갱신)

### 🗂️ 상세 매트릭스

#### 1. 개요
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 1 | 일부 기능 클릭 원활치 않음 | ✅ | 전 페이지 액션·Sheet·toast 완비 |
| 2 | 명세↔목업 지속 검토 | 🟡 | 진행 중, 정기 채널은 협의 |

#### 2. 옵저버빌리티
| # | 항목 | 상태 | 반영 위치 / 대기 사유 |
|--:|---|:---:|---|
| 3 | Avg P99 지연·에러율·RPS | ⚙️ | 이노그리드 모니터링 설치 대기 |
| 4 | 활용율 히트맵 | ⚙️ | 이노그리드 API 업데이트 대기 |
| 5 | 응답시간 분포 | ⚙️ | 이노그리드 vLLM 테스트 대기 |
| 6 | **권장조치 자동 적용** | ✅ | `/monitoring/insights` — 정보 제공까지. 260702: AIOps 성격으로 오케스트로 과업, 권장 조치는 최종 형상 태그 |
| 7 | 서비스 플로우 vLLM 내부 추적 | ⚙️ | 이노그리드 테스트 대기 |
| 8 | 분산 트레이스 vLLM 내부 추적 | ⚙️ | 이노그리드 추가 테스트 대기 |
| 9 | 트레이스 기본 정보 범위 | ⚙️ | 이노그리드 후속 대기 |
| 10 | 로그 이벤트 | ➖ | 이슈 없음 |
| 11 | **SLO 정의** | ❌ | 제외 결정 — nav 라벨 "알람·SLO"→"알람". 260702: 포함 여부는 오케스트로 정리로 확인, 잔여 SLO 문구를 목표 지연 1초로 정리 |
| 12 | **알람 CRUD 기능** | ✅ | `/monitoring/alerts` — 3탭 (활성/정책/채널), 정책 편집·복제·테스트 발송 |

#### 3. 포탈 메뉴 구성
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 13 | **관리자/사용자 메뉴 차별화** | ✅ | `nav.ts` role별 순서 분기 (`getNavByRole`) |
| 14 | 사용자 메뉴 순서(안) | ✅ | 개요→클라우드→마켓→AI개발→옵저버→AI인프라 |
| 15 | 관리자 메뉴 순서(안) | ✅ | 개요→옵저버→클라우드→마켓→AI개발→AI인프라→운영 |

#### 4. 클라우드 자원 — IaaS
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 16 | 자원 신청 워크플로우 명확화 | ✅ | 260702 흐름으로 위저드 재정비 — 프로젝트(쿼터) → 관리자 네트워크 선택 → Flavor(볼륨 자동) → 가속기 → 신청 |
| 17 | **네트워크 생성 주체 정의** | ✅ | `/iaas/networks` — 260702: 관리자 전용 생성, 사용자는 선택. 사용자 버튼 제거, FIP 액션 관리자 |
| 18 | 네트워크 생성(C) 명세 없음 | ❌ | 스코프 제외 — 기본 버튼 제거 |
| 19 | **볼륨 사용자 직접 생성** | ✅ | `/iaas/volumes` — 260702: Flavor 선택 시 자동 생성, 생성·삭제는 관리자, 재사용은 최종 형상 |
| 20 | 키페어·라우터 관리 | ✅ | `/iaas/keypairs`, `/iaas/routers` — 260702: 생성·삭제 관리자 권한, 사용자는 조회·선택 |
| 21 | Floating IP 관리 기능 | ✅ | `/iaas/networks` — 해제·회수·재할당(관리자) |
| 22 | 보안 그룹 관리 | ✅ | `/iaas/security-groups` — CRUD는 관리자, 사용자는 조회·선택 |
| 23 | AI 반도체 관리 명세 없음 | ❌ | 스코프 제외 — `/ai-accelerators` 페이지 제거 |
| 24 | **OpenShift 지원 범위** | ❌ | 제외 결정. 260702: 공급자 관리 메뉴 자체 삭제(단일 클러스터), 헬스체크·스토리지 자원풀은 인프라 관리로 |

#### 5. 클라우드 자원 — PaaS
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 25 | K8s 프로비저닝 5단계 흐름 | ✅ | `/paas/clusters` — 관리자 승인 시 Portal→Magnum→Nova VM→Neutron→Cluster 진행 화면. 사용자는 신청(260702) |
| 26 | Ingress·Storage 생성·연동 | ✅ | `/paas/services` — Ingress 관계 다이어그램 + 규칙 관리 |
| 27 | VM 개수·가속기 종류·개수 선정 | ✅ | 서비스 클러스터 신청 위저드 노드·가속기 단계(CP/Worker 수, Flavor, 가속기 종류·개수) |
| 28 | StorageClass·PV 관리자 UI | ✅ | `/paas/storage` — 관리자 생성 다이얼로그 |

#### 6. 서비스 마켓플레이스
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 29 | 실행 대상·방식 구체화 | ✅ | `/catalog` — SignatureShowcase 3종 카드 |
| 30 | 조합형 실행 플로우 | ✅ | 4단계 배포 위저드 (모델→가속기→인프라→실행) |
| 31 | 원클릭 LLM (챗봇) | ✅ | 대표 카드 + 자동 배포 흐름 안내 |

#### 7. AI 노트북
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 32 | Kubeflow 사용 순서 가이드 | ✅ | `/ai-development` 홈 — 8단계 흐름 가이드 배너 |
| 33 | Pipeline YAML 업로드 | ✅ | `/ai-development/pipelines` — 파일·붙여넣기 2가지 모드 |
| 34 | Experiments 정의 수단 | ✅ | Katib 알고리즘 선택 다이얼로그 |
| 35 | HPO 명칭 변경 | ✅ | 페이지 타이틀·nav 라벨 통일 |
| 36 | MLPerf 벤치마크 콘텐츠 | ✅ | 하드웨어·모델 벤치 2개 탭 신설 |
| 37 | Attention Layer 프로파일링 방식 | ✅ | 1분 주기 샘플링 명시 |
| 38 | KV Cache 미스율 산출 방식 | ✅ | vLLM 표준 메트릭 조합 명시 |
| 39 | 응답 지연 TTFT/TPOT/E2E 정의 | ✅ | 3종 분리 카드 + 정의 |

#### 8. IAM 접근제어
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 40 | 권한 매트릭스 토글 방식 | ✅ | `/iam/roles` — Switch + 저장·되돌리기 |
| 41 | 권한 매트릭스 추가·삭제 | ✅ | 커스텀 권한 정의 다이얼로그 |

#### 9. 기타 (명세-목업 불일치)
| # | 항목 | 상태 | 반영 위치 |
|--:|---|:---:|---|
| 42 | 워크로드 생성 화면 부재 | ✅ | `/paas/workloads` — 5종 유형 2단계 위저드 |
| 43 | 스토리지 관련 기능 명세 | 🟡 | UI 완성 (스프린트 3), 명세 갱신은 문서 담당 |
| 44 | 이미지 패키징 기술 | 🔗 | 260702 종결: 오케스트로 미고려, ETRI 개발 시 이미지 메뉴에 연동. 패키징 탭 자리(최종 형상) |

---

## 🛠️ 스택

| 계층 | 기술 |
|---|---|
| Framework | Next.js 16 (App Router · Webpack build) · React 19 · TypeScript |
| 스타일 | Tailwind 4 · shadcn/ui (New York) · Pretendard Variable |
| 상태·데이터 | TanStack Query v5 · Zustand · react-hook-form · zod |
| Mock | MSW v2 (Service Worker · fixtures.ts) |
| 시각화 | Recharts + 자체 viz 컴포넌트 (Sparkline · Sankey · Isometric 등) |
| 배포 | Netlify (정적 export · Webpack chunk) |

---

## 📁 페이지 인벤토리 (총 40+ 화면)

```
개요                → /dashboard (통합 대시보드 + 옵저버빌리티 바로가기)

옵저버빌리티        → /monitoring, /monitoring/insights (AI 모델 분석)
                    /monitoring/traces, /monitoring/logs, /monitoring/alerts

클라우드 자원 IaaS   → /iaas + projects·instances·networks·routers
                     ·security-groups·keypairs·volumes·images·providers

클라우드 자원 PaaS   → /paas + clusters·workloads·services·storage·config

AI 인프라           → /resource-map, /infrastructure/servers, /topology

AI 개발환경         → /ai-development + profiles·notebooks·pipelines
                     ·experiments·serving·model-insights

서비스 마켓플레이스  → /catalog

운영 (관리자)       → /iam + users·roles·api-keys·audit, /settings

개발환경 IDE       → /notebooks/[id]/ide (풀스크린 iframe 슬롯)
```

---

## 📚 프로젝트 문서

- `docs/변경요구사항_대비표.md` — **초기 전달본 대비 변경 요구사항 59건** (코드·출처·이전/이후·이력, 생성 문서)
- `docs/목업_버전별_변경사항_및_결정사항.md` — 반영 단계별 이력(v1.1·v1.2 중간 단계)과 결정 필요 사안 16건 (2026-09-14)
- `docs/요구사항_정의서_mockup_반영_검토서.docx` · `.xlsx` — 초기 요구사항 vs 목업 매핑
- `docs/IaaS_PaaS_기능명세서.xlsx` — 113개 기능의 대분류·API·상태 매트릭스
- `docs/generate_*.py` — 문서 자동 생성 스크립트

---

## 🗓️ 스프린트 히스토리

| 스프린트 | 커밋 | 반영 |
|---|---|---|
| 1. 사이드바 · 대시보드 | `47139b3` | role별 nav 분기, 대시보드 옵저버빌리티 바로가기 |
| 2. IaaS 자원 관리 | `1bede22` | 보안그룹·키페어·라우터 3개 신규 페이지 + FIP 회수/해제 |
| 3. PaaS 완성도 | `5436795` | 워크로드 생성·PV/SC 관리자 UI·Ingress 관계 뷰 |
| 4. 마켓플레이스 시그니처 | `99e9cfa` | SignatureShowcase 3종 + 4단계 배포 위저드 |
| 5. AI 개발환경 UX | `755af71` | 8단계 흐름 가이드·YAML 업로드·HPO·MLPerf·TTFT/TPOT/E2E |
| 6. IAM 완성 | `eba9349` | Switch 권한 매트릭스 + 커스텀 권한 CRUD |
| D. 스코프 정리 | `dc05fee` | 명세 없는 UI 제거 (네트워크 생성·AI반도체 관리) |
| B. 결정 반영 | `248cd51` | SLO 제외·알람 CRUD·OpenShift 제외·생성 주체 명시 |
| 7. 버전 이력 | (2026-09-07) | 버전 비교 페이지(현 `/changes`) + v1.0 스냅샷 |
| 8. 260702 회의 반영 | (2026-09-14) | 포털 형상 설정, 관리자 메뉴 재구성, 관리자 권한 조정, 공급자 삭제→인프라 관리, 클러스터 신청·승인, 자원 신청 재정비, 마켓 앱 레벨 |
| 9. 워크샵 반영·CR 체계 | (2026-09-15) | 가속기 공통 지표 6종, 이상감지 정책 6종, 워크로드 정책(OPA) 탭, 비용 Open API 초안, 스케줄링 힌트, 변경 요구사항 코드(CR) 대비표·화면 안 변경 표시 |

---

## 🔗 링크

- **저장소**: https://github.com/YunHoYoung-okestro/openkcloud
- **원본 피드백 PDF**: `260615_openKcloud Portal 검토 의견_v1.0.pdf` (ETRI)
- **연락**: 오케스트로(주) · 윤호영 (hy.yun@okestro.com)
