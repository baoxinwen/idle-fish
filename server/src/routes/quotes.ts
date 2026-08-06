/**
 * 报价路由 CRUD + 转订单。
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { calcQuote, calcOrderFinance, quoteInputSchema, type QuoteInput, type QuoteRecord } from '@idlefish/shared';
import { getDb } from '../db/index.js';
import { nextBusinessNo, nowIso } from '../lib/no.js';
import { insertOrder } from '../lib/insert-order.js';
import { log } from '../lib/logger.js';

export const quotesRouter = Router();

interface QuoteRow {
  id: string;
  quote_no: string;
  status: string;
  input: string;
  result: string;
  created_at: string;
  updated_at: string;
}

// 列表查询
quotesRouter.get('/', (req, res) => {
  const { status } = req.query;
  const db = getDb();
  const rows = (
    status
      ? db.prepare('SELECT * FROM quotes WHERE status = ? ORDER BY created_at DESC').all(status as string)
      : db.prepare('SELECT * FROM quotes ORDER BY created_at DESC').all()
  ) as QuoteRow[];

  res.json(rows.map(parseRow).filter(Boolean) as QuoteRecord[]);
});

// 详情
quotesRouter.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as
    | QuoteRow
    | undefined;
  if (!row) return res.status(404).json({ error: '报价不存在' });
  const parsed = parseRow(row);
  if (!parsed) return res.status(422).json({ error: '报价数据损坏' });
  res.json(parsed);
});

// 新建
quotesRouter.post('/', (req, res) => {
  const parsed = quoteInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const input = parsed.data as QuoteInput;
  const result = calcQuote(input);

  const db = getDb();
  const id = nanoid();
  const now = nowIso();

  const tx = db.transaction(() => {
    const quoteNo = nextBusinessNo(db, 'Q', 'quotes', 'quote_no');
    db.prepare(
      `INSERT INTO quotes (id, quote_no, status, input, result, created_at, updated_at)
       VALUES (?, ?, 'quoted', ?, ?, ?, ?)`,
    ).run(id, quoteNo, JSON.stringify(input), JSON.stringify(result), now, now);
    return quoteNo;
  });
  const quoteNo = tx();

  const record: QuoteRecord = {
    id,
    quoteNo,
    status: 'quoted',
    input,
    result,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json(record);
});

// 编辑
quotesRouter.put('/:id', (req, res) => {
  const parsed = quoteInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数校验失败', detail: parsed.error.flatten() });
  }
  const input = parsed.data as QuoteInput;
  const result = calcQuote(input);
  const db = getDb();
  const now = nowIso();

  const info = db
    .prepare(
      `UPDATE quotes SET input = ?, result = ?, updated_at = ? WHERE id = ? AND status != 'converted'`,
    )
    .run(JSON.stringify(input), JSON.stringify(result), now, req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: '报价不存在或已转为订单，不可编辑' });
  }
  res.json({ id: req.params.id, input, result, updatedAt: now });
});

// 删除
quotesRouter.delete('/:id', (req, res) => {
  const info = getDb().prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '报价不存在' });
  res.status(204).end();
});

// 转为订单
quotesRouter.post('/:id/convert', (req, res) => {
  const db = getDb();
  // 仅做存在性检查（404）；状态检查移入事务防竞态
  const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as
    | QuoteRow
    | undefined;
  if (!row) return res.status(404).json({ error: '报价不存在' });

  const body = z
    .object({
      customer: z.object({ name: z.string().min(1), platformOrderNo: z.string() }),
      shippingAddress: z.object({ receiver: z.string(), phone: z.string(), address: z.string() }),
      remark: z.string().optional().default(''),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: '参数校验失败', detail: body.error.flatten() });
  }

  let input: QuoteInput;
  let result: { breakdown: { materialCost: number; installFee: number }; finalPrice: number };
  try {
    input = JSON.parse(row.input) as QuoteInput;
    result = JSON.parse(row.result);
  } catch {
    return res.status(422).json({ error: '报价数据损坏，无法转单' });
  }
  if (!result?.breakdown) {
    return res.status(422).json({ error: '报价结果结构异常，无法转单' });
  }
  const orderId = nanoid();
  const now = nowIso();

  const tx = db.transaction(() => {
    // 事务内条件 UPDATE：仅当状态非 converted 时置 converted，返回 changes
    const upd = db
      .prepare("UPDATE quotes SET status = 'converted', updated_at = ? WHERE id = ? AND status != 'converted'")
      .run(now, row.id);
    if (upd.changes === 0) {
      throw new Error('该报价已转为订单');
    }
    const orderNo = nextBusinessNo(db, 'O', 'orders', 'order_no');
    // 订单财务：materialCost 用报价纯材料成本（不含运费），otherFee 放安装费。
    // 运费不计入预估成本——发货时才作为 actualFreight 计入 actualCost。
    // 这样与手动新建订单路径（calcOrderFinance）语义一致，避免运费重复计算。
    const orderMaterialCost = result.breakdown.materialCost;
    const orderOtherFee = result.breakdown.installFee; // 已勾选则为安装费，未勾选为 0
    const finance = {
      materialCost: orderMaterialCost,
      otherFee: orderOtherFee,
      actualPrice: result.finalPrice,
      ...calcOrderFinance(orderMaterialCost, orderOtherFee, result.finalPrice),
    };
    insertOrder(db, {
      id: orderId,
      orderNo,
      quoteId: row.id,
      customer: body.data.customer,
      shippingAddress: body.data.shippingAddress,
      size: input.size,
      materials: input.accessories,
      finance,
      remark: body.data.remark,
      now,
    });
    return orderNo;
  });
  try {
    const orderNo = tx();
    log.info('quote', '转单成功', { quoteNo: row.quote_no, orderNo, ip: req.ip });
    res.status(201).json({ orderId, orderNo });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '转单失败' });
  }
});

function parseRow(row: QuoteRow): QuoteRecord | null {
  try {
    return {
      id: row.id,
      quoteNo: row.quote_no,
      status: row.status as QuoteRecord['status'],
      input: JSON.parse(row.input),
      result: JSON.parse(row.result),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null; // 坏数据行跳过，不影响列表其他记录
  }
}
