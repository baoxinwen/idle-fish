/**
 * 裸 number 输入（紧凑行内的 <input type="number">）的统一收敛层（第八轮 F-03）。
 * NumberField 组件内部走同一套规则；此处供不适合用带 label 块级组件的紧凑行复用，
 * 保证「Infinity / NaN / 负数不流入计价」的口径全站一致。
 */

/** 数量语义：非负整数。非有限/负数/小数一律回退 0。 */
export function toCount(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 金额/单价语义：非负有限数。非有限/负数回退 0。 */
export function toPrice(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
