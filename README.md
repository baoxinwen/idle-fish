# IdleFish — 铝型材机柜报价工具

把「报价 → 订单 → 生产 → 发货」全链路数字化的单用户 Web 工具。

## 技术栈

- **前端**：React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **3D**：React Three Fiber + drei
- **图表**：Recharts
- **后端**：Node + Express + better-sqlite3
- **共享**：计价引擎、类型、zod schema（`packages/shared`）

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 同时启动前后端
#   后端: http://localhost:3000  (API + 生产期托管前端)
#   前端: http://localhost:4173  (开发期 Vite, /api 代理到 3000)
```

## 构建 & 运行

```bash
pnpm build          # 构建 shared / client / server
pnpm start          # 启动后端, 单端口 http://localhost:3000 托管前端
```

## 测试

```bash
pnpm test           # 运行 shared 计价引擎单元测试
```

## Docker 部署

镜像由 GitHub Actions 自动构建并推送至 GHCR。本地只需 `docker-compose.yml`：

```bash
# 下载 docker-compose.yml 后执行
docker compose up -d
# 访问 http://localhost:3000
```

数据持久化在 `idlefish-data` 卷（SQLite 文件）。停止：`docker compose down`，停止并删数据：`docker compose down -v`。

如需自行构建镜像：

```bash
docker compose build   # 用本地 Dockerfile 构建
docker compose up -d
```

### 首次启动

容器首次启动会自动生成 setup token 并打到日志，用于创建管理员账户：

```bash
docker logs idlefish   # 抄取 setup token
```

打开 `http://<域名>/setup`，填入 token + 用户名 + 密码创建唯一管理员。之后访问 `/login` 登录。

### 部署要点（公网）

- 公网访问经反向代理或隧道（如 nginx/Caddy、Cloudflare Tunnel）终结 HTTPS，应用不自行处理证书
- 代理需透传真实客户端 IP 的 `X-Forwarded-For`；`IDLEFISH_TRUST_PROXY` 与代理跳数匹配（单层=1，compose 已设），登录限流才能按真实 IP 生效

## 目录结构

```
IdleFish/
├── packages/
│   └── shared/      # 前后端共享：类型、zod、计价纯函数
├── client/          # React 前端
├── server/          # Express + SQLite 后端
├── data/            # SQLite 数据文件（gitignore，运行时生成）
├── Dockerfile       # 多阶段构建
├── docker-compose.yml
└── .github/workflows/  # 自动构建镜像
```


