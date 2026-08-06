/**
 * 报价表单区（左侧）。
 */

import { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Wand2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { ProfitRateField } from '@/components/profit-rate-field';
import { AccessoryRow } from './accessory-row';
import { useQuoteStore } from '@/store/quote-store';
import { cn } from '@/lib/utils';
import { COLOR_LABEL, CATEGORY_LABEL } from '@/lib/status';
import { calcTraySuggestedPrice, type Settings } from '@idlefish/shared';
import type { AccessoryCategory } from '@idlefish/shared';

const CATEGORY_ORDER: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'custom'];

export function QuoteForm({ settings }: { settings: Settings | null }) {
  const {
    input,
    setSize,
    setColor,
    setTrayCount,
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
      {/* 尺寸 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">机柜尺寸（外径）</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <NumberField label="宽" value={input.size.width} onChange={(v) => setSize('width', v)} suffix="mm" />
          <NumberField label="深" value={input.size.depth} onChange={(v) => setSize('depth', v)} suffix="mm" />
          <NumberField label="高" value={input.size.height} onChange={(v) => setSize('height', v)} suffix="mm" />
        </CardContent>
      </Card>

      {/* 颜色 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">型材颜色</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
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
        </CardContent>
      </Card>

      {/* 托盘 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">托盘</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumberField label="数量" value={input.trayCount} onChange={(v) => setTrayCount(v)} step={1} />
          <NumberField label="单价" value={input.trayUnitPrice} onChange={(v) => setTrayUnitPrice(v)} step={0.01} suffix="元" />
          <div className="col-span-2 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              建议价：¥{suggestedPrice.toFixed(2)}（面积×A+B）
            </span>
            <Button variant="ghost" size="sm" onClick={() => setTrayUnitPrice(suggestedPrice)}>
              <Wand2 className="h-3 w-3" />
              填入
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 费用勾选：运费 / 安装费是否计入本次报价 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">费用计入</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
        </CardContent>
      </Card>

      {/* 配件 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">配件清单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const items = input.accessories
              .map((a, i) => ({ a, i }))
              .filter(({ a }) => a.category === cat);
            if (items.length === 0 && cat !== 'custom') return null;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{CATEGORY_LABEL[cat]}</Label>
                  {cat === 'custom' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addAccessory({ name: '自定义配件', category: 'custom', quantity: 1, unitPrice: 0 })}
                    >
                      <Plus className="h-3 w-3" />
                      添加
                    </Button>
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
                      nameEditable={cat === 'custom'}
                    />
                  ))}
                  {cat === 'custom' && items.length === 0 && (
                    <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
                      点击「添加」增加自定义配件
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 计价参数（折叠） */}
      <Card>
        <div className="flex w-full items-center justify-between p-4">
          <button className="flex items-center gap-2" onClick={() => setShowPricing((v) => !v)}>
            <CardTitle className="text-sm">计价参数</CardTitle>
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
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="银色单价" value={input.pricing.silverPrice} onChange={(v) => setPricing({ silverPrice: v })} step={0.01} suffix="元/m" />
              <NumberField label="黑色单价" value={input.pricing.blackPrice} onChange={(v) => setPricing({ blackPrice: v })} step={0.01} suffix="元/m" />
              <NumberField label="损耗率" value={input.pricing.wastage} onChange={(v) => setPricing({ wastage: v })} step={0.01} emptyValue={1} />
              <ProfitRateField value={input.pricing.profitRate} onChange={(v) => setPricing({ profitRate: v })} />
              <NumberField label="切割处理费" value={input.pricing.cuttingFee} onChange={(v) => setPricing({ cuttingFee: v })} step={0.01} suffix="元" />
              <NumberField label="安装费" value={input.pricing.installFee} onChange={(v) => setPricing({ installFee: v })} step={0.01} suffix="元" />
              <NumberField label="运费" value={input.pricing.freight} onChange={(v) => setPricing({ freight: v })} step={0.01} suffix="元" />
              <NumberField label="托盘系数 A" value={input.pricing.trayCoeffA} onChange={(v) => setPricing({ trayCoeffA: v })} step={0.01} />
              <NumberField label="托盘系数 B" value={input.pricing.trayCoeffB} onChange={(v) => setPricing({ trayCoeffB: v })} step={0.01} />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
