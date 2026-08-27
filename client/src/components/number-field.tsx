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
  /** 清空输入时回传的值（默认 0）。onChange 永远吐 number，不再吐 NaN/Infinity。 */
  emptyValue?: number;
  /** 失焦/非聚焦态的小数位格式化（金额传 2）。不传则原样显示数字。 */
  displayDecimals?: number;
  /** 不做 min/max 的 JS 钳制（M10）。极少数允许负值的场景用（如托盘系数）；
   *  默认按 min（默认 0）/max 钳制，杜绝负数与 Infinity 流入实时计价。
   *  unclamped 时同时不向 DOM 透传 min/max——否则 spinner 受限而手输不受限，同一控件两套规则（F-11）。 */
  unclamped?: boolean;
}

/**
 * 带标签的数字输入框 v2。
 * 与旧版的关键差异：**0 永远显示为 "0"**（旧版把 emptyValue 渲染成空白框，
 * 导致运费/切割费等参数"填了 0"与"没配置"无法区分）。
 * 聚焦时全选便于直接覆盖输入；失焦回写规范值并按 displayDecimals 格式化。
 */
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
  displayDecimals,
  unclamped = false,
}: NumberFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState(() => formatValue(value, displayDecimals));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 外部值变化（实时计价联动、加载记录）时同步显示；正在输入时不打断
  React.useEffect(() => {
    if (!focused) setText(formatValue(value, displayDecimals));
    // displayDecimals 是静态配置，不需要作为依赖
  }, [value, focused, displayDecimals]);

  function commit(raw: string) {
    if (raw.trim() === '') {
      onChange(emptyValue);
      return;
    }
    const n = Number(raw);
    // M10：只挡非有限值（NaN/Infinity，如键入/粘贴 "1e999"），避免 ¥∞ 进入计价预览。
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
          ref={inputRef}
          type="number"
          inputMode="decimal"
          {...(unclamped ? {} : { min, max })}
          step={step}
          value={text}
          onFocus={(e) => {
            setFocused(true);
            // 全选：点击即覆盖，不必先手动清零
            e.target.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit(text);
            setText(formatValue(Number.isFinite(Number(text)) && text.trim() !== '' ? Number(text) : value, displayDecimals));
          }}
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

function formatValue(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return '0';
  if (decimals !== undefined) return v.toFixed(decimals);
  return String(v);
}
