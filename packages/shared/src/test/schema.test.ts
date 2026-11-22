/**
 * schema 校验边界测试。
 * SHR-I3：accessories 数组此前无条数上限——schema 注释声称「上限把量级压到
 * 远小于 Number.MAX_VALUE，从源头杜绝溢出路径」，但标量维度做了、数组维度漏了：
 * 10mb body 限额内可塞约 10 万项，单项 quantity≤1e6 × unitPrice≤1e9 = 1e15，
 * 10 万项累加达 1e20 ≫ 2^53（≈9e15），浮点步长升至万元级，配件总额精度失真入库。
 * 修复数学：数组 ≤500 行 × quantity ≤1e4 × unitPrice ≤1e9 → 单行最坏 1e13，
 * 合计最坏 5e15 < 2^53 ≈ 9.007e15，浮点累加保持分位精确。
 * SHR-I2 前置：freightEnabled 是后补字段（引入前的存量报价无此字段），schema
 * 复验存量数据时需 default(true) 兜底（与 quote-store loadFromRecord 口径一致），
 * 否则转单复验会把全部 legacy 报价拒之门外（破坏现有功能）。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quoteInputSchema } from '../schema.js';
import { DEFAULT_SETTINGS } from '../defaults.js';
import type { AccessoryItem, QuoteInput } from '../types.js';

function makeInput(accessories: AccessoryItem[]): Omit<QuoteInput, 'freightEnabled'> & {
  freightEnabled?: boolean;
} {
  return {
    size: { width: 600, depth: 400, height: 800 },
    color: 'silver',
    trayCount: 1,
    trayUnitPrice: 85,
    installEnabled: false,
    freightEnabled: true,
    accessories,
    pricing: { ...DEFAULT_SETTINGS.defaultPricing },
  };
}

const item: AccessoryItem = { name: '合页', category: 'custom', quantity: 2, unitPrice: 3 };

describe('quoteInputSchema 数组与数量上限（SHR-I3）', () => {
  it('accessories 500 行通过、501 行拒绝', () => {
    assert.equal(quoteInputSchema.safeParse(makeInput(Array.from({ length: 500 }, () => item))).success, true);
    assert.equal(quoteInputSchema.safeParse(makeInput(Array.from({ length: 501 }, () => item))).success, false);
  });

  it('配件 quantity 上限 1e4：10000 通过、10001 拒绝', () => {
    assert.equal(
      quoteInputSchema.safeParse(makeInput([{ ...item, quantity: 10000 }])).success,
      true,
    );
    assert.equal(
      quoteInputSchema.safeParse(makeInput([{ ...item, quantity: 10001 }])).success,
      false,
    );
  });

  it('溢出预算数学闭合：最坏合计 5e15 < 2^53', () => {
    const worst = 500 * 1e4 * 1e9;
    assert.ok(worst < Number.MAX_SAFE_INTEGER, `最坏合计 ${worst} 必须 < 2^53`);
  });
});

describe('quoteInputSchema legacy 兼容（SHR-I2 前置）', () => {
  it('freightEnabled 缺失（旧记录）通过校验且归 true', () => {
    const legacy = makeInput([item]);
    delete legacy.freightEnabled;
    const r = quoteInputSchema.safeParse(legacy);
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.freightEnabled, true);
  });

  it('显式 false 不被 default 覆盖', () => {
    const r = quoteInputSchema.safeParse(makeInput([item]));
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.freightEnabled, true); // makeInput 显式 true
    const off = { ...makeInput([item]), freightEnabled: false };
    const r2 = quoteInputSchema.safeParse(off);
    if (r2.success) assert.equal(r2.data.freightEnabled, false);
  });
});
