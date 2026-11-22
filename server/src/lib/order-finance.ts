/**
 * 订单 finance 的读写分层（评审 SHR-I1 抽为纯模块以便单测）：
 *  - parseRawOrderFinance：写路径（PUT 编辑 / ship 发货）的严格校验——
 *    shared orderFinanceSchema 优先（全字段 + 值域），legacy otherFee 旧结构
 *    兼容。损坏数据抛 422 拒绝，绝不静默归零「洗白」——否则 PUT 会把损坏
 *    finance 重建为结构完整的数据，使发货时的 typeof 防线失效（0 元成本发货）。
 *  - normalizeOrderFinance：GET 展示路径的容错兜底（缺失字段归零），仅供
 *    parseOrderRow 使用，写路径不得调用。
 */

import {
  calcOrderFinance,
  orderFinanceSchema,
  type OrderFinance,
} from '@idle-fish/shared';
import { HttpError } from './http-error.js';

/** 旧订单 finance 只有 otherFee；拆出 installFee/freight 时把 otherFee 归入安装费，
 *  以保持历史订单的预估成本与利润不变。 */
export function normalizeOrderFinance(raw: unknown): OrderFinance {
  const src = (raw ?? {}) as Partial<OrderFinance> & {
    estimatedCost?: number;
    estimatedProfit?: number;
    estimatedProfitRatePct?: number;
  };
  const materialCost = typeof src.materialCost === 'number' ? src.materialCost : 0;
  const actualPrice = typeof src.actualPrice === 'number' ? src.actualPrice : 0;
  const installFee =
    typeof src.installFee === 'number'
      ? src.installFee
      : typeof src.otherFee === 'number'
        ? src.otherFee
        : 0;
  const freight = typeof src.freight === 'number' ? src.freight : 0;
  return {
    ...calcOrderFinance(materialCost, installFee, freight, actualPrice),
    materialCost,
    installFee,
    freight,
    actualPrice,
  };
}

/** 写路径严格校验（S-5 / SHR-I1）：先对原始结构做存在性/类型检查再归一。
 *  shared orderFinanceSchema 全字段通过则直接采用（新数据获得值域校验）；
 *  否则兼容 legacy otherFee 旧结构；仍不完整抛 HttpError(422)。 */
export function parseRawOrderFinance(rawJson: unknown): OrderFinance {
  if (rawJson === null || typeof rawJson !== 'object') {
    throw new HttpError(422, '订单财务数据不完整');
  }
  const strict = orderFinanceSchema.safeParse(rawJson);
  if (strict.success) {
    return strict.data;
  }
  const raw = rawJson as Record<string, unknown>;
  const hasNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  // 旧版 finance 只有 otherFee（归入安装费口径），与 installFee 二选一即可
  if (!hasNumber(raw.materialCost) || !hasNumber(raw.actualPrice)) {
    throw new HttpError(422, '订单财务数据不完整');
  }
  if (!hasNumber(raw.installFee) && !hasNumber(raw.otherFee)) {
    throw new HttpError(422, '订单财务数据不完整');
  }
  return normalizeOrderFinance(rawJson);
}
