/**
 * 计价参数表格行：标签固定宽 + 输入框等宽 + 单位固定宽，所有行对齐。
 * 设置页 / 报价页共用。
 */

import { NumberField } from './number-field';
import { ProfitRateField } from './profit-rate-field';
import { WastageField } from './wastage-field';

interface ParamRowProps {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  emptyValue?: number;
  /** 非聚焦态小数位格式化（金额类传 2） */
  displayDecimals?: number;
  /** 毛利率（百分制显示，存小数） */
  percent?: boolean;
  /** 损耗率（百分制显示，存乘数） */
  wastage?: boolean;
  /** 不做 ≥0 钳制（托盘系数等允许负值的参数） */
  unclamped?: boolean;
}

export function ParamRow({ label, unit, value, onChange, emptyValue, displayDecimals, percent, wastage, unclamped }: ParamRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="w-24 shrink-0 text-sm text-muted-foreground sm:w-28">{label}</span>
      {/* min-w 兜底：挤压时输入框保持可见可点，不可塌缩成竖条（宁可轻微溢出） */}
      {percent ? (
        <ProfitRateField label="" suffix="" value={value} onChange={onChange} className="min-w-16 flex-1" />
      ) : wastage ? (
        <WastageField label="" suffix="" value={value} onChange={onChange} className="min-w-16 flex-1" />
      ) : (
        <NumberField
          label=""
          value={value}
          onChange={onChange}
          step={0.01}
          emptyValue={emptyValue}
          displayDecimals={displayDecimals}
          unclamped={unclamped}
          className="min-w-16 flex-1"
        />
      )}
      <span className="w-10 shrink-0 text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}
