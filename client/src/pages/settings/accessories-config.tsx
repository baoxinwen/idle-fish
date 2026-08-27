/**
 * 默认配件配置：按类别分组的分区布局（替代原双列表格 + 每行类别下拉）。
 * 类别即配件身份（三通/螺母…极少换组）：组头即类别，组内「+」直接新增该类配件。
 */

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/store/settings-store';
import { CATEGORY_LABEL } from '@/lib/status';
import type { AccessoryCategory } from '@idlefish/shared';
// F-03：输入收敛统一走 lib/input-sanitize（此前与 accessory-row 各持一份拷贝）
import { toCount, toPrice } from '@/lib/input-sanitize';

const GROUP_ORDER: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'tray', 'custom'];

export function AccessoriesConfig() {
  const { settings, updateAccessory, removeAccessory } = useSettingsStore();

  const groups = useMemo(() => {
    if (!settings) return [];
    return GROUP_ORDER.map((cat) => ({
      cat,
      items: settings.defaultAccessories
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => a.category === cat),
    }));
  }, [settings]);

  if (!settings) return null;

  /** 在指定类别下新增一条默认配件 */
  function addTo(category: AccessoryCategory) {
    const names: Record<AccessoryCategory, string> = {
      connector: '新连接件',
      fastener: '新紧固件',
      blindplate: '新盲板',
      tray: '托盘',
      custom: '自定义配件',
    };
    useSettingsStore.setState((s) =>
      s.settings
        ? {
            settings: {
              ...s.settings,
              defaultAccessories: [
                ...s.settings.defaultAccessories,
                { name: names[category], category, defaultQuantity: 0, defaultUnitPrice: 0 },
              ],
            },
            dirty: true,
          }
        : {},
    );
  }

  const totalCount = settings.defaultAccessories.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">
          默认配件配置 <span className="ml-1 text-muted-foreground/60">({totalCount} 项)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map(({ cat, items }) => (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="label-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {CATEGORY_LABEL[cat]} <span className="text-muted-foreground/50">({items.length})</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => addTo(cat)} title={`新增${CATEGORY_LABEL[cat]}`}>
                <Plus className="h-3 w-3" />
                添加
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground/70">暂无该类配件</p>
            ) : (
              <div className="space-y-1">
                {/* 表头与配件行同列宽（名称自适应 / 数量 / 单价 / 删除） */}
                <div
                  className="hidden gap-2 text-xs text-muted-foreground sm:grid"
                  style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 96px 32px' }}
                >
                  <div>名称</div>
                  <div className="text-right">默认数量</div>
                  <div className="text-right">默认单价</div>
                  <div />
                </div>
                {items.map(({ a, i }) => (
                  <div key={i} className="space-y-2">
                    {/* 移动端带 label 的单列；sm+ 固定网格 */}
                    <div className="grid gap-2 sm:hidden" style={{ gridTemplateColumns: '72px 96px auto' }}>
                      <AccessoryFields i={i} name={a.name} quantity={a.defaultQuantity} unitPrice={a.defaultUnitPrice} onUpdate={updateAccessory} />
                    </div>
                    <div
                      className="hidden items-center gap-2 sm:grid"
                      style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 96px 32px' }}
                    >
                      <Input value={a.name} onChange={(e) => updateAccessory(i, { name: e.target.value })} className="h-8" aria-label="配件名称" />
                      <input type="number" min={0} step={1} value={a.defaultQuantity} onFocus={(e) => e.target.select()} onChange={(e) => updateAccessory(i, { defaultQuantity: toCount(e.target.value) })} aria-label="默认数量" className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30" />
                      <input type="number" min={0} step={0.01} value={a.defaultUnitPrice} onFocus={(e) => e.target.select()} onChange={(e) => updateAccessory(i, { defaultUnitPrice: toPrice(e.target.value) })} aria-label="默认单价" className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30" />
                      <button type="button" title="删除" aria-label="删除" onClick={() => removeAccessory(i)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {totalCount === 0 && (
          <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
            暂无配件配置，请在上方分类中点击「添加」
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 移动端字段组：名称整行 + 数量/单价同行 */
function AccessoryFields({
  i,
  name,
  quantity,
  unitPrice,
  onUpdate,
}: {
  i: number;
  name: string;
  quantity: number;
  unitPrice: number;
  onUpdate: ReturnType<typeof useSettingsStore.getState>['updateAccessory'];
}) {
  return (
    <>
      <div className="col-span-full">
        <label className="mb-1 block text-xs text-muted-foreground">名称</label>
        <Input value={name} onChange={(e) => onUpdate(i, { name: e.target.value })} className="h-8" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">数量</label>
        <input type="number" min={0} step={1} value={quantity} onChange={(e) => onUpdate(i, { defaultQuantity: toCount(e.target.value) })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">单价</label>
        <input type="number" min={0} step={0.01} value={unitPrice} onChange={(e) => onUpdate(i, { defaultUnitPrice: toPrice(e.target.value) })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-sm tabular" />
      </div>
      <RemoveInline i={i} />
    </>
  );
}

function RemoveInline({ i }: { i: number }) {
  const removeAccessory = useSettingsStore.getState().removeAccessory;
  return (
    <button type="button" onClick={() => removeAccessory(i)} title="删除" aria-label="删除" className="mt-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
