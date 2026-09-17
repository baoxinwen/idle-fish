/**
 * 数据库备份 / 导入恢复路由。
 *  - GET  /api/backup        下载当前 .db 文件
 *  - POST /api/backup/restore 上传 .db 文件覆盖恢复（先自动备份当前库）
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { copyFileSync, createReadStream, createWriteStream, existsSync, closeSync, openSync, readSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Database as DBType } from 'better-sqlite3';
import { getDb, getDbPath, closeDb, openDatabaseForVerify } from '../db/index.js';
import { log } from '../lib/logger.js';
import { rollbackRestore } from '../lib/restore-rollback.js';
import { asyncHandler } from '../lib/http-error.js';

/** 保留最近 N 份恢复前自动备份，超出清理（避免长期堆积） */
const MAX_AUTO_BACKUPS = 5;

/** SQLite 文件头 magic：前 16 字节为 "SQLite format 3\0" */
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'utf8');
function isSqliteFile(path: string): boolean {
  // 只读前 16 字节判魔数：此前用 readFileSync 整读文件（上限 100MB 全量进内存），纯属浪费
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const head = Buffer.alloc(16);
    const bytesRead = readSync(fd, head, 0, 16, 0);
    if (bytesRead < 16) return false;
    return SQLITE_MAGIC.equals(head);
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
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
    .filter((f) => f.startsWith('idle-fish-before-restore-') && f.endsWith('.db'))
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
  const dir = dirname(dbPath);
  if (!existsSync(dbPath)) return res.status(404).json({ error: '数据库文件不存在' });
  // 用 better-sqlite3 在线备份 API 生成一致性快照后再发送。
  // 此前「checkpoint 后直接流式读主库文件」有竞态：传输窗口内若其他请求累计提交约
  // wal_autocheckpoint(1000) 页写入，自动检查点会把页写回正在被读取的主文件，
  // 接收端拿到新旧混杂的损坏备份；且预发的 Content-Length 随文件增长漂移。
  const date = new Date().toISOString().slice(0, 10);
  const snapshotPath = join(dir, `_export-${Date.now()}.tmp`);
  try {
    await getDb().backup(snapshotPath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="idle-fish-backup-${date}.db"`);
    res.setHeader('Content-Length', statSync(snapshotPath).size);
    res.setHeader('Cache-Control', 'no-store'); // 整库备份禁止任何中间层缓存
    log.info('backup', '导出数据库', { ip: _req.ip });
    await pipeline(createReadStream(snapshotPath), res);
  } catch (err) {
    // M-3：客户端取消下载（ERR_STREAM_PREMATURE_CLOSE）属正常操作，降为 info，
    // 避免例行中止污染 error 日志掩盖真实故障
    if ((err as { code?: string })?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
      log.info('backup', '导出中断：客户端取消下载', { ip: _req.ip });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    log.error('backup', `导出失败: ${msg}`);
    if (!res.headersSent) {
      res.status(500).json({ error: '数据库导出失败' });
    } else {
      res.end();
    }
  } finally {
    try { unlinkSync(snapshotPath); } catch { /* ignore */ }
  }
});

/** S-5：跨平台替换目标文件——POSIX rename 原子覆盖已存在目标；Windows 目标存在时报错，
 *  降级为 unlink+rename，再降级为流式覆盖。三级降级链自包含、可独立测试。 */
async function replaceDbFile(target: string, src: string): Promise<void> {
  try {
    renameSync(src, target);
    return;
  } catch {
    // 继续降级
  }
  try {
    unlinkSync(target);
    renameSync(src, target);
    return;
  } catch {
    // 最后降级为流式复制
  }
  await pipeline(createReadStream(src), createWriteStream(target));
  unlinkSync(src);
}

// 导入恢复
// M-1：async rejection 必须经 asyncHandler 转发（Express 4 不转发，裸 async 会悬挂请求）
backupRouter.post('/restore', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });
  const dbPath = getDbPath();
  const dir = dirname(dbPath);

  // 1) 先校验上传文件是合法 SQLite，不合法直接拒绝，不触碰原库
  if (!isSqliteFile(req.file.path)) {
    // M-1：临时文件清理失败（如 Windows 杀软短暂锁定）不应使请求悬挂
    try {
      unlinkSync(req.file.path);
    } catch {
      // 残留由启动清扫兜底
    }
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
    const verifyErrMsg = err instanceof Error ? err.message : String(err);
    log.warn('backup', `恢复被拒绝（结构校验）: ${verifyErrMsg}`, { ip: req.ip });
    try { unlinkSync(req.file.path); } catch { /* ignore */ }
    // 对外只给固定文案：err.message 可能含表名/文件路径等内部细节
    return res.status(400).json({ error: '恢复失败：数据库结构不匹配' });
  }

  let autoBackupPath: string | null = null;
  // C-1：copyFileSync 成功完成后才置 true。回滚决策依赖此标志——
  // 复制中途失败时 dbPath 仍是完好原库，绝不可被残缺副本顶替。
  let autoBackupReady = false;
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
      autoBackupPath = join(dir, `idle-fish-before-restore-${ts}.db`);
      copyFileSync(dbPath, autoBackupPath);
      autoBackupReady = true;
    }

    // 6) 用上传文件替换 dbPath（S-5：跨平台三级降级链抽为独立函数）
    await replaceDbFile(dbPath, req.file.path);

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

    // 8.1) 清空随库带入的 sessions（M2）：上传备份中的 session 行一律视为不可信凭据——
    //      恢复一份「改密前」的备份会同时复活旧密码 hash 与当时的活跃会话行，抵消轮换意义；
    //      共享/来路不明的备份中未过期 sid 的持有者将无需密码直接登录。
    //      清空后所有客户端（含当前管理员）强制重新登录。
    getDb().prepare('DELETE FROM sessions').run();

    // 9) 清理过期的恢复前自动备份，仅保留最近若干份
    pruneAutoBackups(dir);

    res.json({
      ok: true,
      autoBackup: autoBackupPath ? basename(autoBackupPath) : null,
      message: '恢复成功，已自动备份原库；所有用户需重新登录',
    });
    log.info('backup', '恢复成功', { autoBackup: autoBackupPath ? basename(autoBackupPath) : null, ip: req.ip });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('backup', `恢复失败: ${errMsg}`, { ip: req.ip });
    // 回滚：把 autoBackup 移回 dbPath，恢复连接，避免应用持续不可用。
    // rollbackRestore 区分失败阶段：复制中途失败时保留完好原库、只清理残缺副本（C-1）
    try {
      rollbackRestore({ dbPath, autoBackupPath, autoBackupReady });
      getDb(); // 重新打开原库
    } catch (rollbackErr) {
      const rollMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      log.error('backup', `恢复失败且回滚失败: ${rollMsg}`, { ip: req.ip });
      // 不回传 err/rollback 详情（Error message 可能含绝对路径），只给处置指引
      return res.status(500).json({
        error: '恢复失败且回滚失败，请手动恢复 data 目录下的 idle-fish-before-restore-*.db',
      });
    }
    res.status(500).json({ error: '恢复失败，已回滚到原库' });
  }
}));

// 启动时清扫上次运行残留的临时文件：
//  - _uploads/：multer 上传临时文件（上传完成后的处理失败路径会清理，进程被 SIGKILL/OOM 打断时来不及）
//  - _export-*.tmp：备份导出快照（M-2：finally unlink 覆盖不到进程被杀的场景）
// 启动瞬间不可能有进行中的上传/导出，全量清空安全。
try {
  const dataDir = dirname(getDbPath());
  for (const f of readdirSync(dataDir)) {
    if (!(f.startsWith('_export-') && f.endsWith('.tmp'))) continue;
    try { unlinkSync(join(dataDir, f)); } catch { /* 单个失败忽略 */ }
  }
  const uploadsDir = join(dataDir, '_uploads');
  for (const f of readdirSync(uploadsDir)) {
    try { unlinkSync(join(uploadsDir, f)); } catch { /* 单个失败忽略 */ }
  }
} catch {
  /* 目录不存在等，忽略 */
}

// S-2②：multer 中间件错误（如超 100MB 触发 LIMIT_FILE_SIZE）经 next(err) 到达这里。
// 若落全局 errorHandler 会被误报为 500/error 级日志——实为客户端输入问题：
// multer 错误按 400 处理（超限给明确文案），其余按 500 泛化；级别统一降为 warn。
backupRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  const isMulter = err instanceof multer.MulterError;
  log.warn('backup', `备份上传失败: ${msg}`, { isMulter });
  if (res.headersSent) return;
  if (isMulter && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: '备份文件过大（上限 100MB）' });
    return;
  }
  res.status(isMulter ? 400 : 500).json({ error: '备份上传失败' });
});
