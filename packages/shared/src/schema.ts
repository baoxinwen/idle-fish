/**
 * zod 校验 schema — 前后端共用，确保入参合法。
 */

import { z } from 'zod';

// 数值统一加 .finite()：zod 的 z.number() 默认接受 ±Infinity（NaN 为独立 invalid_type），
// 极端输入参与运算会得到 Infinity，JSON.stringify 后落库成 null，污染财务数据。
// 在 .finite() 之上再加业务上限（第七轮 M3）：有限大输入（如 1e307 × 1e10）经引擎乘法
// 仍可能溢出为 Infinity，上限把量级压到远小于 Number.MAX_VALUE，从源头杜绝溢出路径。
/** 金额/费用类上限（元）：远超真实业务，仅作溢出与滥用防御。
 *  导出供 server 路由本地 schema 复用，避免双处定义漂移（第八轮 S-4）。 */
export const MONEY_MAX = 1e9;
/** 尺寸上限（mm） */
export const SIZE_MAX = 1_000_000;
/** 数量/计数上限 */
export const COUNT_MAX = 1_000_000;

/** 非负金额：nonnegative + finite + 上限（导出供路由复用） */
export const money = () => z.number().nonnegative().finite().max(MONEY_MAX);
/** 可正可负的有界数值（派生利润、托盘系数等） */
const bounded = () => z.number().finite().min(-MONEY_MAX).max(MONEY_MAX);

export const cabinetSizeSchema = z.object({
  width: z.number().positive().finite().max(SIZE_MAX),
  depth: z.number().positive().finite().max(SIZE_MAX),
  height: z.number().positive().finite().max(SIZE_MAX),
});

export const accessoryItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['connector', 'fastener', 'blindplate', 'tray', 'custom']),
  quantity: z.number().int().nonnegative().finite().max(COUNT_MAX),
  unitPrice: money(),
});

export const pricingParamsSchema = z.object({
  silverPrice: money(),
  blackPrice: money(),
  wastage: z.number().positive().finite().max(100), // 乘数 1.05=5% 损耗；上限防溢出
  cuttingFee: money(),
  installFee: money(),
  freight: money(),
  profitRate: z.number().min(0).max(0.999).finite(), // < 100%
  trayCoeffA: bounded(),
  trayCoeffB: bounded(),
});

export const quoteInputSchema = z.object({
  size: cabinetSizeSchema,
  color: z.enum(['silver', 'black']),
  trayCount: z.number().int().nonnegative().finite().max(COUNT_MAX),
  trayUnitPrice: money(),
  installEnabled: z.boolean(),
  freightEnabled: z.boolean(),
  accessories: z.array(accessoryItemSchema),
  pricing: pricingParamsSchema,
});

export const customerInfoSchema = z.object({
  name: z.string().min(1).max(100),
  platformOrderNo: z.string().max(100),
});

export const shippingAddressSchema = z.object({
  receiver: z.string().max(50),
  phone: z.string().max(50),
  address: z.string().max(300),
});

export const orderFinanceSchema = z.object({
  materialCost: money(),
  installFee: money(),
  freight: money(),
  otherFee: money(),
  estimatedCost: money(),
  actualPrice: money(),
  estimatedProfit: bounded(),
  estimatedProfitRatePct: bounded(),
});

export const shippingInfoSchema = z.object({
  courier: z.string().min(1).max(50),
  trackingNo: z.string().min(1).max(64),
  checkRemark: z.string().max(1000),
  confirmedAt: z.string(),
  actualFreight: money(),
  actualCost: money(),
  actualProfit: bounded(),
  actualProfitRatePct: bounded(),
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
  defaultTrayCount: z.number().int().nonnegative().finite().max(COUNT_MAX),
  /** 默认托盘单价（托盘作为配件的默认单价） */
  defaultTrayUnitPrice: money().default(0),
  defaultPricing: pricingParamsSchema,
  /** 品牌/卖家信息：导出报价单、生产单抬头使用。default 兜底旧数据（存量 settings 行无此字段） */
  brand: z
    .object({
      sellerName: z.string().min(1).max(50),
    })
    .default({ sellerName: '@包黑蛋' }),
  defaultAccessories: z.array(
    z.object({
      name: z.string().min(1).max(100),
      category: z.enum(['connector', 'fastener', 'blindplate', 'tray', 'custom']),
      defaultQuantity: z.number().int().nonnegative().finite().max(COUNT_MAX),
      defaultUnitPrice: money(),
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

/** bcrypt 只处理前 72 字节（UTF-8），超出部分静默不参与哈希；
 *  显式限制避免「长密码后半段无效」的强度误解。
 *  手写 UTF-8 字节计数：shared 包不依赖 DOM/Node 类型，TextEncoder 不保证可用。 */
const PASSWORD_BYTE_MAX = 72;
function utf8ByteLength(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; } // 高代理项，与低代理合并计 4 字节
    else bytes += 3;
  }
  return bytes;
}
const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((s) => utf8ByteLength(s) <= PASSWORD_BYTE_MAX, {
    message: `密码过长（UTF-8 编码需不超过 ${PASSWORD_BYTE_MAX} 字节）`,
  });

/** 首次设置入参：用户名 2~32，密码 8~128 且 ≤72 UTF-8 字节 */
export const setupSchema = z.object({
  username: z.string().min(2).max(32),
  password: passwordSchema,
});
