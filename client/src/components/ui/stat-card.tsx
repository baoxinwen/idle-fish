/**
 * 指标卡 — 工程蓝图风：label-mono 标签 + 等宽大数字 + 左侧强调竖条。
 * 自 dashboard 提升为全局组件，供看板及其他需要 KPI 的位置复用。
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatAccent = 'default' | 'good' | 'bad' | 'gold';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: StatAccent;
}

export function StatCard({ label, value, hint, accent = 'default' }: StatCardProps) {
  return (
    <Card className="card-hover relative overflow-hidden p-4">
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
      <div className="pl-3">
        <span className="label-mono text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          'mt-2 pl-3 font-mono-display text-lg font-bold tabular sm:text-2xl',
          accent === 'good' && 'text-emerald-700 dark:text-emerald-400',
          accent === 'bad' && 'text-destructive',
          accent === 'gold' && 'text-accent-strong',
        )}
      >
        {value}
      </div>
      {hint && <div className="label-mono mt-1.5 pl-3 text-[10px] text-muted-foreground sm:text-xs">{hint}</div>}
    </Card>
  );
}
