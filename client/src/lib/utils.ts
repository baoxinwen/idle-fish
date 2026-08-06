import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 金额格式化：¥ + 千分位 + 两位小数 */
export function formatMoney(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** ISO → 本地时区日期串 YYYY-MM-DD（避免 UTC 偏移导致跨天错位） */
export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA');
}

/** ISO → 显示用日期时间串 YYYY-MM-DD HH:mm:ss（本地时区） */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-CA');
  const time = d.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 8);
  return `${date} ${time}`;
}

/** 利润正负配色类：正=绿，负=红。统一三处（cost-summary/order-detail/stat-card）口径 */
export function profitColor(value: number): string {
  return value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-destructive';
}

/** 金额强调色（最终报价/总利润等主值）：暖金 */
export const moneyAccent = 'text-accent';

