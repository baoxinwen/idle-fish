/**
 * 业务编号生成（事务内调用，保证原子性）。
 */

import type { Database as DBType } from 'better-sqlite3';
import { genBusinessNo } from '@idlefish/shared';

/**
 * 本地时区日期串 YYYY-MM-DD。
 * new Date().toISOString() 是 UTC，本地（如东八区）上午会算成昨天。
 * 用 toLocaleDateString('en-CA') 取本地日期（en-CA 格式即 YYYY-MM-DD）。
 */
export function localDateString(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

/**
 * 在事务内生成当日下一个编号。
 * @param db 当前事务的数据库连接
 * @param prefix 'Q' 报价 / 'O' 订单
 * @param table 'quotes' | 'orders'
 * @param column 编号列名
 */
export function nextBusinessNo(
  db: DBType,
  prefix: 'Q' | 'O',
  table: 'quotes' | 'orders',
  column: 'quote_no' | 'order_no',
): string {
  const today = localDateString(); // 本地日期 YYYY-MM-DD
  const prefixStr = `${prefix}-${today.replace(/-/g, '')}-`;

  // 查当日所有编号，提取序号数字取最大值（避免字符串排序在序号≥100时错乱）
  const rows = db
    .prepare(`SELECT ${column} as no FROM ${table} WHERE ${column} LIKE ?`)
    .all(`${prefixStr}%`) as { no: string }[];
  const maxSeq = rows.reduce((max, r) => {
    const seqStr = r.no.slice(prefixStr.length);
    const seq = parseInt(seqStr, 10);
    return Number.isNaN(seq) ? max : Math.max(max, seq);
  }, 0);

  const seq = maxSeq + 1;
  return genBusinessNo(prefix, today, seq);
}

/** 当前 ISO 时间（含毫秒，保证同秒记录 created_at 不同，ORDER BY created_at 稳定） */
export function nowIso(): string {
  return new Date().toISOString();
}
