/**
 * 默认配置种子数据 — 对应 requirements.md §3.3 与 §4.3 的默认值。
 */

import type { DefaultAccessoryConfig, Settings } from './types.js';

/** 默认配件分组（连接件 / 紧固件 / 盲板） */
export const DEFAULT_ACCESSORIES: DefaultAccessoryConfig[] = [
  // 连接件
  { name: '三通连接件', category: 'connector', defaultQuantity: 8, defaultUnitPrice: 0 },
  { name: 'L 型连接件', category: 'connector', defaultQuantity: 8, defaultUnitPrice: 0 },
  // 紧固件
  { name: 'M5 滑块螺母', category: 'fastener', defaultQuantity: 60, defaultUnitPrice: 0 },
  { name: 'M5×8 内六角螺丝', category: 'fastener', defaultQuantity: 60, defaultUnitPrice: 0 },
  { name: 'M6×12 十字螺丝', category: 'fastener', defaultQuantity: 40, defaultUnitPrice: 0 },
  // 盲板
  { name: '1U 盲板', category: 'blindplate', defaultQuantity: 0, defaultUnitPrice: 0 },
  { name: '2U 盲板', category: 'blindplate', defaultQuantity: 0, defaultUnitPrice: 0 },
  { name: '3U 盲板', category: 'blindplate', defaultQuantity: 0, defaultUnitPrice: 0 },
  { name: '4U 盲板', category: 'blindplate', defaultQuantity: 0, defaultUnitPrice: 0 },
];

/** 默认设置（首次启动写入数据库） */
export const DEFAULT_SETTINGS: Settings = {
  defaultSize: { width: 600, depth: 400, height: 800 },
  defaultColor: 'silver',
  defaultTrayCount: 1,
  defaultPricing: {
    silverPrice: 12.53,
    blackPrice: 13.8,
    wastage: 1.05,
    cuttingFee: 0,
    installFee: 0,
    freight: 0,
    profitRate: 0.2,
    trayCoeffA: 0,
    trayCoeffB: 0,
  },
  defaultAccessories: DEFAULT_ACCESSORIES,
};

/**
 * 生成报价/订单编号：Q-YYYYMMDD-XX / O-YYYYMMDD-XX
 * XX 为当日自增序号，两位补零。
 * @param prefix 'Q' | 'O'
 * @param dateStr ISO 日期（取日期部分 YYYYMMDD）
 * @param seq 当日序号（1 起）
 */
export function genBusinessNo(prefix: 'Q' | 'O', dateStr: string, seq: number): string {
  const yyyymmdd = dateStr.slice(0, 10).replace(/-/g, '');
  const xx = String(seq).padStart(2, '0');
  return `${prefix}-${yyyymmdd}-${xx}`;
}
