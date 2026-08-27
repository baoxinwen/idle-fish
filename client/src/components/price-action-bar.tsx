/**
 * 移动端底部常驻价格条（<lg 显示）。
 * 现场报价的核心诉求是"价格随时可见"——此前表单滚到最底才能看到报价。
 * PC 端不渲染：右栏 sticky 成本卡已承担该职责。
 */

import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpringMoney } from '@/components/cost-summary/spring-money';
import { cn } from '@/lib/utils';

interface PriceActionBarProps {
  /** 实时金额（随输入变化） */
  value: number;
  /** 金额上方的语义标签 */
  label?: string;
  /** 金额下方的辅助说明（如 总成本 / 毛利率） */
  hint?: string;
  /** 负值警示态（金额红显） */
  danger?: boolean;
  onSave: () => void;
  saving?: boolean;
}

export function PriceActionBar({ value, label = '最终报价', hint, danger, onSave, saving }: PriceActionBarProps) {
  return (
    <>
      {/* 固定条 */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="min-w-0">
          <div className="label-mono text-[10px] text-muted-foreground">{label}</div>
          <SpringMoney
            value={value}
            className={cn(
              'truncate font-mono-display text-xl font-bold tabular',
              danger ? 'text-destructive' : 'text-accent',
            )}
          />
          {hint && <div className="label-mono truncate text-[10px] text-muted-foreground/70">{hint}</div>}
        </div>
        <Button variant="accent" className="ml-auto shrink-0" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? '保存中…' : '保存'}
        </Button>
      </div>
      {/* 占位：避免内容被固定条遮挡 */}
      <div className="h-20 lg:hidden" />
    </>
  );
}
