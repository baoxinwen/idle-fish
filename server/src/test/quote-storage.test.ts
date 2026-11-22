/**
 * 存量报价行复验测试（评审 SHR-I2）。
 * 缺陷：转单对 row.input 只 `JSON.parse as QuoteInput` 类型断言、对 result 只查
 * `breakdown` 一层存在性——存量行 result JSON 可解析但 breakdown.materialCost
 * 缺失时，fallback 直接取 undefined 喂给 calcOrderFinance → NaN →
 * JSON.stringify 序列化为 null 写入 orders.finance，坏财务数据静默入库。
 * 修复后：parseStoredQuoteRow 对 input 走 quoteInputSchema 复验（含 legacy
 * freightEnabled 兜底）、对 result 校验财务四字段的有限数存在性，不完整一律 null。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredQuoteRow } from '../lib/quote-storage.js';
import { DEFAULT_SETTINGS } from '@idle-fish/shared';

const input = {
  size: { width: 600, depth: 400, height: 800 },
  color: 'silver',
  trayCount: 1,
  trayUnitPrice: 85,
  installEnabled: false,
  freightEnabled: true,
  accessories: [{ name: '合页', category: 'custom', quantity: 2, unitPrice: 3 }],
  pricing: { ...DEFAULT_SETTINGS.defaultPricing },
};

const goodResult = {
  breakdown: { materialCost: 100, installFee: 20, freight: 10 },
  finalPrice: 200,
};

describe('parseStoredQuoteRow（SHR-I2）', () => {
  it('合法 input + result 通过', () => {
    const row = parseStoredQuoteRow({ input: JSON.stringify(input), result: JSON.stringify(goodResult) });
    assert.ok(row);
    assert.equal(row.result.breakdown.materialCost, 100);
    assert.equal(row.result.finalPrice, 200);
  });

  it('legacy 行（freightEnabled 缺失）通过且归 true（不拒存量报价转单）', () => {
    const legacy = { ...input, freightEnabled: undefined };
    const row = parseStoredQuoteRow({
      input: JSON.stringify(legacy),
      result: JSON.stringify(goodResult),
    });
    assert.ok(row);
    assert.equal(row.input.freightEnabled, true);
  });

  it('result.breakdown.materialCost 缺失必须拒绝（NaN 落库路径）', () => {
    const broken = {
      breakdown: { installFee: 20, freight: 10 },
      finalPrice: 200,
    };
    assert.equal(
      parseStoredQuoteRow({ input: JSON.stringify(input), result: JSON.stringify(broken) }),
      null,
    );
  });

  it('breakdown.materialCost 非有限数拒绝', () => {
    const broken = { ...goodResult, breakdown: { ...goodResult.breakdown, materialCost: '100' } };
    assert.equal(
      parseStoredQuoteRow({ input: JSON.stringify(input), result: JSON.stringify(broken) }),
      null,
    );
  });

  it('finalPrice 缺失拒绝', () => {
    const broken = { breakdown: goodResult.breakdown };
    assert.equal(
      parseStoredQuoteRow({ input: JSON.stringify(input), result: JSON.stringify(broken) }),
      null,
    );
  });

  it('input 非 JSON / 坏类型拒绝', () => {
    assert.equal(parseStoredQuoteRow({ input: 'not-json', result: JSON.stringify(goodResult) }), null);
    assert.equal(parseStoredQuoteRow({ input: JSON.stringify('string'), result: JSON.stringify(goodResult) }), null);
    assert.equal(parseStoredQuoteRow({ input: JSON.stringify(input), result: 'not-json' }), null);
  });

  it('input 缺必填字段（无 size）拒绝', () => {
    const broken = { ...input, size: undefined };
    assert.equal(
      parseStoredQuoteRow({ input: JSON.stringify(broken), result: JSON.stringify(goodResult) }),
      null,
    );
  });
});
