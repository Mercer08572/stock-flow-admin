#!/usr/bin/env bash
# 校验前端契约快照是否与后端契约一致（漂移检查）。
#
# 用法：
#   bash scripts/verify-api-contract.sh [后端仓库目录]
#
# 实现说明：在工作区外的临时目录重新生成一份快照，再与入库快照做 diff。
# 不使用 git diff：CI 的 pull_request checkout 是 detached HEAD，git 语义不稳定；
# 文件级 diff 在本地与 CI 下行为一致，且不会污染工作区。

set -euo pipefail

BACKEND_DIR="${1:-../stock-flow}"
CONTRACT="contracts/openapi-schema.ts"
BANNER="scripts/api-contract-banner.txt"
SPEC="$BACKEND_DIR/openapi/swagger.json"
GENERATOR="node_modules/.bin/swagger-typescript-api"

if [ ! -f "$CONTRACT" ]; then
  echo "缺少契约快照 ${CONTRACT}，请先执行 pnpm api:generate。" >&2
  exit 1
fi

if [ ! -f "$SPEC" ]; then
  echo "找不到后端契约文件：${SPEC}" >&2
  echo "请先在后端仓库执行 make swagger，或用第一个参数指定后端仓库目录。" >&2
  exit 1
fi

if [ ! -x "$GENERATOR" ]; then
  echo "缺少 ${GENERATOR}，请先在本仓库执行 pnpm install。" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

"$GENERATOR" generate -p "$SPEC" -o "$tmp_dir" -n schema.ts --no-client >/dev/null

expected="$tmp_dir/openapi-schema.ts"
{
  cat "$BANNER"
  echo
  cat "$tmp_dir/schema.ts"
} > "$expected"

if diff -q "$CONTRACT" "$expected" >/dev/null; then
  echo "契约快照与后端契约一致：$CONTRACT"
  exit 0
fi

echo "::error::后端契约已变化，但契约快照未同步。"
echo "处理方式：在本仓库执行 pnpm api:generate 更新快照，并人工核对"
echo "  src/types/api.ts、src/api/auth.ts、src/api/resources.ts 是否需要同步修改。"
echo
echo "--- diff（左：当前快照；右：按后端契约重新生成） ---"
diff -u "$CONTRACT" "$expected" | head -200 || true
exit 1
