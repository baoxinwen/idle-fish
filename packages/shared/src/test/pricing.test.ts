import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcQuote,
  calcCostBreakdown,
  calcProfileCost,
  calcTraySuggestedPrice,
  groupAccessories,
  calcOrderFinance,
  calcActualFinance,
  toInnerSize,
  genBusinessNo,
  roundMoney,
  type QuoteInput,
} from '../index.js';

const baseInput: QuoteInput = {
  size: { width: 600, depth: 400, height: 800 },
  color: 'silver',
  trayCount: 1,
  trayUnitPrice: 85,
  installEnabled: false,
  freightEnabled: true,
  accessories: [
    { name: '三通连接件', category: 'connector', quantity: 8, unitPrice: 2 },
    { name: 'M5 滑块螺母', category: 'fastener', quantity: 60, unitPrice: 0.5 },
  ],
  pricing: {
    silverPrice: 12.53,
    blackPrice: 13.8,
    wastage: 1.05,
    cuttingFee: 30,
    installFee: 100,
    freight: 50,
    profitRate: 0.2,
    trayCoeffA: 0.01,
    trayCoeffB: 10,
  },
};

describe('roundMoney', () => {
  it('四舍五入到分', () => {
    assert.equal(roundMoney(1.234), 1.23);
    assert.equal(roundMoney(1.235), 1.24);
    assert.equal(roundMoney(88.41336), 88.41);
    assert.equal(roundMoney(74.849), 74.85);
  });

  it('严格四舍五入（非 toFixed 的趋向偶数）', () => {
    // 这些用例 toFixed 给出错误结果（1.00、2.67），是历史回归保障
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(2.675), 2.68);
    assert.equal(roundMoney(0.125), 0.13);
  });
});

describe('toInnerSize', () => {
  it('外径减 40 得内径', () => {
    assert.deepEqual(toInnerSize({ width: 600, depth: 400, height: 800 }), {
      width: 560,
      depth: 360,
      height: 760,
    });
  });
});

describe('calcProfileCost', () => {
  it('12 条棱总长 = (内径宽+深+高)×4 ÷ 1000', () => {
    const r = calcProfileCost({ width: 600, depth: 400, height: 800 }, 12.53, 1.05);
    // 内径 560+360+760 = 1680, ×4 = 6720mm = 6.72m
    assert.equal(r.totalLength, 6.72);
    // 6.72 × 12.53 × 1.05 = 88.41336 → 88.41
    assert.equal(r.cost, 88.41);
  });

  it('黑色单价高于银色', () => {
    const silver = calcProfileCost({ width: 600, depth: 400, height: 800 }, 12.53, 1.05);
    const black = calcProfileCost({ width: 600, depth: 400, height: 800 }, 13.8, 1.05);
    assert.ok(black.cost > silver.cost);
  });
});

describe('calcTraySuggestedPrice', () => {
  it('面积(万mm²) × A + B', () => {
    // 600×400 = 240000 mm² = 24 万mm²；24 × 0.01 + 10 = 10.24
    const p = calcTraySuggestedPrice({ width: 600, depth: 400, height: 800 }, 0.01, 10);
    assert.equal(p, 10.24);
  });
});

describe('groupAccessories', () => {
  it('按类别分组并计算小计', () => {
    const groups = groupAccessories(baseInput.accessories);
    const connector = groups.find((g) => g.category === 'connector');
    assert.ok(connector);
    assert.equal(connector!.items.length, 1);
    assert.equal(connector!.subtotal, 16); // 8 × 2
    const fastener = groups.find((g) => g.category === 'fastener');
    assert.equal(fastener!.subtotal, 30); // 60 × 0.5
  });
});

describe('calcCostBreakdown', () => {
  it('材料成本 = 铝型材 + 切割费 + 配件（含托盘）', () => {
    const b = calcCostBreakdown(baseInput);
    // 铝型材 88.41 + 切割 30 + 配件 46 + 托盘 85（旧数据无 tray 项，走兼容计入配件总额）= 249.41
    assert.equal(b.profile.cost, 88.41);
    assert.equal(b.accessoryTotal, 131); // 46 + 85 托盘
    assert.equal(b.trayCost, 85);
    assert.equal(b.materialCost, 249.41);
    // 未勾选安装费，总成本 = 材料成本 + 运费 50
    assert.equal(b.installFee, 0);
    assert.equal(b.totalCost, 299.41);
  });

  it('勾选安装费后计入总成本', () => {
    const b = calcCostBreakdown({ ...baseInput, installEnabled: true });
    assert.equal(b.installFee, 100);
    assert.equal(b.totalCost, 399.41); // 249.41 + 100 + 50
  });

  it('未勾选运费则不计入总成本', () => {
    const b = calcCostBreakdown({ ...baseInput, freightEnabled: false });
    assert.equal(b.freight, 0);
    assert.equal(b.totalCost, 249.41); // 249.41 + 0（无安装费无运费）
  });

  it('运费与安装费均勾选', () => {
    const b = calcCostBreakdown({ ...baseInput, installEnabled: true, freightEnabled: true });
    assert.equal(b.freight, 50);
    assert.equal(b.installFee, 100);
    assert.equal(b.totalCost, 399.41); // 249.41 + 100 + 50
  });
});

describe('calcQuote', () => {
  it('最终报价 = 总成本 ÷ (1 − 毛利率)', () => {
    const r = calcQuote(baseInput);
    // 总成本 299.41, ÷(1-0.2)= ÷0.8 = 374.2625 → 374.26
    assert.equal(r.breakdown.totalCost, 299.41);
    assert.equal(r.finalPrice, 374.26);
    // 利润 = 374.26 − 299.41 = 74.85
    assert.equal(r.expectedProfit, 74.85);
    // 毛利率 = 74.85 / 374.26 × 100 ≈ 20.00
    assert.equal(r.profitRatePct, 20);
  });
});

describe('calcOrderFinance', () => {
  it('预估成本/利润/毛利率', () => {
    const f = calcOrderFinance(249.41, 50, 400);
    assert.equal(f.estimatedCost, 299.41);
    assert.equal(f.estimatedProfit, 100.59);
    assert.equal(f.estimatedProfitRatePct, 25.15); // 100.59/400×100
  });
});

describe('calcActualFinance', () => {
  it('实际成本 = 预估成本 + 实际运费', () => {
    const f = calcActualFinance(299.41, 400, 45);
    assert.equal(f.actualCost, 344.41);
    assert.equal(f.actualProfit, 55.59);
  });
});

describe('genBusinessNo', () => {
  it('生成报价编号 Q-YYYYMMDD-XX', () => {
    assert.equal(genBusinessNo('Q', '2026-08-04T10:00:00.000Z', 1), 'Q-20260804-01');
    assert.equal(genBusinessNo('Q', '2026-08-04T10:00:00.000Z', 12), 'Q-20260804-12');
    assert.equal(genBusinessNo('O', '2026-08-04', 3), 'O-20260804-03');
  });
});
