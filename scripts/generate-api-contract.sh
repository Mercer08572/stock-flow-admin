#!/usr/bin/env bash
# 从后端 OpenAPI 契约生成前端契约快照（contracts/openapi-schema.ts）。
#
# 用法：
#   bash scripts/generate-api-contract.sh [后端仓库目录]
#   默认后端目录为 ../stock-flow（本仓库的同级目录）。
#
# 该脚本是幂等的：先在工作区外的临时目录生成，再拼接文件头覆盖目标文件，
# 因此重复执行不会累积说明文字。

set -euo pipefail

BACKEND_DIR="${1:-../stock-flow}"
CONTRACT="contracts/openapi-schema.ts"
BANNER="scripts/api-contract-banner.txt"
SPEC="$BACKEND_DIR/openapi/swagger.json"
GENERATOR="node_modules/.bin/swagger-typescript-api"

if [ ! -f "$SPEC" ]; then
  echo "找不到后端契约文件：$SPEC" >&2
  echo "请先在后端仓库执行 make swagger，或用第一个参数指定后端仓库目录。" >&2
  exit 1
fi

if [ ! -x "$GENERATOR" ]; then
  echo "缺少 $GENERATOR，请先在本仓库执行 pnpm install。" >&2
  exit 1
fi

if [ ! -f "$BANNER" ]; then
  echo "缺少文件头模板：$BANNER" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

"$GENERATOR" generate -p "$SPEC" -o "$tmp_dir" -n schema.ts --no-client >/dev/null

mkdir -p "$(dirname "$CONTRACT")"
{
  cat "$BANNER"
  echo
  cat "$tmp_dir/schema.ts"
} > "$CONTRACT"

echo "已生成 ${CONTRACT}（来源：${SPEC}）"
