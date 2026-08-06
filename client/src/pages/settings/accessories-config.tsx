/**
 * 默认配件配置表格：增删改。
 */

import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSettingsStore } from '@/store/settings-store';
import { CATEGORY_LABEL } from '@/lib/status';
import type { AccessoryCategory } from '@idlefish/shared';

export function AccessoriesConfig() {
  const { settings, addAccessory, updateAccessory, removeAccessory } = useSettingsStore();
  if (!settings) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">默认配件配置</CardTitle>
        <Button variant="ghost" size="sm" onClick={addAccessory}>
          <Plus className="h-3 w-3" />
          添加
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="overflow-x-auto">
          <div className="min-w-[480px] space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_80px_100px_36px] gap-2 px-1 text-xs text-muted-foreground">
              <div>名称</div>
              <div>类别</div>
              <div className="text-right">默认数量</div>
              <div className="text-right">默认单价</div>
              <div />
            </div>
            {settings.defaultAccessories.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_120px_80px_100px_36px] items-center gap-2"
              >
            <Input
              value={a.name}
              onChange={(e) => updateAccessory(i, { name: e.target.value })}
              className="h-8"
            />
            <Select
              value={a.category}
              onChange={(e) => updateAccessory(i, { category: e.target.value as AccessoryCategory })}
              className="h-8"
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <input
              type="number"
              min={0}
              step={1}
              value={a.defaultQuantity}
              onChange={(e) => updateAccessory(i, { defaultQuantity: Number(e.target.value) || 0 })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={a.defaultUnitPrice}
              onChange={(e) => updateAccessory(i, { defaultUnitPrice: Number(e.target.value) || 0 })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeAccessory(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {settings.defaultAccessories.length === 0 && (
          <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
            暂无配件配置，点击「添加」
          </div>
        )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
