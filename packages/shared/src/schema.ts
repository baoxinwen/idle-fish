/**
 * zod 校验 schema — 前后端共用，确保入参合法。
 */

import { z } from 'zod';

// 数值统一加 .finite()：zod 的 z.number() 默认接受 ±Infinity/NaN（zod v3），
// 极端输入（如 1e308）参与运算会得到 Infinity，JSON.stringify 后落库成 null，污染财务数据。
export const cabinetSizeSchema = z.object({
  width: z.number().positive().finite(),
  depth: z.number().positive().finite(),
  height: z.number().positive().finite(),
});

export const accessoryItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['connector', 'fastener', 'blindplate', 'tray', 'custom']),
  quantity: z.number().int().nonnegative().finite(),
  unitPrice: z.number().nonnegative().finite(),
});

export const pricingParamsSchema = z.object({
  silverPrice: z.number().nonnegative().finite(),
  blackPrice: z.number().nonnegative().finite(),
  wastage: z.number().positive().finite(),
  cuttingFee: z.number().nonnegative().finite(),
  installFee: z.number().nonnegative().finite(),
  freight: z.number().nonnegative().finite(),
  profitRate: z.number().min(0).max(0.999).finite(), // < 100%
  trayCoeffA: z.number().finite(),
  trayCoeffB: z.number().finite(),
});

export const quoteInputSchema = z.object({
  size: cabinetSizeSchema,
  color: z.enum(['silver', 'black']),
  trayCount: z.number().int().nonnegative().finite(),
  trayUnitPrice: z.number().nonnegative().finite(),
  installEnabled: z.boolean(),
  freightEnabled: z.boolean(),
  accessories: z.array(accessoryItemSchema),
  pricing: pricingParamsSchema,
});

export const customerInfoSchema = z.object({
  name: z.string().min(1),
  platformOrderNo: z.string(),
});

export const shippingAddressSchema = z.object({
  receiver: z.string(),
  phone: z.string(),
  address: z.string(),
});

export const orderFinanceSchema = z.object({
  materialCost: z.number().nonnegative().finite(),
  otherFee: z.number().nonnegative().finite(),
  estimatedCost: z.number().nonnegative().finite(),
  actualPrice: z.number().nonnegative().finite(),
  estimatedProfit: z.number().finite(),
  estimatedProfitRatePct: z.number().finite(),
});

export const shippingInfoSchema = z.object({
  courier: z.string().min(1),
  trackingNo: z.string().min(1),
  actualFreight: z.number().nonnegative().finite(),
  checkRemark: z.string(),
  confirmedAt: z.string(),
  actualCost: z.number().nonnegative().finite(),
  actualProfit: z.number().finite(),
  actualProfitRatePct: z.number().finite(),
});

export const orderStatusSchema = z.enum([
  'pending',
  'producing',
  'ready',
  'shipped',
  'done',
  'cancelled',
]);

export const quoteStatusSchema = z.enum(['draft', 'quoted', 'converted']);

export const settingsSchema = z.object({
  defaultSize: cabinetSizeSchema,
  defaultColor: z.enum(['silver', 'black']),
  defaultTrayCount: z.number().int().nonnegative().finite(),
  /** 默认托盘单价（托盘作为配件的默认单价） */
  defaultTrayUnitPrice: z.number().nonnegative().finite().default(0),
  defaultPricing: pricingParamsSchema,
  defaultAccessories: z.array(
    z.object({
      name: z.string().min(1),
      category: z.enum(['connector', 'fastener', 'blindplate', 'tray', 'custom']),
      defaultQuantity: z.number().int().nonnegative().finite(),
      defaultUnitPrice: z.number().nonnegative().finite(),
    }),
  ),
});

export const statsRangeSchema = z.enum(['7d', '30d', '90d', 'all']);

// ---------- 鉴权 ----------

/** 登录入参：用户名/密码非空 */
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** 首次设置入参：用户名 2~32，密码 8~128（下限保证基本强度，上限防异常输入） */
export const setupSchema = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(8).max(128),
});
