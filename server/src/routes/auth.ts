/**
 * 鉴权路由：首次设置 / 登录 / 登出 / 状态查询（公开，挂 gate 前）+ 改密（受保护，挂 gate 后）。
 * authRouter：公开，在 requireAuth gate 之前注册。
 * authProtectedRouter：需 session + 限流，在 gate 之后注册。
 */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { loginSchema, setupSchema } from '@idlefish/shared';
import { getDb } from '../db/index.js';
import {
  COOKIE_NAME,
  cookieOptions,
  createSession,
  destroySession,
  getUser,
  hashPassword,
  isSetupTokenValid,
  lookupSession,
  userExists,
  verifyPassword,
} from '../lib/auth.js';
import { nowIso } from '../lib/no.js';
import { log } from '../lib/logger.js';

export const authRouter = Router();
/** 受鉴权保护的 auth 路由（需 session + 限流）：改密等。挂在 requireAuth gate 之后。 */
export const authProtectedRouter = Router();

/**
 * 登录限流：1 分钟 5 次。配合 bcrypt(10) 单次约 100ms，计算侧已较慢。
 * 注意：限流按 req.ip 生效，需正确配置 trust proxy（见部署文档），否则可被伪造 XFF 绕过。
 */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请稍后再试' },
});

// 状态：是否已登录 + 是否需要首次设置（公开，前端 RequireAuth 用）
// 注意：needsSetup 暴露首启窗口信息，配合 setup token 门槛后风险可控
authRouter.get('/status', (req, res) => {
  const sid = req.cookies?.[COOKIE_NAME] as string | undefined;
  const authenticated = sid ? !!lookupSession(sid) : false;
  res.json({ authenticated, needsSetup: !userExists() });
});

// 首次设置：创建唯一管理员账户，之后不再开放
// 公网部署下需带 IDLEFISH_SETUP_TOKEN（请求头 x-setup-token），防止首启窗口被抢注
authRouter.post('/setup', authLimiter, async (req, res) => {
  if (userExists()) {
    return res.status(409).json({ error: '管理员账户已存在' });
  }
  // token 门槛：未配置或校验失败一律拒绝，不泄露 token 是否配置
  const provided = (req.headers['x-setup-token'] as string | undefined) ?? (req.body?.setupToken as string | undefined);
  if (!isSetupTokenValid(provided)) {
    return res.status(403).json({ error: 'setup token 无效或未配置' });
  }
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const { username, password } = parsed.data;
  const hash = await hashPassword(password);
  getDb()
    .prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (1, ?, ?, ?)')
    .run(username, hash, nowIso());
  // 创建会话并设 cookie，设置完直接登录态
  const { sid } = createSession(1);
  res.cookie(COOKIE_NAME, sid, cookieOptions());
  log.info('auth', '首次设置完成', { user: username, ip: req.ip });
  res.json({ authenticated: true });
});

// 登录
authRouter.post('/login', authLimiter, async (req, res) => {
  if (!userExists()) {
    return res.status(409).json({ error: '尚未初始化，请先完成首次设置', needsSetup: true });
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const { username, password } = parsed.data;
  const user = getUser();
  // 用户名或密码错误统一返回（不泄露用户名是否存在）
  if (!user || !(await verifyPassword(password, user.password_hash)) || user.username !== username) {
    log.warn('auth', '登录失败', { user: username, ip: req.ip });
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const { sid } = createSession(user.id);
  res.cookie(COOKIE_NAME, sid, cookieOptions());
  log.info('auth', '登录成功', { user: username, ip: req.ip });
  res.json({ authenticated: true });
});

// 登出：销毁会话 + 清 cookie（无有效会话也允许调用）
authRouter.post('/logout', (req, res) => {
  const sid = req.cookies?.[COOKIE_NAME] as string | undefined;
  let username: string | undefined;
  if (sid) {
    const u = lookupSession(sid);
    username = u?.username;
    destroySession(sid);
  }
  res.clearCookie(COOKIE_NAME, cookieOptions(true));
  log.info('auth', '登出', { user: username, ip: req.ip });
  res.json({ ok: true });
});

// 改密：需当前会话（requireAuth gate）+ 限流 + 旧密码校验。
// 挂在 authProtectedRouter 上，在 index.ts 的 gate 之后注册。
authProtectedRouter.post('/password', authLimiter, async (req, res) => {
  const parsed = z
    .object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    })
    .refine((d) => d.newPassword !== d.oldPassword, {
      path: ['newPassword'],
      message: '新密码不能与旧密码相同',
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const { oldPassword, newPassword } = parsed.data;
  const user = getUser();
  if (!user) return res.status(409).json({ error: '尚未初始化' });
  if (!(await verifyPassword(oldPassword, user.password_hash))) {
    log.warn('auth', '改密失败（旧密码错误）', { user: user.username, ip: req.ip });
    // 用 400（客户端输入错误）而非 401（会话失效）：
    // 避免前端把「旧密码错误」误判为会话过期而强制跳登录
    return res.status(400).json({ error: '旧密码错误' });
  }
  const newHash = await hashPassword(newPassword);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(newHash);
  // 会话轮换：销毁全部会话（含当前），再为新密码签发新会话，
  // 被窃取的旧 cookie 副本在改密后立即失效（之前 destroyOtherSessions 保留当前会话）。
  const currentSid = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (currentSid) destroySession(currentSid);
  const { sid } = createSession(user.id);
  res.cookie(COOKIE_NAME, sid, cookieOptions());
  log.info('auth', '改密成功，已轮换会话', { user: user.username, ip: req.ip });
  res.json({ ok: true });
});
