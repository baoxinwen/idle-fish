/**
 * 指标卡 — 工程蓝图风：label-mono 标签 + 等宽大数字 + 左侧暖金竖条强调。
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'default' | 'good' | 'bad' | 'gold';
}

export function StatCard({ label, value, hint, icon: Icon, accent = 'default' }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(11,18,32,0.06),0_2px_4px_rgba(11,18,32,0.04)]">
      {/* 左侧强调竖条 */}
      <span
        className={cn(
          'absolute left-0 top-4 bottom-4 w-1 rounded-r-full',
          accent === 'good' && 'bg-emerald-500',
          accent === 'bad' && 'bg-destructive',
          accent === 'gold' && 'bg-accent',
          accent === 'default' && 'bg-primary/40',
        )}
      />
      <div className="flex items-center justify-between pl-3">
        <span className="label-mono text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/60" />}
      </div>
      <div
        className={cn(
          'mt-2 pl-3 font-mono-display text-2xl font-bold tabular',
          accent === 'good' && 'text-emerald-600 dark:text-emerald-400',
          accent === 'bad' && 'text-destructive',
          accent === 'gold' && 'text-accent',
        )}
      >
        {value}
      </div>
      {hint && <div className="label-mono mt-1.5 pl-3 text-muted-foreground/70">{hint}</div>}
    </Card>
  );
}
