#!/usr/bin/env node
// 변경 요구사항 대비표(src/lib/change-requests.ts) → docs/변경요구사항_대비표.md
// 실행: node scripts/export-change-requests.mjs   (Node 22.6+ : TS 타입 제거 실행)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mod = await import(join(here, "../src/lib/change-requests.ts"));
const { CHANGE_REQUESTS, SOURCES, AREA_LABEL, AREA_ORDER, STATUS_LABEL, countByStatus } = mod;
const versions = await import(join(here, "../src/lib/versions.ts"));
const { INITIAL_VERSION, CURRENT_VERSION } = versions;

const today = new Date();
const pad = (n) => String(n).padStart(2, "0");
const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const srcTag = (s) => `${s.doc} ${s.ref}`;

const counts = countByStatus();
const total = CHANGE_REQUESTS.length;

let md = `# openKcloud CMP 목업 — 변경 요구사항 대비표

- 기준: 초기 전달본 ${INITIAL_VERSION.id}(${INITIAL_VERSION.date}, \`${INITIAL_VERSION.commit}\`) → 반영본 ${CURRENT_VERSION.id}(${CURRENT_VERSION.date})
- 생성: ${date} · 원천 \`src/lib/change-requests.ts\` (이 문서는 \`node scripts/export-change-requests.mjs\`로 생성한다. 손으로 고치지 않는다)
- 화면에서 보기: 포털 헤더 "변경 표시" 토글 → 각 화면에 코드 배지, 사이드바 "목업 관리 › 변경 요구사항 대비표"(\`/changes\`)에서 코드별 상세와 초기 화면 비교

## 1. 코드 체계

\`CR-<영역>-<번호>\`. 영역: ${AREA_ORDER.map((a) => `${a} ${AREA_LABEL[a]}`).join(" · ")}

상태: 반영(요구대로 목업에 반영) · 부분 반영(일부만, 남은 일 있음) · 대기(타 기관 입력 대기, 자리만) · 제외(요구를 검토해 하지 않기로 함) · 예정

## 2. 출처

| 출처 코드 | 문서 | 일자 | 기관 | 성격 |
|---|---|---|---|---|
${Object.values(SOURCES).map((s) => `| ${s.id} | ${esc(s.title)} | ${s.date} | ${esc(s.org)} | ${s.kind} |`).join("\n")}

## 3. 요약

| 상태 | 건수 |
|---|---:|
${Object.entries(counts).map(([k, v]) => `| ${STATUS_LABEL[k]} | ${v} |`).join("\n")}
| **합계** | **${total}** |

| 영역 | 건수 | 반영 | 부분 | 대기 | 제외 |
|---|---:|---:|---:|---:|---:|
${AREA_ORDER.map((a) => {
  const items = CHANGE_REQUESTS.filter((c) => c.area === a);
  const c = countByStatus(items);
  return `| ${AREA_LABEL[a]} | ${items.length} | ${c.reflected} | ${c.partial} | ${c.pending} | ${c.excluded} |`;
}).join("\n")}

## 4. 대비표

| 코드 | 영역 | 변경 요구사항 | 출처 | 초기 전달본(v1.0) | 반영본(v2.0) | 상태 | 반영 이력 |
|---|---|---|---|---|---|---|---|
${CHANGE_REQUESTS.map((c) =>
  `| ${c.id} | ${AREA_LABEL[c.area]} | ${esc(c.title)} | ${c.sources.map(srcTag).join("<br>")} | ${esc(c.before)} | ${esc(c.after)} | ${STATUS_LABEL[c.status]} | ${c.history.map((h) => `${h.date}${h.commit ? ` \`${h.commit}\`` : ""}${h.note ? ` ${esc(h.note)}` : ""}`).join("<br>") || "-"} |`,
).join("\n")}

## 5. 영역별 상세

`;

for (const area of AREA_ORDER) {
  const items = CHANGE_REQUESTS.filter((c) => c.area === area);
  if (!items.length) continue;
  md += `### ${AREA_LABEL[area]} (${items.length}건)\n\n`;
  for (const c of items) {
    md += `#### ${c.id} ${c.title}\n\n`;
    md += `- 상태: ${STATUS_LABEL[c.status]} · 화면: ${c.pages.map((p) => `\`${p}\``).join(", ")}${c.feature ? ` · 형상 태그: \`${c.feature}\`` : ""}${c.decision ? ` · 결정 사안: ${c.decision.map((d) => `#${d}`).join(", ")}` : ""}\n`;
    md += `- 출처\n`;
    for (const s of c.sources) md += `  - ${s.doc} ${s.ref}: ${s.said}\n`;
    md += `- 초기 전달본: ${c.before}\n`;
    md += `- 반영본: ${c.after}\n`;
    if (c.history.length) md += `- 이력: ${c.history.map((h) => `${h.date}${h.commit ? ` (${h.commit})` : ""}${h.note ? ` ${h.note}` : ""}`).join(" → ")}\n`;
    md += `\n`;
  }
}

md += `## 6. 반영본 단계(참고)

| 시점 | 내용 | 커밋 |
|---|---|---|
${(CURRENT_VERSION.steps ?? []).map((s) => `| ${s.date} | ${esc(s.label)} | ${s.commit ?? "-"} |`).join("\n")}
`;

const out = join(here, "../docs/변경요구사항_대비표.md");
writeFileSync(out, md, "utf8");
console.log(`written ${out} — ${total}건`);
