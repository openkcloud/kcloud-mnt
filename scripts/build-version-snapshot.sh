#!/usr/bin/env bash
# 이전 목업 버전을 basePath(/versions/<id>) 아래로 정적 빌드해 public/versions/<id>/ 에 스냅샷으로 넣는다.
# /versions 페이지가 이 스냅샷을 iframe으로 띄워 현재 버전과 나란히 비교한다.
#
# 사용:  scripts/build-version-snapshot.sh <버전ID> <커밋>
# 예시:  scripts/build-version-snapshot.sh v1.0 4bf38da
#
# 동작: git worktree(.snapshots/<id>)에 해당 커밋을 체크아웃 → node_modules 심볼릭 링크 →
#       next.config.ts에 basePath/assetPrefix 주입 → MSW 워커 경로 수정 → webpack 빌드 →
#       out/ 을 public/versions/<id>/ 로 복사 → worktree 제거.
set -euo pipefail

ID="${1:?버전 ID 필요 (예: v1.0)}"
COMMIT="${2:?커밋 필요 (예: 4bf38da)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WT="$ROOT/.snapshots/$ID"
BASE="/versions/$ID"

cd "$ROOT"
git worktree remove --force "$WT" 2>/dev/null || true
rm -rf "$WT"
mkdir -p "$ROOT/.snapshots"
git worktree add --detach "$WT" "$COMMIT"
ln -sfn "$ROOT/node_modules" "$WT/node_modules"

# basePath / assetPrefix 주입
node - "$WT/next.config.ts" "$BASE" <<'EOF'
const fs = require("fs");
const [file, base] = process.argv.slice(2);
let s = fs.readFileSync(file, "utf8");
if (!s.includes("basePath")) {
  s = s.replace(
    'output: "export",',
    `output: "export",\n  basePath: "${base}",\n  assetPrefix: "${base}",`,
  );
}
fs.writeFileSync(file, s);
EOF

# MSW 서비스 워커 등록 경로를 basePath 아래로
MSW="$WT/src/components/msw-provider.tsx"
sed -i.bak "s#url: \"/mockServiceWorker.js\"#url: \"$BASE/mockServiceWorker.js\"#" "$MSW"
rm -f "$MSW.bak"

echo "[snapshot] building $ID ($COMMIT) with basePath=$BASE"
(cd "$WT" && npx next build --webpack)

rm -rf "$ROOT/public/versions/$ID"
mkdir -p "$ROOT/public/versions"
cp -R "$WT/out" "$ROOT/public/versions/$ID"
rm -f "$ROOT/public/versions/$ID/_headers"

git worktree remove --force "$WT"
echo "[snapshot] done → public/versions/$ID ($(du -sh "$ROOT/public/versions/$ID" | cut -f1))"
