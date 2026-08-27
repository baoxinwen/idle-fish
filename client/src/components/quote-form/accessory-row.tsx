/**
 * 配件表格行。
 * sm+：CSS Grid 固定列模板（名称自适应 + 数量/单价/小计/删除定宽）——
 *   旧版 flex-wrap 下「可编辑名称 Input 的 w-full 假想宽度」会把删除按钮挤到第二行，此处以模板根治。
 * 移动端：名称整行，数量/单价/小计/删除同行；两套布局均为受控绑定同一 item。
 */

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/utils';
import type { AccessoryItem } from '@idlefish/shared';

/** M10/F-03：输入收敛统一走 lib/input-sanitize，杜绝 Infinity 与负单价流入实时计价 */
import { toCount, toPrice } from '@/lib/input-sanitize';

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

export function AccessoryRow({ item, index, onUpdate, onRemove, nameEditable, showRemove = true }: AccessoryRowProps) {
  const patch = (p: Partial<AccessoryItem>) => onUpdate(index, p);
  const remove = onRemove ? () => onRemove(index) : undefined;

  return (
    <>
      {/* 移动端 */}
      <div className="border-b border-border/60 py-2 last:border-0 sm:hidden">
        <label className="mb-1 block text-xs text-muted-foreground">名称</label>
        {nameEditable ? (
          <Input
            value={item.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="h-8"
            aria-label="配件名称"
          />
        ) : (
          <div className="flex h-8 items-center truncate text-sm">{item.name}</div>
        )}
        <div
          className="mt-2 grid items-end gap-2"
          style={{ gridTemplateColumns: '72px 88px minmax(0,1fr) auto' }}
        >
          <NumCell label="数量" value={item.quantity} onChange={(v) => patch({ quantity: toCount(String(v)) })} />
          <NumCell label="单价" value={item.unitPrice} decimal onChange={(v) => patch({ unitPrice: toPrice(String(v)) })} />
          <SubtotalCell value={item.quantity * item.unitPrice} />
          <RemoveCell showRemove={showRemove} onRemove={remove} />
        </div>
      </div>

      {/* sm+：固定五列网格 */}
      <div
        className="hidden items-center gap-2 border-b border-border/60 py-1.5 last:border-0 sm:grid"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 88px 88px 32px' }}
      >
        <div className="min-w-0">
          {nameEditable ? (
            <Input
              value={item.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="h-8"
              aria-label="配件名称"
            />
          ) : (
            <div className="flex h-8 items-center truncate text-sm">{item.name}</div>
          )}
        </div>
        <NumCell label="数量" value={item.quantity} onChange={(v) => patch({ quantity: toCount(String(v)) })} compact />
        <NumCell label="单价" value={item.unitPrice} decimal onChange={(v) => patch({ unitPrice: toPrice(String(v)) })} compact />
        <SubtotalCell value={item.quantity * item.unitPrice} compact />
        <RemoveCell showRemove={showRemove} onRemove={remove} alignRight />
      </div>
    </>
  );
}

function NumCell({
  label,
  value,
  decimal,
  compact,
  onChange,
}: {
  label?: string;
  value: number;
  /** 单价允许两位小数步进 */
  decimal?: boolean;
  /** sm+ 网格内：无 label（表头行已说明列含义） */
  compact?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      {!compact && <label className="mb-1 block text-xs text-muted-foreground">{label}</label>}
      <input
        type="number"
        min={0}
        step={decimal ? 0.01 : 1}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={compact ? label : undefined}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      />
    </div>
  );
}

function SubtotalCell({ value, compact }: { value: number; compact?: boolean }) {
  return (
    <div>
      {!compact && <label className="mb-1 block text-xs text-muted-foreground">小计</label>}
      <div className="flex h-8 items-center justify-end rounded-md bg-muted/50 px-2 text-sm font-medium tabular">
        {formatMoney(value)}
      </div>
    </div>
  );
}

function RemoveCell({
  showRemove,
  onRemove,
  alignRight,
}: {
  showRemove: boolean;
  onRemove?: () => void;
  alignRight?: boolean;
}) {
  if (!showRemove || !onRemove) return <span className={alignRight ? '' : 'w-8'} />;
  return (
    <button
      type="button"
      onClick={onRemove}
      title="删除"
      aria-label="删除"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${alignRight ? 'justify-self-end' : ''}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
