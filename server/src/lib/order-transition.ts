/**
 * 订单状态机（评审 SRV-I1 抽为纯模块以便单测）。
 * PATCH /:id/status 只负责无副作用的状态标记（开始生产/完成/取消），
 * shipped 蕴含发货核对数据（快递单号/实付运费），必须经 POST /:id/ship 进入——
 * 状态机因此不放行任何 →shipped 的转移，与 UI 一致（订单详情页的发货按钮
 * 打开 ship 弹窗而非 PATCH）。
 */

import type { OrderStatus } from '@idle-fish/shared';
import { HttpError } from './http-error.js';

export const statusTransition: Record<OrderStatus, OrderStatus[]> = {
  pending: ['producing', 'cancelled'],
  producing: ['ready', 'cancelled'],
  // 注意：不含 shipped——发货必经 POST /:id/ship 的核对校验（快递单号/实付
  // 运费必填 + shipping 落库）。此前 PATCH 可 ready→shipped 直达，绕过校验
  // 后 shipping 恒为 NULL，统计端静默回退估算利润（评审 SRV-I1）
  ready: ['cancelled'],
  shipped: ['done'],
  done: [],
  cancelled: [],
};

/** 校验 current → next 是否为合法流转，非法抛 400 */
export function assertOrderTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = statusTransition[current];
  if (!allowed.includes(next)) {
    throw new HttpError(400, `状态不可从 ${current} 流转到 ${next}`);
  }
}
