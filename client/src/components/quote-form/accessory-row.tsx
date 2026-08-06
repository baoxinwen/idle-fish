import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/number-field';
import type { AccessoryItem } from '@idlefish/shared';

interface AccessoryRowProps {
  item: AccessoryItem;
  index: number;
  onUpdate: (index: number, patch: Partial<AccessoryItem>) => void;
  onRemove: (index: number) => void;
  /** 自定义类配件名称可编辑 */
  nameEditable?: boolean;
}

export function AccessoryRow({ item, index, onUpdate, onRemove, nameEditable }: AccessoryRowProps) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1.5">
        {nameEditable ? (
          <>
            <label className="text-xs text-muted-foreground">名称</label>
            <Input
              value={item.name}
              onChange={(e) => onUpdate(index, { name: e.target.value })}
              className="h-9"
            />
          </>
        ) : (
          <div className="flex h-9 items-center text-sm">{item.name}</div>
        )}
      </div>
      <NumberField
        label="数量"
        value={item.quantity}
        onChange={(v) => onUpdate(index, { quantity: v })}
        step={1}
        className="w-20"
      />
      <NumberField
        label="单价"
        value={item.unitPrice}
        onChange={(v) => onUpdate(index, { unitPrice: v })}
        step={0.01}
        suffix="元"
        className="w-28"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        className="mb-5 text-muted-foreground hover:text-destructive"
        title="删除"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
