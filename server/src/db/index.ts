/**
 * SQLite 数据库实例 + 初始化 + 种子数据。
 */

import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import type { Database as DBType } from 'better-sqlite3';
import { DEFAULT_SETTINGS } from '@idlefish/shared';
import { SCHEMA_SQL } from './schema-sql.js';

/** 定位数据目录。
 *  - IDLEFISH_DATA_DIR 直接作为数据目录（Docker 等部署用，指向 /data）
 *  - 否则定位项目根（含 pnpm-workspace.yaml），用其下的 data/ 子目录
 */
function findDataDir(): string {
  const envDir = process.env.IDLEFISH_DATA_DIR;
  if (envDir) return envDir;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return join(dir, 'data');
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), 'data');
}

/** 数据文件目录 */
export const dataDir = findDataDir();
const dbPath = join(dataDir, 'idlefish.db');

let db: DBType | null = null;

/** 获取数据库实例（单例） */
export function getDb(): DBType {
  if (db) return db;
  mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  seedIfEmpty(db);
  return db;
}

/**
 * 打开指定路径的库用于结构校验（不建表、不种数据、不缓存为单例）。
 * 备份恢复后先校验结构是否匹配本应用，不匹配则回滚，避免被空库/异构库替换。
 */
export function openDatabaseForVerify(path: string): DBType {
  const d = new Database(path);
  d.pragma('foreign_keys = ON');
  return d;
}

/** 执行 schema 建表 */
function initSchema(database: DBType): void {
  database.exec(SCHEMA_SQL);
}

/** 首次启动写入默认设置 */
function seedIfEmpty(database: DBType): void {
  const row = database.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (row.c === 0) {
    database
      .prepare('INSERT INTO settings (id, data) VALUES (1, ?)')
      .run(JSON.stringify(DEFAULT_SETTINGS));
  }
}

/** 关闭数据库（测试/退出用） */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** 数据库文件路径（备份/导入用） */
export function getDbPath(): string {
  return dbPath;
}
