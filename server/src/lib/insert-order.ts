/**
 * 订单插入辅助函数 — 转单和手动新建共用，避免 SQL 重复。
 */

import type { Database as DBType } from 'better-sqlite3';
import type { CabinetSize, AccessoryItem, CustomerInfo, ShippingAddress, OrderFinance } from '@idlefish/shared';

export interface InsertOrderParams {
  id: string;
  orderNo: string;
  quoteId: string | null;
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  size: CabinetSize;
  materials: AccessoryItem[];
  finance: OrderFinance;
  remark: string;
  now: string;
}

/** 插入订单行（pending 状态），转单和手动新建共用 */
export function insertOrder(db: DBType, p: InsertOrderParams): void {
  db.prepare(
    `INSERT INTO orders (id, order_no, quote_id, status, customer, shipping_address, size, materials, finance, shipping, remark, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  ).run(
    p.id,
    p.orderNo,
    p.quoteId,
    JSON.stringify(p.customer),
    JSON.stringify(p.shippingAddress),
    JSON.stringify(p.size),
    JSON.stringify(p.materials),
    JSON.stringify(p.finance),
    p.remark,
    p.now,
    p.now,
  );
}
