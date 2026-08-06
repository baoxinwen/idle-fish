/**
 * zod 校验 schema — 前后端共用，确保入参合法。
 */

import { z } from 'zod';

export const cabinetSizeSchema = z.object({
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
});

export const accessoryItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['connector', 'fastener', 'blindplate', 'custom']),
  quantity: z.number().int().nonnegative(),
  unitPrice: z.number().nonnegative(),
});

export const pricingParamsSchema = z.object({
  silverPrice: z.number().nonnegative(),
  blackPrice: z.number().nonnegative(),
  wastage: z.number().positive(),
  cuttingFee: z.number().nonnegative(),
  installFee: z.number().nonnegative(),
  freight: z.number().nonnegative(),
  profitRate: z.number().min(0).max(0.999), // < 100%
  trayCoeffA: z.number(),
  trayCoeffB: z.number(),
});

export const quoteInputSchema = z.object({
  size: cabinetSizeSchema,
  color: z.enum(['silver', 'black']),
  trayCount: z.number().int().nonnegative(),
  trayUnitPrice: z.number().nonnegative(),
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
  materialCost: z.number().nonnegative(),
  otherFee: z.number().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  actualPrice: z.number().nonnegative(),
  estimatedProfit: z.number(),
  estimatedProfitRatePct: z.number(),
});

export const shippingInfoSchema = z.object({
  courier: z.string().min(1),
  trackingNo: z.string().min(1),
  actualFreight: z.number().nonnegative(),
  checkRemark: z.string(),
  confirmedAt: z.string(),
  actualCost: z.number().nonnegative(),
  actualProfit: z.number(),
  actualProfitRatePct: z.number(),
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
  defaultTrayCount: z.number().int().nonnegative(),
  defaultPricing: pricingParamsSchema,
  defaultAccessories: z.array(
    z.object({
      name: z.string().min(1),
      category: z.enum(['connector', 'fastener', 'blindplate', 'custom']),
      defaultQuantity: z.number().int().nonnegative(),
      defaultUnitPrice: z.number().nonnegative(),
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
