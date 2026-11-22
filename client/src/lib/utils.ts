import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 金额格式化：¥ + 千分位 + 两位小数。-0 归零（SHR-M3：estimatedProfit 可为
 *  -0，直接格式化会显示「¥-0.00」） */
export function formatMoney(value: number): string {
  if (value === 0) value = 0; // -0 === 0，赋回 +0
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

/** 利润正负配色类：正=绿，负=红。统一利润数值配色口径（第八轮 F-08：内联三元已全部收口至此）。
    亮色用 emerald-700：emerald-600 对卡面实测 3.67:1 < 4.5 文字门槛。 */
export function profitColor(value: number): string {
  return value >= 0
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-destructive';
}

// ---------- 人民币大写金额（报价单「大写」行专用，评审视觉批） ----------

const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
/** 元整数部分从低到高的位权（支持到仟亿）；个位权为空串，「圆」由末尾统一补 */
const CN_YUAN_UNITS = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿', '拾', '佰', '仟'];

/**
 * 金额转人民币大写（报价单正式单据惯例）。支持 0 ~ 千亿级，四舍五入到分。
 * 规则：300.5 → 叁佰圆伍角；1002.05 → 壹仟零贰圆零伍分；12000 → 壹万贰仟圆整；
 * 100010300 → 壹亿零壹万零叁佰圆整（跨节零：高位段后紧跟更低非零段且中间整零时补「零」）。
 */
export function toCnyUppercase(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const fen = Math.round(amount * 100);
  if (fen <= 0) return '零圆整';

  const yuan = Math.floor(fen / 100);
  const jiao = Math.floor((fen % 100) / 10);
  const fenDigit = fen % 10;

  // 整数部分：按位权从高到低逐位扫描，零位挂起、遇到非零且已有输出时补「零」
  const digits = String(yuan);
  let intStr = '';
  let zeroPending = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = Number(digits[digits.length - 1 - i]);
    const weight = CN_YUAN_UNITS[i] ?? '';
    if (d === 0) {
      if (intStr !== '') zeroPending = true;
    } else {
      if (zeroPending) {
        intStr += '零';
        zeroPending = false;
      }
      intStr += CN_DIGITS[d] + weight;
    }
  }

  const hasYuan = yuan > 0;
  let out = hasYuan ? intStr + '圆' : '';

  if (jiao === 0 && fenDigit === 0) {
    if (!hasYuan) out = '零圆整';
    else out += '整';
  } else {
    if (jiao === 0 && fenDigit > 0 && hasYuan) out += '零';
    if (jiao > 0) out += CN_DIGITS[jiao] + '角';
    if (fenDigit > 0) out += CN_DIGITS[fenDigit] + '分';
  }
  return out;
}

