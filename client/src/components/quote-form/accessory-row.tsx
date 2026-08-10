import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/utils';
import type { AccessoryItem } from '@idlefish/shared';

interface AccessoryRowProps {
  item: AccessoryItem;
  index: number;
  onUpdate: (index: number, patch: Partial<AccessoryItem>) => void;
  onRemove?: (index: number) => void;
  /** 自定义类配件名称可编辑 */
  nameEditable?: boolean;
  /** 显示删除按钮（托盘等固定项不显示） */
  showRemove?: boolean;
}

/**
 * 配件表格行：PC 与父容器表头列对齐（无内部 label）+ 行分隔线；
 * 移动端保留 label 并换行。
 */
export function AccessoryRow({ item, index, onUpdate, onRemove, nameEditable, showRemove = true }: AccessoryRowProps) {
  const subtotal = item.quantity * item.unitPrice;

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-border/60 py-2 last:border-0 sm:py-1.5">
      {/* 名称 */}
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <label className="mb-1 block text-xs text-muted-foreground sm:hidden">名称</label>
        {nameEditable ? (
          <Input
            value={item.name}
            onChange={(e) => onUpdate(index, { name: e.target.value })}
            className="h-8"
          />
        ) : (
          <div className="flex h-8 items-center truncate text-sm">{item.name}</div>
        )}
      </div>
      {/* 数量 */}
      <div className="w-20 shrink-0">
        <label className="mb-1 block text-xs text-muted-foreground sm:hidden">数量</label>
        <input
          type="number"
          min={0}
          step={1}
          value={item.quantity}
          onChange={(e) => onUpdate(index, { quantity: Number(e.target.value) || 0 })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
        />
      </div>
      {/* 单价 */}
      <div className="w-24 shrink-0">
        <label className="mb-1 block text-xs text-muted-foreground sm:hidden">单价</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={item.unitPrice}
          onChange={(e) => onUpdate(index, { unitPrice: Number(e.target.value) || 0 })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
        />
      </div>
      {/* 小计 */}
      <div className="w-24 shrink-0">
        <label className="mb-1 block text-xs text-muted-foreground sm:hidden">小计</label>
        <div className="flex h-8 items-center justify-end rounded-md bg-muted/50 px-2 text-sm font-medium tabular">
          {formatMoney(subtotal)}
        </div>
      </div>
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
