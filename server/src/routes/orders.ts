/**
 * 订单路由 CRUD + 状态流转 + 发货核对。
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  calcActualFinance,
  calcOrderFinance,
  orderStatusSchema,
  customerInfoSchema,
  shippingAddressSchema,
  cabinetSizeSchema,
  accessoryItemSchema,
  type OrderRecord,
  type OrderStatus,
  type CustomerInfo,
  type ShippingAddress,
  type CabinetSize,
  type AccessoryItem,
} from '@idlefish/shared';
import { getDb } from '../db/index.js';
import { nextBusinessNo, nowIso } from '../lib/no.js';
import { insertOrder } from '../lib/insert-order.js';
import { log } from '../lib/logger.js';

export const ordersRouter = Router();

/** 带 HTTP 状态码的错误，用于事务内抛出 */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const createOrderBodySchema = z.object({
  customer: customerInfoSchema,
  shippingAddress: shippingAddressSchema,
  size: cabinetSizeSchema,
  materials: z.array(accessoryItemSchema),
  materialCost: z.number().nonnegative(),
  otherFee: z.number().nonnegative().optional().default(0),
  actualPrice: z.number().nonnegative(),
  remark: z.string().optional().default(''),
});

const updateOrderBodySchema = createOrderBodySchema.partial();

const shipBodySchema = z.object({
  courier: z.string().min(1),
  trackingNo: z.string().min(1),
  actualFreight: z.number().nonnegative(),
  checkRemark: z.string().optional().default(''),
});

const statusTransition: Record<OrderStatus, OrderStatus[]> = {
  pending: ['producing', 'cancelled'],
  producing: ['ready', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['done'],
  done: [],
  cancelled: [],
};

// 列表
ordersRouter.get('/', (req, res) => {
  const { status } = req.query;
  const db = getDb();
  const rows = (
    status
      ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status as string)
      : db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all()
  ) as OrderRow[];
  res.json(rows.map(parseOrderRow).filter(Boolean) as OrderRecord[]);
});

// 详情
ordersRouter.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as
    | OrderRow
    | undefined;
  if (!row) return res.status(404).json({ error: '订单不存在' });
  const parsed = parseOrderRow(row);
  if (!parsed) return res.status(422).json({ error: '订单数据损坏' });
  res.json(parsed);
});

// 新建（手动空白订单）
ordersRouter.post('/', (req, res) => {
  const parsed = createOrderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const b = parsed.data;
  const db = getDb();
  const id = nanoid();
  const now = nowIso();
  const finance = {
    materialCost: b.materialCost,
    otherFee: b.otherFee,
    actualPrice: b.actualPrice,
    ...calcOrderFinance(b.materialCost, b.otherFee, b.actualPrice),
  };

  const tx = db.transaction(() => {
    const orderNo = nextBusinessNo(db, 'O', 'orders', 'order_no');
    insertOrder(db, {
      id,
      orderNo,
      quoteId: null,
      customer: b.customer,
      shippingAddress: b.shippingAddress,
      size: b.size,
      materials: b.materials,
      finance,
      remark: b.remark,
      now,
    });
    return orderNo;
  });
  const orderNo = tx();
  res.status(201).json({ id, orderNo, status: 'pending', finance });
});

// 编辑
ordersRouter.put('/:id', (req, res) => {
  const parsed = updateOrderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const b = parsed.data;
  const db = getDb();
  const now = nowIso();

  const tx = db.transaction(() => {
    // 事务内读取 + 校验 + 条件 UPDATE，防 TOCTOU：编辑期间订单被并发发货/完成
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as
      | OrderRow
      | undefined;
    if (!row) throw new HttpError(404, '订单不存在');
    if (row.status === 'shipped' || row.status === 'done') {
      throw new HttpError(400, '已发货/已完成的订单不可编辑');
    }

    let customer: CustomerInfo;
    let shippingAddress: ShippingAddress;
    let size: CabinetSize;
    let materials: AccessoryItem[];
    let oldFinance: { materialCost: number; otherFee: number; actualPrice: number };
    try {
      customer = b.customer ?? JSON.parse(row.customer);
      shippingAddress = b.shippingAddress ?? JSON.parse(row.shipping_address);
      size = b.size ?? JSON.parse(row.size);
      materials = b.materials ?? JSON.parse(row.materials);
      oldFinance = JSON.parse(row.finance);
    } catch {
      throw new HttpError(422, '订单数据损坏，无法编辑');
    }
    const materialCost = b.materialCost ?? oldFinance.materialCost;
    const otherFee = b.otherFee ?? oldFinance.otherFee;
    const actualPrice = b.actualPrice ?? oldFinance.actualPrice;
    const finance = {
      materialCost,
      otherFee,
      actualPrice,
      ...calcOrderFinance(materialCost, otherFee, actualPrice),
    };

    // 条件 UPDATE：仅当状态仍非 shipped/done 时才更新，防并发覆盖
    const upd = db
      .prepare(
        `UPDATE orders SET customer = ?, shipping_address = ?, size = ?, materials = ?, finance = ?, remark = ?, updated_at = ?
         WHERE id = ? AND status NOT IN ('shipped','done')`,
      )
      .run(
        JSON.stringify(customer),
        JSON.stringify(shippingAddress),
        JSON.stringify(size),
        JSON.stringify(materials),
        JSON.stringify(finance),
        b.remark ?? row.remark,
        now,
        req.params.id,
      );
    if (upd.changes === 0) throw new HttpError(409, '订单状态已变更，请刷新后重试');
    return finance;
  });

  try {
    const finance = tx();
    res.json({ id: req.params.id, finance, updatedAt: now });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: '编辑订单失败' });
  }
});

// 状态流转
ordersRouter.patch('/:id/status', (req, res) => {
  const parsed = z.object({ status: orderStatusSchema }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const next = parsed.data.status;
  const db = getDb();

  const tx = db.transaction(() => {
    const row = db.prepare('SELECT status, order_no FROM orders WHERE id = ?').get(req.params.id) as
      | { status: OrderStatus; order_no: string }
      | undefined;
    if (!row) throw new HttpError(404, '订单不存在');
    const allowed = statusTransition[row.status];
    if (!allowed.includes(next)) {
      throw new HttpError(400, `状态不可从 ${row.status} 流转到 ${next}`);
    }
    // 条件 UPDATE：仅当状态仍是读取的当前值时才更新，防并发覆盖
    const upd = db
      .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
      .run(next, nowIso(), req.params.id, row.status);
    if (upd.changes === 0) throw new HttpError(409, '订单状态已变更，请刷新后重试');
    return { orderNo: row.order_no, from: row.status };
  });

  try {
    const { orderNo, from } = tx();
    log.info('order', '状态流转', { orderNo, from, to: next, ip: req.ip });
    res.json({ id: req.params.id, status: next });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: '状态流转失败' });
  }
});

// 发货核对：ready → shipped
ordersRouter.post('/:id/ship', (req, res) => {
  const parsed = shipBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const b = parsed.data;
  const db = getDb();

  const tx = db.transaction(() => {
    // 事务内读取 + 条件 UPDATE，防并发发货覆盖
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as
      | OrderRow
      | undefined;
    if (!row) throw new HttpError(404, '订单不存在');
    if (row.status !== 'ready') throw new HttpError(400, '仅待发货订单可发货');

    const finance = JSON.parse(row.finance) as { estimatedCost: number; actualPrice: number };
    if (typeof finance.estimatedCost !== 'number' || typeof finance.actualPrice !== 'number') {
      throw new HttpError(422, '订单财务数据不完整');
    }
    const actual = calcActualFinance(finance.estimatedCost, finance.actualPrice, b.actualFreight);
    const now = nowIso();
    const shipping = {
      courier: b.courier,
      trackingNo: b.trackingNo,
      actualFreight: b.actualFreight,
      checkRemark: b.checkRemark,
      confirmedAt: now,
      ...actual,
    };
    // 条件 UPDATE：仅当状态仍为 ready 时才发货，防并发
    const upd = db
      .prepare(`UPDATE orders SET status = 'shipped', shipping = ?, updated_at = ? WHERE id = ? AND status = 'ready'`)
      .run(JSON.stringify(shipping), now, req.params.id);
    if (upd.changes === 0) throw new HttpError(400, '该订单已不在待发货状态');
    return shipping;
  });

  try {
    const shipping = tx();
    log.info('order', '发货成功', { id: req.params.id, courier: shipping.courier, trackingNo: shipping.trackingNo, ip: req.ip });
    res.json({ id: req.params.id, status: 'shipped', shipping });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: '发货失败' });
  }
});

// 删除
ordersRouter.delete('/:id', (req, res) => {
  const info = getDb().prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '订单不存在' });
  res.status(204).end();
});

interface OrderRow {
  id: string;
  order_no: string;
  quote_id: string | null;
  status: OrderStatus;
  customer: string;
  shipping_address: string;
  size: string;
  materials: string;
  finance: string;
  shipping: string | null;
  remark: string;
  created_at: string;
  updated_at: string;
}

function parseOrderRow(row: OrderRow): OrderRecord | null {
  try {
    return {
      id: row.id,
      orderNo: row.order_no,
      quoteId: row.quote_id,
      status: row.status,
      customer: JSON.parse(row.customer),
      shippingAddress: JSON.parse(row.shipping_address),
      size: JSON.parse(row.size),
      materials: JSON.parse(row.materials),
      finance: JSON.parse(row.finance),
      shipping: row.shipping ? JSON.parse(row.shipping) : null,
      remark: row.remark,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}
