/**
 * 计价引擎 — 纯函数，前后端共用。
 * 规则以 docs/技术方案.md §8 为准。
 *
 * 关键修正（相对 requirements.md）：
 *  - 损耗率用 × wastage（默认 1.05 = 5%），非 × (1 + wastage)
 *  - 内径 = 外径 − 40（减一次 SIZE_GAP，非减 80）
 *  - ×4 是 12 条棱总长（4 宽 + 4 深 + 4 高），不是「4 根型材」
 */

import type {
  AccessoryCategory,
  AccessoryGroupCost,
  AccessoryItem,
  CabinetSize,
  CostBreakdown,
  PricingParams,
  ProfileColor,
  QuoteInput,
  QuoteResult,
} from './types.js';
import { SIZE_GAP } from './types.js';

/** 金额舍入到分（2 位小数）。用 Math.round + 1e-9 修正浮点误差，
 *  严格四舍五入（1.005→1.01、2.675→2.68），非 toFixed 的「对半值趋向偶数」。 */
export function roundMoney(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100;
}

/** 按颜色取型材单价 */
export function getProfileUnitPrice(pricing: PricingParams, color: ProfileColor): number {
  return color === 'black' ? pricing.blackPrice : pricing.silverPrice;
}

/** 外径 → 内径：每边减 SIZE_GAP(40mm) */
export function toInnerSize(size: CabinetSize): CabinetSize {
  return {
    width: size.width - SIZE_GAP,
    depth: size.depth - SIZE_GAP,
    height: size.height - SIZE_GAP,
  };
}

/**
 * 铝型材成本
 * = (内径宽 + 内径深 + 内径高) × 4 ÷ 1000 × 单价 × 损耗率
 *   (×4 得到立方体 12 条棱总长，÷1000 mm→m)
 */
export function calcProfileCost(
  size: CabinetSize,
  unitPrice: number,
  wastage: number,
): { inner: CabinetSize; totalLength: number; cost: number } {
  const raw = toInnerSize(size);
  // 内径 clamp ≥0：尺寸小于 GAP 时无材料（避免负数成本）
  const inner = {
    width: Math.max(0, raw.width),
    depth: Math.max(0, raw.depth),
    height: Math.max(0, raw.height),
  };
  const totalLength = ((inner.width + inner.depth + inner.height) * 4) / 1000; // m
  const cost = roundMoney(totalLength * unitPrice * wastage);
  return { inner, totalLength, cost };
}

/** 托盘建议价 = 面积(万mm²) × 系数A + 系数B，面积 = 外径宽 × 外径深 ÷ 10000 */
export function calcTraySuggestedPrice(
  size: CabinetSize,
  coeffA: number,
  coeffB: number,
): number {
  const area = (size.width * size.depth) / 10000; // 万 mm²
  return roundMoney(area * coeffA + coeffB);
}

/** 按类别分组汇总配件（含托盘，显示为「配件·托盘」） */
export function groupAccessories(accessories: AccessoryItem[]): AccessoryGroupCost[] {
  const categories: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'tray', 'custom'];
  return categories
    .map((category) => {
      const items = accessories.filter((a) => a.category === category);
      const subtotal = roundMoney(items.reduce((sum, a) => sum + a.quantity * a.unitPrice, 0));
      return { category, items, subtotal };
    })
    .filter((g) => g.items.length > 0);
}

/** 配件总成本 */
export function calcAccessoryTotal(accessories: AccessoryItem[]): number {
  return roundMoney(accessories.reduce((sum, a) => sum + a.quantity * a.unitPrice, 0));
}

/**
 * 完整成本分解
 * 材料成本 = 铝型材 + 切割费 + 配件 + 托盘
 * 总成本   = 材料成本 + (安装费 if 勾选) + (运费 if 勾选)
 */
export function calcCostBreakdown(input: QuoteInput): CostBreakdown {
  const { size, color, installEnabled, freightEnabled, accessories, pricing } = input;

  const unitPrice = getProfileUnitPrice(pricing, color);
  const profile = calcProfileCost(size, unitPrice, pricing.wastage);

  // 托盘是配件项（category='tray'），统一在配件里计算，不再单独加 trayCost
  const accessoryGroups = groupAccessories(accessories);
  const hasTrayItem = accessories.some((a) => a.category === 'tray');
  // 兼容旧数据：accessories 无 tray 项时用 input 字段补虚拟托盘计入配件总额
  const legacyTrayCost = hasTrayItem ? 0 : roundMoney(input.trayCount * input.trayUnitPrice);
  const accessoryTotal = roundMoney(calcAccessoryTotal(accessories) + legacyTrayCost);

  const trayItem = accessories.find((a) => a.category === 'tray');
  const trayCount = trayItem ? trayItem.quantity : input.trayCount;
  const trayUnitPrice = trayItem ? trayItem.unitPrice : input.trayUnitPrice;
  const traySuggestedPrice = calcTraySuggestedPrice(size, pricing.trayCoeffA, pricing.trayCoeffB);
  const trayCost = roundMoney(trayCount * trayUnitPrice);

  const materialCost = roundMoney(
    profile.cost + pricing.cuttingFee + accessoryTotal,
  );

  const installFee = installEnabled ? pricing.installFee : 0;
  const freight = freightEnabled ? pricing.freight : 0;
  const totalCost = roundMoney(materialCost + installFee + freight);

  return {
    profile: {
      innerWidth: profile.inner.width,
      innerDepth: profile.inner.depth,
      innerHeight: profile.inner.height,
      totalLength: profile.totalLength,
      unitPrice,
      wastage: pricing.wastage,
      cost: profile.cost,
    },
    accessoryGroups,
    accessoryTotal,
    cuttingFee: pricing.cuttingFee,
    trayCount,
    trayUnitPrice,
    traySuggestedPrice,
    trayCost,
    materialCost,
    installFee,
    freight,
    totalCost,
  };
}

/** 利润率百分比 = profit / price × 100，price ≤ 0 时返回 0 */
function calcProfitRatePct(profit: number, price: number): number {
  return price > 0 ? roundMoney((profit / price) * 100) : 0;
}

/**
 * 完整报价计算
 * 最终报价 = 总成本 ÷ (1 − 毛利率)
 * 预计利润 = 最终报价 − 总成本
 * 毛利率   = 预计利润 ÷ 最终报价 × 100%
 */
export function calcQuote(input: QuoteInput): QuoteResult {
  const breakdown = calcCostBreakdown(input);

  const denom = 1 - input.pricing.profitRate;
  // 防御性兜底：profitRate ≥ 1 时 denom ≤ 0，除法无意义。
  // 正常流程不可达——前端 ProfitRateField 钳制 0~0.999，后端 zod 限制 ≤ 0.999。
  // 此处不抛错（calcQuote 在前端 useMemo 实时调用，抛错会白屏），返回总成本即零利润。
  const finalPrice = denom <= 0 ? breakdown.totalCost : roundMoney(breakdown.totalCost / denom);

  const expectedProfit = roundMoney(finalPrice - breakdown.totalCost);
  const profitRatePct = calcProfitRatePct(expectedProfit, finalPrice);

  return {
    breakdown,
    finalPrice,
    expectedProfit,
    profitRatePct,
  };
}

// ---------- 订单侧财务计算 ----------

/** 订单预估财务：预估成本 / 预估利润 / 预估毛利率 */
export function calcOrderFinance(
  materialCost: number,
  otherFee: number,
  actualPrice: number,
): {
  estimatedCost: number;
  estimatedProfit: number;
  estimatedProfitRatePct: number;
} {
  const estimatedCost = roundMoney(materialCost + otherFee);
  const estimatedProfit = roundMoney(actualPrice - estimatedCost);
  const estimatedProfitRatePct = calcProfitRatePct(estimatedProfit, actualPrice);
  return { estimatedCost, estimatedProfit, estimatedProfitRatePct };
}

/** 发货后实际财务：实际成本 / 实际利润 / 实际毛利率 */
export function calcActualFinance(
  estimatedCost: number,
  actualPrice: number,
  actualFreight: number,
): {
  actualCost: number;
  actualProfit: number;
  actualProfitRatePct: number;
} {
  const actualCost = roundMoney(estimatedCost + actualFreight);
  const actualProfit = roundMoney(actualPrice - actualCost);
  const actualProfitRatePct = calcProfitRatePct(actualProfit, actualPrice);
  return { actualCost, actualProfit, actualProfitRatePct };
}
