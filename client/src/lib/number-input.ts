/**
 * 数字输入框的统一提交策略（C-2 / I-4 根因修复的共用收敛层）。
 *
 * 背景：<input type="number"> 的 value 净化算法会把非法中间态（"12."、"-「、"e"）
 * 读成 ""。受控组件若把 "" 直接 Number("")=0 提交出去，会：
 *  - C-2（NumCell 直接绑定数值 prop）：store 变 0 → react-dom 把 0 写回 DOM，
 *    正在输入的内容被擦除，「12.5」落库成 5；
 *  - I-4（NumberField）：0 实时推进计价 store，预览抖动归零；带尾点失焦时原值被 0 覆盖。
 *
 * 策略：onChange 只提交可解析为有限数的文本；空串/非法中间态返回 null，
 * 由组件保持本地 text 原样（React 对空串不写回 DOM，浏览器内部编辑缓冲得以保留），
 * 失焦时统一收口：真空串 → emptyValue，非法中间态 → 还原受控原值。
 */

/** 可解析为有限数 → 返回该数；空串/非法中间态/非有限值 → null（不提交） */
export function parseNumberInput(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
