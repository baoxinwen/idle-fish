/**
 * 设置路由（单行读写）。
 */

import { Router } from 'express';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '@idlefish/shared';
import { getDb } from '../db/index.js';
import { nowIso } from '../lib/no.js';
import { log } from '../lib/logger.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  const row = getDb().prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined;
  if (!row) return res.status(404).json({ error: '设置不存在' });
  // 经 schema 解析返回：存量行缺失的新增字段（如 brand）由 zod default 就地补全，
  // 而非把旧形状原样透传给前端；字段级非法时才整体回落种子默认值。
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(row.data));
    if (parsed.success) return res.json(parsed.data as Settings);
    log.error('settings', `settings.data 字段校验失败，回落默认值: ${JSON.stringify(parsed.error.flatten())}`);
  } catch (err) {
    // L2：settings.data 损坏（如恢复了一份内容非法的构造备份）不应让设置页永久 500——
    // quotes/orders 列表均有逐行容错，此处对齐；回落种子默认值保证应用可用。
    log.error('settings', `settings.data 解析失败，回落默认值: ${err instanceof Error ? err.message : String(err)}`);
  }
  res.json(DEFAULT_SETTINGS);
});

settingsRouter.put('/', (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const settings = parsed.data as Settings;
  getDb().prepare('UPDATE settings SET data = ? WHERE id = 1').run(JSON.stringify(settings));
  // 第八轮日志矩阵：影响此后所有报价/订单默认值的关键写操作，留痕（不放 payload，体积大且无必要）
  log.info('settings', '设置已更新', { ip: req.ip });
  res.json({ updatedAt: nowIso() });
});
