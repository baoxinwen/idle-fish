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
  /** 空输入时回传的值（默认 0）。onChange 永远吐 number，不再吐 NaN。 */
  emptyValue?: number;
}

/** 带标签的数字输入框。label 在上，helper/error 在下。onChange 永远返回 number。 */
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
}: NumberFieldProps) {
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(value === emptyValue ? '' : String(value));
  }, [value, emptyValue]);

  function commit(raw: string) {
    const n = Number(raw);
    if (raw === '' || Number.isNaN(n)) {
      onChange(emptyValue);
      return;
    }
    onChange(n);
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label className="label-mono text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
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
