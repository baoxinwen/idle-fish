/**
 * 订单 finance 读写分层测试（评审 SHR-I1）。
 * 缺陷：PUT 编辑路径用 normalizeOrderFinance（缺失字段静默归零）读存量
 * finance——损坏数据被「洗白」成结构完整的新 finance 写回库，随后发货时
 * parseRawOrderFinance 的 typeof 防线通过（0 是合法 number），以 0 元材料
 * 成本发货。修复后：写路径（PUT/ship）一律走严格的 parseRawOrderFinance
 * （shared orderFinanceSchema 优先 + legacy otherFee 兼容），归零兜底只保留
 * 在 GET 展示路径。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRawOrderFinance,
  normalizeOrderFinance,
} from '../lib/order-finance.js';
import { HttpError } from '../lib/http-error.js';

const FULL_FINANCE = {
  materialCost: 100,
  installFee: 20,
  freight: 10,
  otherFee: 0,
  estimatedCost: 130,
  actualPrice: 200,
  estimatedProfit: 70,
  estimatedProfitRatePct: 35,
};

describe('parseRawOrderFinance（SHR-I1 写路径严格校验）', () => {
  it('新格式全字段：经 shared orderFinanceSchema 校验通过', () => {
    const finance = parseRawOrderFinance(FULL_FINANCE);
    assert.equal(finance.materialCost, 100);
    assert.equal(finance.installFee, 20);
  });

  it('缺 materialCost 的损坏数据必须拒绝（不得归零洗白）', () => {
    assert.throws(() => parseRawOrderFinance({ actualPrice: 200, installFee: 20 }), HttpError);
    assert.throws(
      () => parseRawOrderFinance({ actualPrice: 200, otherFee: 5 }),
      (e: unknown) => e instanceof HttpError && e.status === 422,
    );
  });

  it('legacy otherFee 格式兼容：otherFee 归入 installFee', () => {
    const finance = parseRawOrderFinance({
      materialCost: 100,
      actualPrice: 200,
      otherFee: 25,
    });
    assert.equal(finance.installFee, 25);
    assert.equal(finance.materialCost, 100);
  });

  it('非对象/非有限数拒绝', () => {
    assert.throws(() => parseRawOrderFinance(null), HttpError);
    assert.throws(() => parseRawOrderFinance('string'), HttpError);
    assert.throws(
      () => parseRawOrderFinance({ ...FULL_FINANCE, materialCost: '100' }),
      HttpError,
    );
    assert.throws(
      () => parseRawOrderFinance({ ...FULL_FINANCE, materialCost: Number.NaN }),
      HttpError,
    );
  });
});

describe('normalizeOrderFinance（GET 展示路径的容错兜底）', () => {
  it('缺失字段归零（展示容错语义保持，但不再被写路径使用）', () => {
    const finance = normalizeOrderFinance({ actualPrice: 200 });
    assert.equal(finance.materialCost, 0);
    assert.equal(finance.actualPrice, 200);
  });
});
