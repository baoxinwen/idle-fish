/**
 * 报价路由 CRUD + 转订单。
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  calcQuote,
  calcOrderFinance,
  money,
  quoteInputSchema,
  customerInfoSchema,
  shippingAddressSchema,
  type AccessoryItem,
  type QuoteInput,
  type QuoteRecord,
} from '@idlefish/shared';
import { getDb } from '../db/index.js';
import { nextBusinessNo, nowIso } from '../lib/no.js';
import { insertOrder } from '../lib/insert-order.js';
import { log } from '../lib/logger.js';
import { HttpError, sendTxError } from '../lib/http-error.js';

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
  log.info('quote', '创建报价', { quoteNo, id, ip: req.ip });

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
  log.info('quote', '编辑报价', { id: req.params.id, ip: req.ip });
  res.json({ id: req.params.id, input, result, updatedAt: now });
});

// 删除（L6：已转单报价不可删——外键 ON DELETE SET NULL 会让关联订单失去来源）
quotesRouter.delete('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT status FROM quotes WHERE id = ?').get(req.params.id) as
    | { status: string }
    | undefined;
  if (!row) return res.status(404).json({ error: '报价不存在' });
  if (row.status === 'converted') {
    return res.status(409).json({ error: '该报价已转为订单，不可删除' });
  }
  db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  log.info('quote', '删除报价', { id: req.params.id, status: row.status, ip: req.ip });
  res.status(204).end();
});

/** S-3：转单请求 schema——模块常量（避免每请求重建），客户/收货复用 shared schema
 *  以继承长度上限（此前手写子集丢失了 max 校验），金额字段复用 shared 的 money()。 */
const convertBodySchema = z.object({
  customer: customerInfoSchema,
  shippingAddress: shippingAddressSchema,
  remark: z.string().max(1000).optional().default(''),
  finance: z
    .object({
      materialCost: money(),
      installFee: money(),
      freight: money(),
      actualPrice: money(),
    })
    .optional(),
});

/** S-5：legacy 报价（托盘走 trayCount 字段、配件里无 tray 项）补一条虚拟托盘材料行——
 *  否则引擎用 legacyTrayCost 把托盘钱计入材料成本，而订单材料清单缺托盘行，车间少备货。 */
function withLegacyTray(input: QuoteInput): AccessoryItem[] {
  const materials = input.accessories;
  if (materials.some((a) => a.category === 'tray') || !(input.trayCount > 0)) {
    return materials;
  }
  return [
    ...materials,
    { name: '托盘', category: 'tray' as const, quantity: input.trayCount, unitPrice: input.trayUnitPrice ?? 0 },
  ];
}

// 转为订单
quotesRouter.post('/:id/convert', (req, res) => {
  const db = getDb();
  // 仅做存在性检查（404）；状态检查移入事务防竞态
  const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as
    | QuoteRow
    | undefined;
  if (!row) return res.status(404).json({ error: '报价不存在' });

  const body = convertBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: '参数校验失败', detail: body.error.flatten() });
  }

  let input: QuoteInput;
  let result: {
    breakdown: { materialCost: number; installFee: number; freight: number };
    finalPrice: number;
  };
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
      throw new HttpError(400, '该报价已转为订单');
    }
    const orderNo = nextBusinessNo(db, 'O', 'orders', 'order_no');
    // 订单财务：使用转单页确认后的材料成本、安装费、运费和实际售价。
    // 若调用方未传 finance，则回退为报价计算结果，保持旧接口兼容。
    const confirmedFinance = body.data.finance ?? {
      materialCost: result.breakdown.materialCost,
      installFee: result.breakdown.installFee,
      freight: result.breakdown.freight,
      actualPrice: result.finalPrice,
    };
    const finance = {
      ...calcOrderFinance(
        confirmedFinance.materialCost,
        confirmedFinance.installFee,
        confirmedFinance.freight,
        confirmedFinance.actualPrice,
      ),
      materialCost: confirmedFinance.materialCost,
      installFee: confirmedFinance.installFee,
      freight: confirmedFinance.freight,
      actualPrice: confirmedFinance.actualPrice,
    };
    const materials = withLegacyTray(input);
    insertOrder(db, {
      id: orderId,
      orderNo,
      quoteId: row.id,
      customer: body.data.customer,
      shippingAddress: body.data.shippingAddress,
      size: input.size,
      materials,
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
    // L4：业务错误（HttpError）返回具体 message；其余（SQL 约束等基础设施错误）
    // 一律 500 泛化文案，不向客户端泄露内部细节
    if (!(e instanceof HttpError)) {
      log.error('quote', `转单失败: ${e instanceof Error ? e.message : String(e)}`, { ip: req.ip });
    }
    sendTxError(res, e, '转单失败');
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
