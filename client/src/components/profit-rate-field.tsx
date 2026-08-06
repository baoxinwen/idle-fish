/**
 * 毛利率输入：显示百分制（用户输入 20 = 20%），存储为小数（0.2）。
 * 单独成组件是因为 profitRate 在引擎里是小数（0~0.999），但小数展示极易误输成 20。
 * 这里在显示层 ÷100 ↔ ×100 转换，并钳制 0~99.9%，避免 denom = 1 - profitRate ≤ 0
 * 触发引擎静默兜底（返回总成本 = 零利润）。
 */

import { NumberField } from './number-field';

interface ProfitRateFieldProps {
  label?: string;
  /** 小数形式的毛利率（0.2 = 20%） */
  value: number;
  onChange: (decimal: number) => void;
}

export function ProfitRateField({ label = '毛利率', value, onChange }: ProfitRateFieldProps) {
  const pct = Math.round(value * 1000) / 10; // 小数 → 百分制，保留 1 位
  return (
    <NumberField
      label={label}
      value={pct}
      min={0}
      max={99.9}
      step={0.1}
      suffix="%"
      emptyValue={0}
      onChange={(v) => {
        // 钳制 0~99.9，再转回小数（÷100），最后再钳到 0.999 防浮点越界（99.9→0.9990000000000001 > zod max 0.999）
        const clamped = Math.min(99.9, Math.max(0, v));
        const decimal = Math.round(clamped * 100) / 100 / 100;
        onChange(Math.min(0.999, decimal));
      }}
    />
  );
}
