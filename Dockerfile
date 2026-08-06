# syntax=docker/dockerfile:1
# IdleFish — 铝型材机柜报价工具
# 多阶段构建：builder 编译 + pnpm deploy 打包 server 生产依赖，runner 直接运行

# ---------- builder ----------
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

WORKDIR /app

# 利用缓存：先装全部依赖
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

# 拷源码并构建 shared → client → server
COPY packages/shared ./packages/shared
COPY client ./client
COPY server ./server
RUN pnpm --filter @idlefish/shared build \
    && pnpm --filter @idlefish/client build \
    && pnpm --filter @idlefish/server build

# pnpm deploy 把 server 及其生产依赖（含 @idlefish/shared）打包到 /app/deploy
# 产物：/app/deploy/node_modules、/app/deploy/dist、/app/deploy/package.json
# --legacy：pnpm v10 默认要求 inject-workspace-packages=true 才能 deploy，加此标志走传统 deploy
RUN pnpm --filter @idlefish/server deploy /app/deploy --prod --legacy

# ---------- runner ----------
FROM node:20-bookworm-slim AS runner

# gosu：entrypoint 以 root 修正 /data 权限后切 appuser
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

# 非 root 用户运行，降低容器逃逸风险
RUN groupadd --system --gid 1001 appgrp \
    && useradd --system --uid 1001 --gid appgrp --create-home appuser

WORKDIR /app

# 拷 server 生产依赖 + 构建产物（deploy 已含 dist 和 node_modules）
COPY --from=builder /app/deploy ./server
# 前端构建产物（server 静态托管）
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV IDLEFISH_DATA_DIR=/data

# 不在此处 USER appuser——entrypoint 需以 root 启动修正 /data 权限后再切
EXPOSE 3000

# entrypoint：root 修正 /data 属主 → gosu 切 appuser → 执行 node
# named volume 挂载后 /data 属主可能是 root，appuser 无写权限会导致 mkdir /data/logs 失败
ENTRYPOINT ["sh", "-c", "chown -R appuser:appgrp /data && exec gosu appuser node server/dist/index.js"]
