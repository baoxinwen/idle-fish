/**
 * Express 服务入口。
 *  - 开发期：仅 API（前端由 Vite 在 4173 起，proxy /api 到此）
 *  - 生产期：同时静态托管 client 构建产物（经 nginx/Caddy 反代对外，HTTPS 在代理层终结）
 * 鉴权：除 /api/health 与 /api/auth/* 外，所有 /api/* 受 requireAuth gate 保护。
 */

import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from './db/index.js';
import { requireAuth, ensureSetupToken } from './lib/auth.js';
import { log } from './lib/logger.js';
import { requestLog } from './lib/request-log.js';
import { authRouter, authProtectedRouter } from './routes/auth.js';
import { quotesRouter } from './routes/quotes.js';
import { ordersRouter } from './routes/orders.js';
import { settingsRouter } from './routes/settings.js';
import { statsRouter } from './routes/stats.js';
import { backupRouter } from './routes/backup.js';

const PORT = Number(process.env.PORT ?? 3000);
// 绑定地址：默认 0.0.0.0（公网部署经反代对外；Docker 内 docker-proxy 连入）。
// 可用 IDLEFISH_HOST 覆盖。
const BIND_HOST = process.env.IDLEFISH_HOST ?? '0.0.0.0';

const app = express();
// 经 Cloudflare Tunnel / 反向代理后让 express-rate-limit 见真实客户端 IP
//（隧道/反代 1 跳 → 1，dev 0 跳 → 0，可用 IDLEFISH_TRUST_PROXY 覆盖）
app.set('trust proxy', Number(process.env.IDLEFISH_TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : 0)));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// 请求日志（在路由前注册，记录所有 /api/* 请求）
app.use(requestLog);

// 健康检查（公开，gate 之前）
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'idlefish-server', time: new Date().toISOString() });
});

// 鉴权路由（公开，gate 之前）
app.use('/api/auth', authRouter);

// 鉴权 gate：以下所有 /api/* 需有效会话
app.use('/api', requireAuth);

// 受保护的 auth 路由（改密等，需 session + 限流）
app.use('/api/auth', authProtectedRouter);

// 业务路由（受 gate 保护）
app.use('/api/quotes', quotesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/backup', backupRouter);

// 生产期静态托管前端构建产物
const clientDist = resolve(process.cwd(), 'client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA 回退：非 /api 路径统一返回 index.html（/login、/setup 由前端路由处理）
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(resolve(clientDist, 'index.html'));
  });
}

// 启动时初始化数据库
getDb();
// 初始化 setup token（首次生成随机串并打到日志，之后读 /data/setup-token）
ensureSetupToken();

// 全局错误处理：未捕获的异常统一返回 JSON（避免 Express 默认 HTML 500）
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  log.error('server', `未捕获错误: ${err instanceof Error ? err.message : String(err)}`, {
    method: req.method,
    path: req.path,
    stack: err instanceof Error ? err.stack : undefined,
  });
  // 不返回内部错误详情（err.message 可能含 SQL/路径等内部信息，公网不应对外泄漏），
  // 完整 stack 已在上面的日志中记录，可据此排查。
  res.status(500).json({ error: '服务器内部错误' });
};
app.use(errorHandler);

app.listen(PORT, BIND_HOST, () => {
  log.info('server', `IdleFish server running at http://${BIND_HOST}:${PORT}`);
});
