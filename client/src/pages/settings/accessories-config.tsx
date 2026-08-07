/**
 * 默认配件配置：增删改。
 * 移动端：名称占满一行，类别/数量/单价/删除第二行（与报价配件行布局统一）。
 * PC：单行网格。
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
        <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">默认配件配置</CardTitle>
        <Button variant="ghost" size="sm" onClick={addAccessory}>
          <Plus className="h-3 w-3" />
          添加
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {settings.defaultAccessories.map((a, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            {/* 名称：移动端占满整行，PC flex-1 */}
            <div className="min-w-0 flex-1 basis-full space-y-1.5 sm:basis-auto">
              <label className="text-xs text-muted-foreground sm:hidden">名称</label>
              <Input
                value={a.name}
                onChange={(e) => updateAccessory(i, { name: e.target.value })}
                className="h-8"
              />
            </div>
            {/* 类别 */}
            <div className="w-24 shrink-0 space-y-1.5">
              <label className="text-xs text-muted-foreground sm:hidden">类别</label>
              <Select
                value={a.category}
                onChange={(e) => updateAccessory(i, { category: e.target.value as AccessoryCategory })}
                className="h-8"
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
            {/* 数量 */}
            <div className="w-16 shrink-0 space-y-1.5">
              <label className="text-xs text-muted-foreground sm:hidden">数量</label>
              <input
                type="number"
                min={0}
                step={1}
                value={a.defaultQuantity}
                onChange={(e) => updateAccessory(i, { defaultQuantity: Number(e.target.value) || 0 })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
              />
            </div>
            {/* 单价 */}
            <div className="w-20 shrink-0 space-y-1.5">
              <label className="text-xs text-muted-foreground sm:hidden">单价</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={a.defaultUnitPrice}
                onChange={(e) => updateAccessory(i, { defaultUnitPrice: Number(e.target.value) || 0 })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
              />
            </div>
            {/* 删除 */}
            <Button
              variant="ghost"
              size="icon"
              className="mb-5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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
      </CardContent>
    </Card>
  );
}
