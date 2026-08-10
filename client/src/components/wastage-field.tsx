/**
 * 损耗率输入：显示百分制（用户填 5 = 5%），存储为乘数（1.05）。
 * 计算引擎 × wastage 不变，显示层 ÷/× 转换，旧数据（存 1.05）兼容显示为 5。
 */

import { NumberField } from './number-field';

interface WastageFieldProps {
  label?: string;
  /** 乘数形式（1.05 = 5% 损耗） */
  value: number;
  onChange: (multiplier: number) => void;
  className?: string;
  /** 内部输入框后缀，默认 %；表格行内传 "" 由外部单位列显示 */
  suffix?: string;
}

export function WastageField({ label, value, onChange, className, suffix = '%' }: WastageFieldProps) {
  const pct = Math.round((value - 1) * 1000) / 10; // 1.05 → 5
  return (
    <NumberField
      label={label}
      className={className}
      value={pct}
      min={0}
      max={100}
      step={0.5}
      suffix={suffix}
      emptyValue={0}
      onChange={(v) => {
        const clamped = Math.min(100, Math.max(0, v));
        onChange(1 + clamped / 100); // 5 → 1.05
      }}
    />
  );
}
