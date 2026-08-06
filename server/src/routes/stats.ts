/**
 * 统计聚合路由 �?供经营统计看板使用�? * 指标�?+ 订单状态分�?+ 趋势 + 最近列表�? */

import { Router } from 'express';
import {
  statsRangeSchema,
  roundMoney,
  type OrderStatus,
  type QuoteStatus,
  type StatsData,
  type StatsRange,
} from '@idlefish/shared';
import { getDb } from '../db/index.js';

export const statsRouter = Router();

statsRouter.get('/', (req, res) => {
  const parsed = statsRangeSchema.safeParse(req.query.range ?? '30d');
  const range: StatsRange = parsed.success ? parsed.data : '30d';
  const since = rangeToSince(range);
  const byMonth = range === 'all'; // 全部按月聚合，避免点过多

  const db = getDb();

  const quotes = db
    .prepare(`SELECT id, quote_no, status, result, created_at FROM quotes WHERE created_at >= ? ORDER BY created_at DESC`)
    .all(since) as QuoteRow[];

  const orders = db
    .prepare(`SELECT id, order_no, status, customer, finance, shipping, created_at FROM orders WHERE created_at >= ? ORDER BY created_at DESC`)
    .all(since) as OrderRow[];

  // ---- 指标�?----
  const quoteCount = quotes.length;
  const quoteTotalAmount = quotes.reduce((s, q) => s + (parseResult(q.result)?.finalPrice ?? 0), 0);
  const convertedCount = quotes.filter((q) => q.status === 'converted').length;
  const conversionRatePct = quoteCount > 0 ? roundMoney((convertedCount / quoteCount) * 100) : 0;

  const orderCount = orders.length;
  const closedOrders = orders.filter((o) => o.status === 'shipped' || o.status === 'done');

  // 归一化已结订单的财务数据（避免重复 parseShipping/parseFinance）
  const closedFinance = closedOrders.map((o) => {
    const ship = o.shipping ? parseShipping(o.shipping) : null;
    const f = parseFinance(o.finance);
    return {
      actualPrice: f?.actualPrice ?? 0,
      profit: ship?.actualProfit ?? f?.estimatedProfit ?? 0,
      rate: ship?.actualProfitRatePct ?? f?.estimatedProfitRatePct ?? 0,
    };
  });

  const orderRevenue = closedFinance.reduce((s, c) => s + c.actualPrice, 0);
  const totalProfit = closedFinance.reduce((s, c) => s + c.profit, 0);
  const avgProfitRatePct =
    closedFinance.length > 0
      ? roundMoney(closedFinance.reduce((s, c) => s + c.rate, 0) / closedFinance.length)
      : 0;

  const statusDistribution = aggregateStatus(orders.map((o) => o.status));

  // ---- 趋势（按�?or 按月�?---
  const trend = buildTrend(quotes, orders, byMonth, range);

  // ---- 最近列�?----
  const recentQuotes = quotes.slice(0, 10).map((q) => ({
    id: q.id,
    quoteNo: q.quote_no,
    finalPrice: parseResult(q.result)?.finalPrice ?? 0,
    status: q.status as QuoteStatus,
    createdAt: q.created_at,
  }));

  const recentOrders = orders.slice(0, 10).map((o) => ({
    id: o.id,
    orderNo: o.order_no,
    customerName: parseCustomer(o.customer)?.name ?? '',
    actualPrice: parseFinance(o.finance)?.actualPrice ?? 0,
    status: o.status as OrderStatus,
    createdAt: o.created_at,
  }));

  const data: StatsData = {
    range,
    quoteCount,
    quoteTotalAmount: roundMoney(quoteTotalAmount),
    conversionRatePct,
    orderCount,
    orderRevenue: roundMoney(orderRevenue),
    totalProfit: roundMoney(totalProfit),
    avgProfitRatePct,
    statusDistribution,
    trend,
    recentQuotes,
    recentOrders,
  };
  res.json(data);
});

// ---- 类型 ----
interface QuoteRow {
  id: string;
  quote_no: string;
  status: string;
  result: string;
  created_at: string;
}
interface OrderRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  customer: string;
  finance: string;
  shipping: string | null;
  created_at: string;
}

// ---- 辅助 ----
function parseResult(s: string): { finalPrice?: number } | null {
  try { return JSON.parse(s); } catch { return null; }
}
function parseFinance(s: string): { actualPrice?: number; estimatedProfit?: number; estimatedProfitRatePct?: number } | null {
  try { return JSON.parse(s); } catch { return null; }
}
function parseShipping(s: string): { actualProfit?: number; actualProfitRatePct?: number } | null {
  try { return JSON.parse(s); } catch { return null; }
}
function parseCustomer(s: string): { name?: string } | null {
  try { return JSON.parse(s); } catch { return null; }
}

/** 范围 → 天数（all 返回 null） */
function rangeToDays(range: StatsRange): number | null {
  if (range === 'all') return null;
  return range === '7d' ? 7 : range === '30d' ? 30 : 90;
}

/**
 * 范围起始时刻（UTC ISO 串）。
 * 用本地时区「N 天前 0 点」而非 UTC 墙钟减天数——因为趋势桶按本地日期分桶，
 * 区间起始也必须按本地日期，否则 7d 可能漏算/多算首日（时区偏移导致跨天）。
 * 取 (days-1) 天前本地 0 点，与 buildTrend 填充序列的桶数对齐（近 N 天含今天 = N 个桶）。
 */
function rangeToSince(range: StatsRange): string {
  if (range === 'all') return '1970-01-01T00:00:00Z';
  const days = rangeToDays(range)!;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const startLocal = new Date(`${todayLocal}T00:00:00`); // 当作本地时间 0 点
  startLocal.setDate(startLocal.getDate() - (days - 1)); // 最旧桶 = (days-1) 天前
  return startLocal.toISOString();
}

function aggregateStatus(statuses: OrderStatus[]): { status: OrderStatus; count: number }[] {
  const all: OrderStatus[] = ['pending', 'producing', 'ready', 'shipped', 'done', 'cancelled'];
  return all.map((status) => ({
    status,
    count: statuses.filter((s) => s === status).length,
  }));
}

/** 趋势：按天或按月聚合 */
function buildTrend(
  quotes: QuoteRow[],
  orders: OrderRow[],
  byMonth: boolean,
  range: StatsRange,
): { date: string; quoteCount: number; orderCount: number; profit: number }[] {
  const bucket = (iso: string) => {
    const local = new Date(iso).toLocaleDateString('en-CA', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return byMonth ? local.slice(0, 7) : local;
  };

  const map = new Map<string, { quoteCount: number; orderCount: number; profit: number }>();

  for (const q of quotes) {
    const k = bucket(q.created_at);
    const e = map.get(k) ?? { quoteCount: 0, orderCount: 0, profit: 0 };
    e.quoteCount += 1;
    map.set(k, e);
  }
  for (const o of orders) {
    const k = bucket(o.created_at);
    const e = map.get(k) ?? { quoteCount: 0, orderCount: 0, profit: 0 };
    e.orderCount += 1;
    if (o.status === 'shipped' || o.status === 'done') {
      const ship = o.shipping ? parseShipping(o.shipping) : null;
      const f = parseFinance(o.finance);
      e.profit += ship?.actualProfit ?? f?.estimatedProfit ?? 0;
    }
    map.set(k, e);
  }

  // 按天范围补完整日期序列（空日期补 0），避免折线跳过无数据日
  const days = rangeToDays(range);
  if (!byMonth && days !== null) {
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = d.toLocaleDateString('en-CA', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!map.has(k)) map.set(k, { quoteCount: 0, orderCount: 0, profit: 0 });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      quoteCount: v.quoteCount,
      orderCount: v.orderCount,
      profit: roundMoney(v.profit),
    }));
}

