/**
 * 报价表单区（左侧）。
 */

import { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Wand2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { ParamRow } from '@/components/param-row';
import { AccessoryRow } from './accessory-row';
import { useQuoteStore } from '@/store/quote-store';
import { cn } from '@/lib/utils';
import { COLOR_LABEL, CATEGORY_LABEL } from '@/lib/status';
import { calcTraySuggestedPrice, type Settings } from '@idlefish/shared';
import type { AccessoryCategory } from '@idlefish/shared';

const CATEGORY_ORDER: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'tray', 'custom'];

export function QuoteForm({ settings }: { settings: Settings | null }) {
  const {
    input,
    setSize,
    setColor,
    setTrayUnitPrice,
    toggleInstall,
    toggleFreight,
    updateAccessory,
    addAccessory,
    removeAccessory,
    setPricing,
    resetPricingFromSettings,
  } = useQuoteStore();

  const [showPricing, setShowPricing] = useState(false);

  const suggestedPrice = useMemo(
    () =>
      calcTraySuggestedPrice(
        input.size,
        input.pricing.trayCoeffA,
        input.pricing.trayCoeffB,
      ),
    [input.size, input.pricing.trayCoeffA, input.pricing.trayCoeffB],
  );

  return (
    <div className="space-y-4">
      {/* 机柜配置：尺寸 + 颜色 + 托盘 + 费用计入，合并一卡 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">机柜配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 尺寸 */}
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="宽" value={input.size.width} onChange={(v) => setSize('width', v)} suffix="mm" />
            <NumberField label="深" value={input.size.depth} onChange={(v) => setSize('depth', v)} suffix="mm" />
            <NumberField label="高" value={input.size.height} onChange={(v) => setSize('height', v)} suffix="mm" />
          </div>
          {/* 颜色 */}
          <div className="flex gap-2">
            {(['silver', 'black'] as const).map((c) => (
              <Button
                key={c}
                variant={input.color === c ? 'default' : 'outline'}
                onClick={() => setColor(c)}
                className="flex-1"
              >
                <span
                  className={cn(
                    'mr-2 h-3 w-3 rounded-full border',
                    c === 'silver' ? 'bg-zinc-200' : 'bg-zinc-700',
                  )}
                />
                {COLOR_LABEL[c]}
              </Button>
            ))}
          </div>
          {/* 费用计入 */}
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs text-muted-foreground">费用计入</Label>
            <label className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">运费</span>
                <span className="ml-2 text-xs text-muted-foreground tabular">¥{input.pricing.freight.toFixed(2)}</span>
              </span>
              <input
                type="checkbox"
                checked={input.freightEnabled}
                onChange={(e) => toggleFreight(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">安装费</span>
                <span className="ml-2 text-xs text-muted-foreground tabular">¥{input.pricing.installFee.toFixed(2)}</span>
              </span>
              <input
                type="checkbox"
                checked={input.installEnabled}
                onChange={(e) => toggleInstall(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 配件 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">配件清单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PC 表头：与配件行列对齐 */}
          <div className="hidden items-end gap-2 border-b border-border pb-1 text-xs text-muted-foreground sm:flex">
            <div className="flex-1">名称</div>
            <div className="w-20 text-right">数量</div>
            <div className="w-24 text-right">单价</div>
            <div className="w-24 text-right">小计</div>
            <div className="w-8" />
          </div>
          {CATEGORY_ORDER.filter((c) => c !== 'custom').map((cat) => {
            const items = input.accessories
              .map((a, i) => ({ a, i }))
              .filter(({ a }) => a.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{CATEGORY_LABEL[cat]}</Label>
                  {cat === 'tray' && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      建议价：¥{suggestedPrice.toFixed(2)}
                      <Button variant="ghost" size="sm" onClick={() => setTrayUnitPrice(suggestedPrice)}>
                        <Wand2 className="h-3 w-3" />
                        填入
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map(({ a, i }) => (
                    <AccessoryRow
                      key={i}
                      item={a}
                      index={i}
                      onUpdate={updateAccessory}
                      onRemove={removeAccessory}
                      nameEditable={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* 自定义配件：最后 */}
          {(() => {
            const items = input.accessories
              .map((a, i) => ({ a, i }))
              .filter(({ a }) => a.category === 'custom');
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{CATEGORY_LABEL.custom}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addAccessory({ name: '自定义配件', category: 'custom', quantity: 1, unitPrice: 0 })}
                  >
                    <Plus className="h-3 w-3" />
                    添加
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map(({ a, i }) => (
                    <AccessoryRow
                      key={i}
                      item={a}
                      index={i}
                      onUpdate={updateAccessory}
                      onRemove={removeAccessory}
                      nameEditable
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
                      点击「添加」增加自定义配件
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* 计价参数（折叠） */}
      <Card>
        <div className="flex w-full items-center justify-between p-4">
          <button className="flex items-center gap-2" onClick={() => setShowPricing((v) => !v)}>
            <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">计价参数</CardTitle>
            {showPricing ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showPricing && settings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetPricingFromSettings(settings)}
              title="恢复到设置中的默认值"
            >
              <RotateCcw className="h-3 w-3" />
              恢复默认
            </Button>
          )}
        </div>
        {showPricing && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
              <div>
                <div className="label-mono mb-1 border-b border-border pb-1 text-[10px] text-muted-foreground/70">型材</div>
                <ParamRow label="银色单价" unit="元/m" value={input.pricing.silverPrice} onChange={(v) => setPricing({ silverPrice: v })} />
                <ParamRow label="黑色单价" unit="元/m" value={input.pricing.blackPrice} onChange={(v) => setPricing({ blackPrice: v })} />
                <ParamRow label="损耗率" unit="%" value={input.pricing.wastage} onChange={(v) => setPricing({ wastage: v })} wastage />
                <ParamRow label="毛利率" unit="%" value={input.pricing.profitRate} onChange={(v) => setPricing({ profitRate: v })} percent />
              </div>
              <div>
                <div className="label-mono mb-1 border-b border-border pb-1 text-[10px] text-muted-foreground/70">费用</div>
                <ParamRow label="切割处理费" unit="元" value={input.pricing.cuttingFee} onChange={(v) => setPricing({ cuttingFee: v })} />
                <ParamRow label="安装费" unit="元" value={input.pricing.installFee} onChange={(v) => setPricing({ installFee: v })} />
                <ParamRow label="运费" unit="元" value={input.pricing.freight} onChange={(v) => setPricing({ freight: v })} />
                <div className="label-mono mb-1 mt-3 border-b border-border pb-1 text-[10px] text-muted-foreground/70">托盘</div>
                <ParamRow label="托盘系数 A" unit="" value={input.pricing.trayCoeffA} onChange={(v) => setPricing({ trayCoeffA: v })} />
                <ParamRow label="托盘系数 B" unit="" value={input.pricing.trayCoeffB} onChange={(v) => setPricing({ trayCoeffB: v })} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
