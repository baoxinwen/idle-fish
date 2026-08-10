/**
 * 默认配件配置：增删改。
 * PC：双栏表格（表头 + 行分隔线），充分利用宽屏。
 * 移动端：单列，名称占满一行，其余字段第二行。
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
      <CardContent>
        {/* 双栏：PC 两列，移动端单列。所有配件（含托盘）同样式 */}
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          {[0, 1].map((col) => {
            const items = settings.defaultAccessories
              .map((a, i) => ({ a, i }))
              .filter((_, idx) => idx % 2 === col);
            return (
              <div key={col} className="min-w-0">
                {/* PC 表头 */}
                <div className="hidden items-end gap-2 border-b border-border pb-1 text-xs text-muted-foreground sm:flex">
                  <div className="flex-1">名称</div>
                  <div className="w-24">类别</div>
                  <div className="w-16 text-right">数量</div>
                  <div className="w-20 text-right">单价</div>
                  <div className="w-8" />
                </div>
                {items.map(({ a, i }) => (
                  <div key={i} className="flex flex-wrap items-end gap-2 border-b border-border/60 py-2 last:border-0 sm:py-1.5">
                    {/* 名称 */}
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <label className="mb-1 block text-xs text-muted-foreground sm:hidden">名称</label>
                      <Input
                        value={a.name}
                        onChange={(e) => updateAccessory(i, { name: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    {/* 类别 */}
                    <div className="w-24 shrink-0">
                      <label className="mb-1 block text-xs text-muted-foreground sm:hidden">类别</label>
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
                    <div className="w-16 shrink-0">
                      <label className="mb-1 block text-xs text-muted-foreground sm:hidden">数量</label>
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
                    <div className="w-20 shrink-0">
                      <label className="mb-1 block text-xs text-muted-foreground sm:hidden">单价</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={a.defaultUnitPrice}
                        onChange={(e) => updateAccessory(i, { defaultUnitPrice: Number(e.target.value) || 0 })}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAccessory(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {settings.defaultAccessories.length === 0 && (
          <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
            暂无配件配置，点击「添加」
          </div>
        )}
      </CardContent>
    </Card>
  );
}
