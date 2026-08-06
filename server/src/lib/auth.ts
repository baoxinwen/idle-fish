/**
 * 鉴权工具：bcrypt 密码哈希 + 服务端会话 + requireAuth 中间件。
 * 会话存 sessions 表，cookie 存不透明 session id（nanoid），
 * 支持真正的登出（删行即服务端撤销）。
 */

import type { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { log } from './logger.js';
import { getDb } from '../db/index.js';
import { dataDir } from '../db/index.js';
import { nowIso } from './no.js';

export const COOKIE_NAME = 'idlefish_session';
/** 会话有效期 7 天 */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 滑动续期阈值：距过期不足 1 天时续期 */
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** setup token 文件路径（持久化在数据目录，首次生成后复用） */
const SETUP_TOKEN_PATH = join(dataDir, 'setup-token');
/** 内存缓存的 token，ensureSetupToken 初始化后填充 */
let setupTokenCache: string | null = null;

/**
 * 首启 setup token：首次启动自动生成随机串，持久化到 /data/setup-token，打到日志一次。
 * 之后重启读已有文件，不再打日志。公网部署首启窗口内，/api/auth/setup 需带此 token 才能创建管理员。
 * 首启完成后可忽略（setup 端点对已初始化实例返回 409）。
 * 在服务启动时调用一次 ensureSetupToken() 初始化。
 */
export function ensureSetupToken(): void {
  if (setupTokenCache) return;
  // 读已有 token 文件
  if (existsSync(SETUP_TOKEN_PATH)) {
    try {
      const t = readFileSync(SETUP_TOKEN_PATH, 'utf8').trim();
      if (t.length > 0) {
        setupTokenCache = t;
        return;
      }
    } catch {
      // 读取失败则重新生成
    }
  }
  // 生成 32 字节随机串（hex 编码 = 64 字符）
  const token = randomBytes(32).toString('hex');
  try {
    writeFileSync(SETUP_TOKEN_PATH, token, { mode: 0o600 });
    chmodSync(SETUP_TOKEN_PATH, 0o600);
  } catch {
    // 写入失败（如只读挂载）则仅内存持有，重启后失效——仍 fail-closed 安全
  }
  setupTokenCache = token;
  // 仅首次生成时打到日志（stdout + app.log），供部署者抄取
  log.info('auth', '首次 setup token 生成（用于 /setup 页创建管理员，请妥善保管，首启后可忽略）');
  log.info('auth', '========================================');
  log.info('auth', token);
  log.info('auth', '========================================');
}

/** 取当前 setup token（未初始化返回 null，调用方应先 ensureSetupToken） */
export function getSetupToken(): string | null {
  return setupTokenCache;
}

/** 校验 setup 请求带的 token（timingSafeEqual 恒定时间比较，防时序侧信道） */
export function isSetupTokenValid(provided: string | undefined): boolean {
  const expected = getSetupToken();
  if (!expected) return false; // 未初始化 token（启动未调 ensureSetupToken）则拒绝
  if (!provided) return false;
  // timingSafeEqual 要求等长 Buffer；长度不等时仍走完比较避免长度时序侧信道
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // 与自身比较消耗同等时间，再返回 false
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

/** cookie 选项：httpOnly + SameSite=Strict + 生产 Secure。isClear 用于清除 cookie */
export function cookieOptions(isClear = false) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: isClear ? 0 : SESSION_MAX_AGE_MS,
  };
}

/** 当前 ISO 时间（复用 no.ts，保证与 quotes/orders 口径一致，含毫秒） */

/** 计算 expires_at（now + 7d） */
function expiryIso(): string {
  return new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
}

/** bcrypt 哈希（rounds=10） */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** 校验密码 */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 是否已存在管理员账户 */
export function userExists(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  return row.c > 0;
}

/** 取管理员账户（id 固定 1） */
export function getUser(): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = 1').get() as UserRow | undefined;
}

/**
 * 创建会话：插入 sessions 行，返回 session id + expires_at。
 * 顺带清理过期会话（best-effort）。
 */
export function createSession(userId: number): { sid: string; expiresAt: string } {
  const db = getDb();
  const sid = nanoid(32);
  const now = nowIso();
  const expiresAt = expiryIso();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    db.prepare(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    ).run(sid, userId, expiresAt, now);
  });
  tx();
  return { sid, expiresAt };
}

/** 查会话：有效（存在且未过期）则返回 { userId, username }，否则 null */
export function lookupSession(sid: string): { userId: number; username: string } | null {
  const now = nowIso();
  const row = getDb()
    .prepare(
      `SELECT s.user_id as userId, u.username as username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(sid, now) as { userId: number; username: string } | undefined;
  return row ?? null;
}

/**
 * 滑动续期：距过期不足 1 天时才 UPDATE 服务端 expires_at，
 * 并重发 Set-Cookie 刷新客户端 maxAge（否则活跃用户 7 天后仍被登出）。
 * 返回是否续期了。
 */
export function touchSession(sid: string, res?: Response): boolean {
  const db = getDb();
  const row = db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get(sid) as
    | Pick<SessionRow, 'expires_at'>
    | undefined;
  if (!row) return false;
  const expiresMs = new Date(row.expires_at).getTime();
  if (expiresMs - Date.now() > SESSION_REFRESH_THRESHOLD_MS) return false; // 还早，不续
  const newExpiry = expiryIso();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, sid);
  // 重发 cookie 刷新客户端 maxAge，与服务端 expires_at 同步
  if (res) res.cookie(COOKIE_NAME, sid, cookieOptions());
  return true;
}

/** 销毁会话（登出/撤销） */
export function destroySession(sid: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

/** 销毁除指定 sid 外的全部会话（改密后踢出其他设备/可能已泄露的会话） */
export function destroyOtherSessions(keepSid: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id != ?').run(keepSid);
}

/** 鉴权中间件：校验 cookie 中的 session id，无效则 401 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sid = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!sid) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const user = lookupSession(sid);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  res.locals.user = user;
  // 滑动续期 best-effort，失败不影响请求
  try {
    touchSession(sid, res);
  } catch {
    // ignore
  }
  next();
}
