/**
 * 订单路由 CRUD + 状态流转 + 发货核对。
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  calcActualFinance,
  calcOrderFinance,
  money,
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
  type OrderFinance,
} from '@idle-fish/shared';
import { getDb } from '../db/index.js';
import { nextBusinessNo, nowIso } from '../lib/no.js';
import { singleQueryParam } from '../lib/query.js';
import { assertOrderTransition } from '../lib/order-transition.js';
import { normalizeOrderFinance, parseRawOrderFinance } from '../lib/order-finance.js';
import { insertOrder } from '../lib/insert-order.js';
import { log } from '../lib/logger.js';
import { HttpError, sendTxError } from '../lib/http-error.js';

export const ordersRouter = Router();

const createOrderBodySchema = z.object({
  customer: customerInfoSchema,
  shippingAddress: shippingAddressSchema,
  size: cabinetSizeSchema,
  materials: z.array(accessoryItemSchema),
  materialCost: money(),
  installFee: money().optional().default(0),
  freight: money().optional().default(0),
  actualPrice: money(),
  remark: z.string().max(1000).optional().default(''),
});

const updateOrderBodySchema = createOrderBodySchema.partial();

const shipBodySchema = z.object({
  courier: z.string().min(1).max(50),
  trackingNo: z.string().min(1).max(64),
  actualFreight: money(),
  checkRemark: z.string().max(1000).optional().default(''),
});

// 列表
ordersRouter.get('/', (req, res) => {
  const status = singleQueryParam(req.query.status);
  // I-1：数组/对象形态（qs 扩展解析产物）在此收口为 400，不直达 SQL
  if (status === null) {
    return res.status(400).json({ error: '参数校验失败' });
  }
  const db = getDb();
  const rows = (
    status
      ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status)
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
  const body = parsed.data;
  const db = getDb();
  const id = nanoid();
  const now = nowIso();
  const finance = {
    ...calcOrderFinance(body.materialCost, body.installFee, body.freight, body.actualPrice),
    materialCost: body.materialCost,
    installFee: body.installFee,
    freight: body.freight,
    actualPrice: body.actualPrice,
  };

  const tx = db.transaction(() => {
    const orderNo = nextBusinessNo(db, 'O', 'orders', 'order_no');
    insertOrder(db, {
      id,
      orderNo,
      quoteId: null,
      customer: body.customer,
      shippingAddress: body.shippingAddress,
      size: body.size,
      materials: body.materials,
      finance,
      remark: body.remark,
      now,
    });
    return orderNo;
  });
  const orderNo = tx();
  log.info('order', '新建订单', { orderNo, ip: req.ip });
  res.status(201).json({ id, orderNo, status: 'pending', finance });
});

// 编辑
ordersRouter.put('/:id', (req, res) => {
  const parsed = updateOrderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const body = parsed.data;
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
    let oldFinance: OrderFinance;
    try {
      customer = body.customer ?? JSON.parse(row.customer);
      shippingAddress = body.shippingAddress ?? JSON.parse(row.shipping_address);
      size = body.size ?? JSON.parse(row.size);
      materials = body.materials ?? JSON.parse(row.materials);
      // 写路径走严格校验（SHR-I1）：损坏 finance 必须 422 拒绝编辑。
      // 此前用 normalizeOrderFinance 归零兜底——损坏数据被「洗白」成结构
      // 完整的新 finance 写回，发货 typeof 防线随之失效（0 元成本发货）。
      oldFinance = parseRawOrderFinance(JSON.parse(row.finance));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(422, '订单数据损坏，无法编辑');
    }
    const materialCost = body.materialCost ?? oldFinance.materialCost;
    const installFee = body.installFee ?? oldFinance.installFee;
    const freight = body.freight ?? oldFinance.freight;
    const actualPrice = body.actualPrice ?? oldFinance.actualPrice;
    const finance = {
      ...calcOrderFinance(materialCost, installFee, freight, actualPrice),
      materialCost,
      installFee,
      freight,
      actualPrice,
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
        body.remark ?? row.remark,
        now,
        req.params.id,
      );
    if (upd.changes === 0) throw new HttpError(409, '订单状态已变更，请刷新后重试');
    return { finance, orderNo: row.order_no };
  });

  try {
    const { finance, orderNo } = tx();
    log.info('order', '编辑订单', { orderNo, ip: req.ip });
    res.json({ id: req.params.id, finance, updatedAt: now });
  } catch (e) {
    sendTxError(res, e, '编辑订单失败');
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
    // 状态机统一在 lib/order-transition：shipped 不在其中（发货必经 /ship 核对，SRV-I1）
    assertOrderTransition(row.status, next);
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
    sendTxError(res, e, '状态流转失败');
  }
});

// 发货核对：ready → shipped
ordersRouter.post('/:id/ship', (req, res) => {
  const parsed = shipBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const body = parsed.data;
  const db = getDb();

  const tx = db.transaction(() => {
    // 事务内读取 + 条件 UPDATE，防并发发货覆盖
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as
      | OrderRow
      | undefined;
    if (!row) throw new HttpError(404, '订单不存在');
    if (row.status !== 'ready') throw new HttpError(400, '仅待发货订单可发货');

    // L12：先对原始 JSON 做结构校验再 normalize——normalize 会把缺失字段静默归零，
    // 直接 normalize 会让「财务数据损坏」变成 0 元成本发货且 typeof 校验沦为死代码。
    let rawFinanceJson: unknown;
    try {
      rawFinanceJson = JSON.parse(row.finance);
    } catch {
      throw new HttpError(422, '订单财务数据损坏，无法发货');
    }
    const finance = parseRawOrderFinance(rawFinanceJson);
    const actual = calcActualFinance(finance.materialCost, finance.installFee, finance.actualPrice, body.actualFreight);
    const now = nowIso();
    const shipping = {
      courier: body.courier,
      trackingNo: body.trackingNo,
      actualFreight: body.actualFreight,
      checkRemark: body.checkRemark,
      confirmedAt: now,
      ...actual,
    };
    // 条件 UPDATE：仅当状态仍为 ready 时才发货，防并发
    const upd = db
      .prepare(`UPDATE orders SET status = 'shipped', shipping = ?, updated_at = ? WHERE id = ? AND status = 'ready'`)
      .run(JSON.stringify(shipping), now, req.params.id);
    if (upd.changes === 0) throw new HttpError(400, '该订单已不在待发货状态');
    return { shipping, orderNo: row.order_no };
  });

  try {
    const { shipping, orderNo } = tx();
    log.info('order', '发货成功', { orderNo, id: req.params.id, courier: shipping.courier, trackingNo: shipping.trackingNo, ip: req.ip });
    res.json({ id: req.params.id, status: 'shipped', shipping });
  } catch (e) {
    sendTxError(res, e, '发货失败');
  }
});

// 删除（L6：补状态守卫，与 PUT/ship 对称——已发货/已完成订单含财务历史，静默删除会扭曲统计）
ordersRouter.delete('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT order_no, status FROM orders WHERE id = ?').get(req.params.id) as
    | { order_no: string; status: OrderStatus }
    | undefined;
  if (!row) return res.status(404).json({ error: '订单不存在' });
  if (row.status === 'shipped' || row.status === 'done') {
    return res.status(409).json({ error: '已发货/已完成的订单不可删除' });
  }
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  log.info('order', '删除订单', { orderNo: row.order_no, status: row.status, ip: req.ip });
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
      // 展示路径保留归零容错（lib/order-finance.ts 的分层说明）
      finance: normalizeOrderFinance(JSON.parse(row.finance)),
      shipping: row.shipping ? JSON.parse(row.shipping) : null,
      remark: row.remark,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

// normalizeOrderFinance / parseRawOrderFinance 已抽至 lib/order-finance.ts
// （SHR-I1：写路径严格校验、展示路径归零容错的分层，含单测）
