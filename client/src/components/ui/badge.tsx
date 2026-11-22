import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'accent';

/** 柔和工程风徽章：半透明背景 + 同色文字，等宽小号。
    文字色按对卡面/色底的实测对比取档：warning 用 amber-800（amber-700 对琥珀底 4.47:1 差临门一脚），
    accent 文字走 accent-strong（品牌金亮色下 2.29:1 不达文字门槛）。 */
const variants: Record<BadgeVariant, string> = {
  default: 'bg-primary/10 text-primary ring-1 ring-primary/15',
  secondary: 'bg-muted text-muted-foreground ring-1 ring-border',
  destructive: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
  outline: 'border border-border text-foreground',
  success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20',
  warning: 'bg-amber-500/12 text-amber-800 dark:text-amber-400 ring-1 ring-amber-500/20',
  accent: 'bg-accent/15 text-accent-strong dark:text-accent-strong ring-1 ring-accent/25',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-mono-display text-[11px] font-medium tabular',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
