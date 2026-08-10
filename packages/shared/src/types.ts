/**
 * 铝型材机柜报价工具 — 共享类型定义
 * 前后端共用的单一真相源。技术方案 docs/技术方案.md §8 计价规则为准。
 */

// ---------- 基础枚举 ----------

/** 型材颜色：银 / 黑，对应不同单价 */
export type ProfileColor = 'silver' | 'black';

/** 报价状态：草稿 / 已报价 / 已转为订单 */
export type QuoteStatus = 'draft' | 'quoted' | 'converted';

/** 订单状态：待生产 / 生产中 / 待发货 / 已发货 / 已完成 / 已取消 */
export type OrderStatus =
  | 'pending' // 待生产
  | 'producing' // 生产中
  | 'ready' // 待发货
  | 'shipped' // 已发货
  | 'done' // 已完成
  | 'cancelled'; // 已取消

/** 配件类别 */
export type AccessoryCategory = 'connector' | 'fastener' | 'blindplate' | 'tray' | 'custom';

// ---------- 几何与尺寸 ----------

/** 机柜外形尺寸（外径，单位 mm） */
export interface CabinetSize {
  /** 宽（外径，mm） */
  width: number;
  /** 深（外径，mm） */
  depth: number;
  /** 高（外径，mm） */
  height: number;
}

/** 内径换算 GAP：外径每边减 40mm */
export const SIZE_GAP = 40;

// ---------- 配件 ----------

/** 单个配件项 */
export interface AccessoryItem {
  /** 配件名称 */
  name: string;
  /** 类别 */
  category: AccessoryCategory;
  /** 数量 */
  quantity: number;
  /** 单价（元） */
  unitPrice: number;
}

/** 按类别分组的配件集合 */
export type AccessoryGroups = Record<AccessoryCategory, AccessoryItem[]>;

// ---------- 计价参数 ----------

/** 计价参数（单次报价可覆盖默认值） */
export interface PricingParams {
  /** 银色型材单价（元/m） */
  silverPrice: number;
  /** 黑色型材单价（元/m） */
  blackPrice: number;
  /** 损耗率（1.05 表示 5% 损耗） */
  wastage: number;
  /** 切割处理费（元，整单统一） */
  cuttingFee: number;
  /** 安装费（元） */
  installFee: number;
  /** 运费（元） */
  freight: number;
  /** 毛利率（0.2 表示 20%） */
  profitRate: number;
  /** 托盘系数 A */
  trayCoeffA: number;
  /** 托盘系数 B */
  trayCoeffB: number;
}

// ---------- 报价输入与结果 ----------

/** 报价输入参数（完整快照） */
export interface QuoteInput {
  /** 机柜外形尺寸（外径） */
  size: CabinetSize;
  /** 型材颜色 */
  color: ProfileColor;
  /** 托盘数量 */
  trayCount: number;
  /** 托盘单价（元，手动输入或建议价填入） */
  trayUnitPrice: number;
  /** 是否勾选安装费 */
  installEnabled: boolean;
  /** 是否勾选运费 */
  freightEnabled: boolean;
  /** 配件列表 */
  accessories: AccessoryItem[];
  /** 计价参数 */
  pricing: PricingParams;
}

/** 铝型材成本明细 */
export interface ProfileCostDetail {
  /** 内径宽（mm） */
  innerWidth: number;
  /** 内径深（mm） */
  innerDepth: number;
  /** 内径高（mm） */
  innerHeight: number;
  /** 12 条棱总长（m） */
  totalLength: number;
  /** 使用的型材单价（元/m） */
  unitPrice: number;
  /** 损耗率 */
  wastage: number;
  /** 铝型材成本（元） */
  cost: number;
}

/** 按类别汇总的配件成本 */
export interface AccessoryGroupCost {
  category: AccessoryCategory;
  items: AccessoryItem[];
  /** 该类别小计（元） */
  subtotal: number;
}

/** 完整成本分解 */
export interface CostBreakdown {
  /** 铝型材明细 */
  profile: ProfileCostDetail;
  /** 配件按类别分组明细 */
  accessoryGroups: AccessoryGroupCost[];
  /** 配件总成本（元） */
  accessoryTotal: number;
  /** 切割处理费（元） */
  cuttingFee: number;
  /** 托盘数量 */
  trayCount: number;
  /** 托盘单价 */
  trayUnitPrice: number;
  /** 托盘建议价（元） */
  traySuggestedPrice: number;
  /** 托盘成本（元） */
  trayCost: number;
  /** 材料成本（元）= 铝型材 + 切割费 + 配件 + 托盘 */
  materialCost: number;
  /** 安装费（元，未勾选则为 0） */
  installFee: number;
  /** 运费（元） */
  freight: number;
  /** 总成本（元）= 材料成本 + 安装费 + 运费 */
  totalCost: number;
}

/** 报价计算结果 */
export interface QuoteResult {
  /** 成本分解 */
  breakdown: CostBreakdown;
  /** 最终报价（元）= 总成本 ÷ (1 − 毛利率) */
  finalPrice: number;
  /** 预计利润（元）= 最终报价 − 总成本 */
  expectedProfit: number;
  /** 毛利率（百分比）= 预计利润 ÷ 最终报价 × 100 */
  profitRatePct: number;
}

// ---------- 报价记录 ----------

/** 报价记录（持久化） */
export interface QuoteRecord {
  id: string;
  /** 报价编号 Q-YYYYMMDD-XX */
  quoteNo: string;
  status: QuoteStatus;
  /** 完整输入快照 */
  input: QuoteInput;
  /** 计算结果 */
  result: QuoteResult;
  createdAt: string;
  updatedAt: string;
}

// ---------- 订单 ----------

/** 客户信息 */
export interface CustomerInfo {
  /** 客户名称 */
  name: string;
  /** 平台订单号 */
  platformOrderNo: string;
}

/** 收货信息 */
export interface ShippingAddress {
  /** 收件人 */
  receiver: string;
  /** 电话 */
  phone: string;
  /** 单行地址 */
  address: string;
}

/** 订单财务数据 */
export interface OrderFinance {
  /** 材料成本（元，从报价带入或手填） */
  materialCost: number;
  /** 其他费用（元） */
  otherFee: number;
  /** 预估成本（元）= 材料成本 + 其他费用 */
  estimatedCost: number;
  /** 实际售价（元） */
  actualPrice: number;
  /** 预估利润（元）= 实际售价 − 预估成本 */
  estimatedProfit: number;
  /** 预估毛利率（百分比） */
  estimatedProfitRatePct: number;
}

/** 发货数据（发货后才有） */
export interface ShippingInfo {
  /** 快递公司 */
  courier: string;
  /** 运单号 */
  trackingNo: string;
  /** 实际运费（元） */
  actualFreight: number;
  /** 核对备注 */
  checkRemark: string;
  /** 确认发货时间 */
  confirmedAt: string;
  /** 实际成本（元）= 预估成本 + 实际运费 */
  actualCost: number;
  /** 实际利润（元）= 实际售价 − 实际成本 */
  actualProfit: number;
  /** 实际毛利率（百分比） */
  actualProfitRatePct: number;
}

/** 订单记录（持久化） */
export interface OrderRecord {
  id: string;
  /** 订单编号 O-YYYYMMDD-XX */
  orderNo: string;
  /** 关联报价 ID（可空，手动新建时为 null） */
  quoteId: string | null;
  status: OrderStatus;
  /** 客户信息 */
  customer: CustomerInfo;
  /** 收货信息 */
  shippingAddress: ShippingAddress;
  /** 机柜尺寸 */
  size: CabinetSize;
  /** 材料清单（JSON） */
  materials: AccessoryItem[];
  /** 财务数据 */
  finance: OrderFinance;
  /** 发货数据（未发货时为 null） */
  shipping: ShippingInfo | null;
  /** 备注 */
  remark: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- 设置 ----------

/** 默认配件分组配置（设置中维护） */
export interface DefaultAccessoryConfig {
  /** 配件名称 */
  name: string;
  /** 类别 */
  category: AccessoryCategory;
  /** 默认数量 */
  defaultQuantity: number;
  /** 默认单价（元） */
  defaultUnitPrice: number;
}

/** 设置数据（单行） */
export interface Settings {
  /** 默认机柜尺寸 */
  defaultSize: CabinetSize;
  /** 默认计价参数 */
  defaultPricing: PricingParams;
  /** 默认颜色 */
  defaultColor: ProfileColor;
  /** 默认托盘数量 */
  defaultTrayCount: number;
  /** 默认托盘单价（托盘作为配件的默认单价） */
  defaultTrayUnitPrice: number;
  /** 默认配件分组配置 */
  defaultAccessories: DefaultAccessoryConfig[];
}

// ---------- 统计 ----------

/** 统计时间范围 */
export type StatsRange = '7d' | '30d' | '90d' | 'all';

/** 统计看板数据 */
export interface StatsData {
  range: StatsRange;
  /** 报价总数 */
  quoteCount: number;
  /** 报价总金额（元） */
  quoteTotalAmount: number;
  /** 报价转订单率（百分比） */
  conversionRatePct: number;
  /** 订单总数 */
  orderCount: number;
  /** 订单总营收（元，已完成/已发货口径） */
  orderRevenue: number;
  /** 总利润（元） */
  totalProfit: number;
  /** 平均毛利率（百分比） */
  avgProfitRatePct: number;
  /** 订单状态分布 */
  statusDistribution: { status: OrderStatus; count: number }[];
  /** 趋势数据点 */
  trend: { date: string; quoteCount: number; orderCount: number; profit: number }[];
  /** 最近报价（最多 10 条，按时间倒序） */
  recentQuotes: {
    id: string;
    quoteNo: string;
    finalPrice: number;
    status: QuoteStatus;
    createdAt: string;
  }[];
  /** 最近订单（最多 10 条，按时间倒序） */
  recentOrders: {
    id: string;
    orderNo: string;
    customerName: string;
    actualPrice: number;
    status: OrderStatus;
    createdAt: string;
  }[];
}

// ---------- 鉴权 ----------

/** 鉴权状态：GET /api/auth/status 返回 */
export interface AuthStatus {
  /** 是否已登录（有效会话） */
  authenticated: boolean;
  /** 是否需要首次设置（无管理员账户） */
  needsSetup: boolean;
}
