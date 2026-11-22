/**
 * 转单确认表单的共享形状与初始值工厂（第八轮 F-13）。
 * 此前 quote-editor 弹窗与 order-editor 转单模式各写一份字面量，字段漂移无编译保护。
 */

import type { QuoteConvertFinance } from './api';

/** 转单确认表单：客户/收货信息 + 逐项确认的财务数据 */
export interface ConvertConfirmForm {
  customer: { name: string; platformOrderNo: string };
  shippingAddress: { receiver: string; phone: string; address: string };
  remark: string;
  finance: QuoteConvertFinance;
}

/** 初始值工厂——每次返回全新对象，避免调用方共享引用 */
export function emptyConvertForm(): ConvertConfirmForm {
  return {
    customer: { name: '', platformOrderNo: '' },
    shippingAddress: { receiver: '', phone: '', address: '' },
    remark: '',
    finance: { materialCost: 0, installFee: 0, freight: 0, actualPrice: 0 },
  };
}
