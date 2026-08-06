/**
 * 设置路由（单行读写）。
 */

import { Router } from 'express';
import { settingsSchema, type Settings } from '@idlefish/shared';
import { getDb } from '../db/index.js';
import { nowIso } from '../lib/no.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  const row = getDb().prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined;
  if (!row) return res.status(404).json({ error: '设置不存在' });
  res.json(JSON.parse(row.data) as Settings);
});

settingsRouter.put('/', (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const settings = parsed.data as Settings;
  getDb().prepare('UPDATE settings SET data = ? WHERE id = 1').run(JSON.stringify(settings));
  res.json({ updatedAt: nowIso() });
});
