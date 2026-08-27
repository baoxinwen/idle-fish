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

/** 列表/卡片场景的短时间：MM-DD HH:mm（秒与年份在近Browse期数据里是噪音） */
export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const md = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  const hm = d.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5);
  return `${md} ${hm}`;
}

/** 紧凑金额：≥1 万显示 x.xx 万，其余同 formatMoney。用于 KPI 副文案等窄空间 */
export function formatCompactMoney(value: number): string {
  if (!Number.isFinite(value)) return formatMoney(0);
  if (Math.abs(value) >= 10000) {
    const w = value / 10000;
    const s = Math.abs(w) >= 100 ? w.toFixed(0) : w.toFixed(2).replace(/\.?0+$/, '');
    return `¥${s}万`;
  }
  return formatMoney(value);
}

/** 利润正负配色类：正=绿，负=红。统一利润数值配色口径（第八轮 F-08：内联三元已全部收口至此） */
export function profitColor(value: number): string {
  return value >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-destructive';
}

