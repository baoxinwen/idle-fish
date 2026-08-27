import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** 左侧装饰点（如颜色选择的小圆片） */
  dot?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}

/** 滑块式分段选择：等宽选项 + 卡片态高亮，替代原生 select 与多按钮组。 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-1 rounded-md bg-secondary/70 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-8 items-center justify-center gap-2 rounded-[5px] px-3 text-sm font-medium transition-all',
              active
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.dot && (
              <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: o.dot }} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
