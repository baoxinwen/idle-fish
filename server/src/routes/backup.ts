/**
 * 数据库备份 / 导入恢复路由。
 *  - GET  /api/backup        下载当前 .db 文件
 *  - POST /api/backup/restore 上传 .db 文件覆盖恢复（先自动备份当前库）
 */

import { Router } from 'express';
import multer from 'multer';
import { copyFileSync, createReadStream, createWriteStream, existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Database as DBType } from 'better-sqlite3';
import { getDb, getDbPath, closeDb, openDatabaseForVerify } from '../db/index.js';
import { log } from '../lib/logger.js';

/** 保留最近 N 份恢复前自动备份，超出清理（避免长期堆积） */
const MAX_AUTO_BACKUPS = 5;

/** SQLite 文件头 magic：前 16 字节为 "SQLite format 3\0" */
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'utf8');
function isSqliteFile(path: string): boolean {
  try {
    const head = readFileSync(path, { encoding: null }).subarray(0, 16);
    return SQLITE_MAGIC.equals(head);
  } catch {
    return false;
  }
}

/**
 * 结构健康检查：验证恢复后的库含本应用所需全部表与关键列。
 * 防止攻击者上传一个仅头部正确的 SQLite 文件（如自建空库）整体替换用户数据，
 * 也防止恢复结构不匹配的旧库后应用大面积报错。
 * 含 users 表校验：恢复鉴权特性前的老备份（无 users 表）会重新打开 setup 抢注窗口，
 * 这里直接拒绝，配合 setup token 门槛收口。
 */
const REQUIRED_TABLES: { table: string; columns: string[] }[] = [
  { table: 'quotes', columns: ['id', 'quote_no', 'status', 'input', 'result', 'created_at', 'updated_at'] },
  { table: 'orders', columns: ['id', 'order_no', 'status', 'customer', 'finance', 'created_at', 'updated_at'] },
  { table: 'settings', columns: ['id', 'data'] },
  { table: 'users', columns: ['id', 'username', 'password_hash', 'created_at'] },
];
function verifySchema(database: DBType): void {
  for (const { table, columns } of REQUIRED_TABLES) {
    const row = database
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table) as { name: string } | undefined;
    if (!row) throw new Error(`恢复的数据库缺少表 ${table}`);
    const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const colNames = new Set(cols.map((c) => c.name));
    for (const col of columns) {
      if (!colNames.has(col)) throw new Error(`恢复的数据库表 ${table} 缺少列 ${col}`);
    }
  }
  // users 表必须恰好 1 行（管理员账户），否则恢复后状态异常（空表会重开 setup 窗口）
  const userCount = database.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (userCount.c !== 1) {
    throw new Error(`恢复的数据库 users 表须恰好 1 行，实际 ${userCount.c} 行`);
  }
}

/** 清理过期的恢复前自动备份，仅保留最近 MAX_AUTO_BACKUPS 份 */
function pruneAutoBackups(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const backups = entries
    .filter((f) => f.startsWith('idlefish-before-restore-') && f.endsWith('.db'))
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // 新在前
  for (const { f } of backups.slice(MAX_AUTO_BACKUPS)) {
    try {
      unlinkSync(join(dir, f));
    } catch {
      // 单个清理失败忽略，不影响恢复流程
    }
  }
}

export const backupRouter = Router();

/** 备份文件最大 100MB */
const MAX_BACKUP_SIZE = 100 * 1024 * 1024;
const upload = multer({ dest: join(dirname(getDbPath()), '_uploads'), limits: { fileSize: MAX_BACKUP_SIZE } });

// 导出当前数据库
backupRouter.get('/', async (_req, res) => {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return res.status(404).json({ error: '数据库文件不存在' });
  // 先 checkpoint：把 WAL 中未合并的写入刷入主库，确保导出的 .db 含全部最新数据
  try {
    getDb().pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // checkpoint 失败不阻断导出（极端情况导出可能略旧）
  }
  const date = new Date().toISOString().slice(0, 10);
  const filename = `idlefish-backup-${date}.db`;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', statSync(dbPath).size);
  log.info('backup', '导出数据库', { ip: _req.ip });
  await pipeline(createReadStream(dbPath), res);
});

// 导入恢复
backupRouter.post('/restore', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });
  const dbPath = getDbPath();
  const dir = dirname(dbPath);

  // 1) 先校验上传文件是合法 SQLite，不合法直接拒绝，不触碰原库
  if (!isSqliteFile(req.file.path)) {
    unlinkSync(req.file.path);
    return res.status(400).json({ error: '文件不是有效的 SQLite 数据库' });
  }

  // 2) 结构健康检查：在上传的临时文件上校验表结构是否匹配本应用。
  //    通过才替换原库，避免被空库/异构库整体替换后应用大面积报错。
  //    在替换原库前做，校验失败可零成本拒绝。
  try {
    const verifyDb = openDatabaseForVerify(req.file.path);
    try {
      verifySchema(verifyDb);
    } finally {
      verifyDb.close();
    }
  } catch (err) {
    unlinkSync(req.file.path);
    return res.status(400).json({ error: '恢复失败：数据库结构不匹配', detail: String(err) });
  }

  let autoBackupPath: string | null = null;
  try {
    // 3) 先把当前库 WAL 合并进主文件（TRUNCATE），保证后续备份/替换拿到完整数据；
    //    checkpoint 失败不阻断（极端情况备份略旧）
    try {
      getDb().pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // ignore
    }

    // 4) 关闭当前连接
    closeDb();

    // 5) 自动备份当前库（若存在）：用 copy 而非 rename —— 原库保持在 dbPath 原位，
    //    消除「closeDb 后、替换前」dbPath 缺失的崩溃窗口（崩溃时重启不会建出空库）
    if (existsSync(dbPath)) {
      const ts = Date.now();
      autoBackupPath = join(dir, `idlefish-before-restore-${ts}.db`);
      copyFileSync(dbPath, autoBackupPath);
    }

    // 6) 用上传文件替换 dbPath：POSIX 上 renameSync 原子覆盖已存在目标；
    //    Windows 目标存在会报错，回退到 unlink + rename，再回退到流式覆盖
    try {
      renameSync(req.file.path, dbPath);
    } catch {
      try {
        unlinkSync(dbPath);
        renameSync(req.file.path, dbPath);
      } catch {
        await pipeline(createReadStream(req.file.path), createWriteStream(dbPath));
        unlinkSync(req.file.path);
      }
    }

    // 7) 清理旧库残留的 -wal/-shm（属于旧库，不应被新库继承）
    for (const suffix of ['-wal', '-shm']) {
      const stale = dbPath + suffix;
      if (existsSync(stale)) {
        try {
          unlinkSync(stale);
        } catch {
          // 忽略：清理失败不影响主流程
        }
      }
    }

    // 8) 重新打开（getDb 会幂等建表，恢复的库结构已校验通过）
    getDb();

    // 9) 清理过期的恢复前自动备份，仅保留最近若干份
    pruneAutoBackups(dir);

    res.json({
      ok: true,
      autoBackup: autoBackupPath ? basename(autoBackupPath) : null,
      message: '恢复成功，已自动备份原库',
    });
    log.info('backup', '恢复成功', { autoBackup: autoBackupPath ? basename(autoBackupPath) : null, ip: req.ip });
  } catch (err) {
    // 回滚：把 autoBackup 移回 dbPath，恢复连接，避免应用持续不可用
    try {
      if (autoBackupPath && existsSync(autoBackupPath)) {
        if (existsSync(dbPath)) unlinkSync(dbPath); // 删除损坏的 dbPath
        renameSync(autoBackupPath, dbPath);
      }
      getDb(); // 重新打开原库
    } catch (rollbackErr) {
      // 回滚也失败：至少返回明确错误，db 保持 null，下次 getDb 会按 dbPath 重试
      return res.status(500).json({
        error: '恢复失败且回滚失败，请手动恢复 data 目录下的 idlefish-before-restore-*.db',
        detail: String(err),
        rollback: String(rollbackErr),
      });
    }
    res.status(500).json({ error: '恢复失败，已回滚到原库', detail: String(err) });
  }
});
