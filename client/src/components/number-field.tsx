import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface NumberFieldProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  /** 辅助说明（input 下方） */
  helper?: string;
  /** 错误信息（input 下方，红色） */
  error?: string;
  /** 空输入时回传的值（默认 0）。onChange 永远吐 number，不再吐 NaN/Infinity。
   *  哨兵语义：value === emptyValue 时输入框显示为空，「手输 0」与「空」在 UI 上不可区分。 */
  emptyValue?: number;
  /** 不做 min/max 的 JS 钳制（M10）。极少数允许负值的场景用（如托盘系数）；
   *  默认按 min（默认 0）/max 钳制，杜绝负数与 Infinity 流入实时计价。
   *  unclamped 时同时不向 DOM 透传 min/max——否则 spinner 受限而手输不受限，同一控件两套规则（F-11）。 */
  unclamped?: boolean;
}

/** 带标签的数字输入框。label 在上，helper/error 在下。onChange 永远返回有限 number。 */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  className,
  helper,
  error,
  emptyValue = 0,
  unclamped = false,
}: NumberFieldProps) {
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(value === emptyValue ? '' : String(value));
  }, [value, emptyValue]);

  function commit(raw: string) {
    if (raw.trim() === '') {
      onChange(emptyValue);
      return;
    }
    const n = Number(raw);
    // M10：只挡非有限值（NaN/Infinity，如键入/粘贴 "1e999"），避免 ¥∞ 进入计价预览。
    // NaN 在此一并兜住（Number('abc') 为 NaN，虽然 type=number 输入框很少放行到这）。
    if (!Number.isFinite(n)) {
      onChange(emptyValue);
      return;
    }
    if (unclamped) {
      onChange(n);
      return;
    }
    let v = n;
    if (v < min) v = min;
    if (max !== undefined && v > max) v = max;
    onChange(v);
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label className="label-mono text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          {...(unclamped ? {} : { min, max })}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          aria-invalid={!!error}
          className="tabular"
        />
        {suffix && (
          <span className="whitespace-nowrap font-mono-display text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground/70">{helper}</p>
      ) : null}
    </div>
  );
}
