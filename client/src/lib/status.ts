/**
 * 状态标签映射 — 中文文案 + Badge 颜色。
 */

import type { OrderStatus, QuoteStatus } from '@idlefish/shared';
import type { BadgeProps } from '@/components/ui/badge';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待生产',
  producing: '生产中',
  ready: '待发货',
  shipped: '已发货',
  done: '已完成',
  cancelled: '已取消',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, BadgeProps['variant']> = {
  pending: 'secondary',
  producing: 'accent',   // 生产中 — 暖金
  ready: 'warning',      // 待发货 — 琥珀
  shipped: 'default',    // 已发货 — 深墨蓝
  done: 'success',       // 已完成 — 绿
  cancelled: 'destructive',
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: '草稿',
  quoted: '已报价',
  converted: '已转单',
};

export const QUOTE_STATUS_BADGE: Record<QuoteStatus, BadgeProps['variant']> = {
  draft: 'secondary',
  quoted: 'accent',      // 已报价 — 暖金
  converted: 'success',
};

export const COLOR_LABEL: Record<'silver' | 'black', string> = {
  silver: '银色',
  black: '黑色',
};

export const CATEGORY_LABEL: Record<string, string> = {
  connector: '连接件',
  fastener: '紧固件',
  blindplate: '盲板',
  tray: '托盘',
  custom: '自定义',
};
