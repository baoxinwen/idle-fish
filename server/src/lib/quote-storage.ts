/**
 * 存量报价行复验（评审 SHR-I2 抽为纯模块以便单测）。
 * 转单等消费存量 quotes 行的路径必须复验——DB 里是历史 JSON，可能是旧版本
 * 写入、结构漂移或损坏数据；此前只做类型断言 + 一层 breakdown 存在性检查，
 * breakdown.materialCost 缺失会让 undefined 流进 calcOrderFinance → NaN →
 * JSON.stringify 序列化为 null 落入 orders.finance（坏财务数据静默入库）。
 */

import { quoteInputSchema, type QuoteInput } from '@idle-fish/shared';

/** 转单消费的最小 result 结构（与 pricing 引擎输出对齐） */
export interface StoredQuoteResult {
  breakdown: { materialCost: number; installFee: number; freight: number };
  finalPrice: number;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 解析并复验存量报价行；不完整/损坏返回 null（调用方统一 422）。 */
export function parseStoredQuoteRow(row: {
  input: string;
  result: string;
}): { input: QuoteInput; result: StoredQuoteResult } | null {
  let rawInput: unknown;
  let rawResult: unknown;
  try {
    rawInput = JSON.parse(row.input);
    rawResult = JSON.parse(row.result);
  } catch {
    return null;
  }
  // input 走 schema 复验（freightEnabled 等后补字段由 default 兜底，不拒存量）
  const input = quoteInputSchema.safeParse(rawInput);
  if (!input.success) return null;
  if (rawResult === null || typeof rawResult !== 'object') return null;
  const breakdown = (rawResult as { breakdown?: unknown }).breakdown;
  if (breakdown === null || typeof breakdown !== 'object') return null;
  const b = breakdown as Record<string, unknown>;
  if (!isFiniteNumber(b.materialCost) || !isFiniteNumber(b.installFee) || !isFiniteNumber(b.freight)) {
    return null;
  }
  const finalPrice = (rawResult as { finalPrice?: unknown }).finalPrice;
  if (!isFiniteNumber(finalPrice)) return null;
  return {
    input: input.data as QuoteInput,
    result: {
      breakdown: { materialCost: b.materialCost, installFee: b.installFee, freight: b.freight },
      finalPrice,
    },
  };
}
