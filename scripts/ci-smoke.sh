#!/usr/bin/env bash
# scripts/ci-smoke.sh — 推送前本地模拟 CI 测试门禁（对应 .github/workflows/docker.yml 的 test job）
#
# 做两件「CI 才会发生、本地开发树测不出来」的事：
#   1) 全新 clone —— 只包含【已提交】内容，工作区未提交改动与本地已有构建产物（如
#      packages/shared/dist）不参与，拦截「本地能跑、CI 解析不到」类问题
#   2) 可指定 Node 版本 —— 拦截「测试工具链与 CI Node 版本不兼容」类问题
#      （实例：jsdom 30 依赖 undici 8 需要 Node 22 特性，Node 20 下 vitest 启动即崩）
#
# 用法：
#   bash scripts/ci-smoke.sh                          # 用当前默认 Node
#   volta run --node 22 bash scripts/ci-smoke.sh      # 显式对齐 CI 主版本
#   volta run --node 20 bash scripts/ci-smoke.sh      # 复现指定版本环境
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Node $(node -v) / pnpm $(pnpm -v) =="

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "== 全新 clone 到临时目录 =="
git clone --quiet . "$TMP_DIR/repo"
cd "$TMP_DIR/repo"

echo "== pnpm install --frozen-lockfile =="
pnpm install --frozen-lockfile

echo "== build shared =="
pnpm --filter @idle-fish/shared build

echo "== test: shared =="
pnpm --filter @idle-fish/shared test
echo "== test: server =="
pnpm --filter @idle-fish/server test
echo "== test: client =="
pnpm --filter @idle-fish/client test

echo "== CI 冒烟通过（Node $(node -v)）=="
