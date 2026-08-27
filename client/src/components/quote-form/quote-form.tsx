/**
 * 报价表单区（左侧）。
 * v2：费用计入改用 Switch；删除与「费用计入」重复绑定的计价参数"费用"分区；
 * 托盘建议价在系数未配置时隐藏；配件单价全 0 时提示去设置维护。
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight, Wand2, RotateCcw, X, Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { Switch } from '@/components/ui/switch';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ParamRow } from '@/components/param-row';
import { AccessoryRow } from './accessory-row';
import { useQuoteStore } from '@/store/quote-store';
import { cn } from '@/lib/utils';
import { COLOR_LABEL, CATEGORY_LABEL } from '@/lib/status';
import { calcTraySuggestedPrice, type Settings } from '@idlefish/shared';
import type { AccessoryCategory } from '@idlefish/shared';

const CATEGORY_ORDER: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'tray', 'custom'];

const PRICE_HINT_KEY = 'idlefish:price-hint-dismissed';

export function QuoteForm({ settings }: { settings: Settings | null }) {
  const navigate = useNavigate();
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
  const [priceHintDismissed, setPriceHintDismissed] = useState(
    () => localStorage.getItem(PRICE_HINT_KEY) === '1',
  );

  // 托盘建议价依赖系数 A/B：未配置（全 0）时建议恒为 0，入口纯属噪音，隐藏
  const trayCoeffsSet = input.pricing.trayCoeffA !== 0 || input.pricing.trayCoeffB !== 0;
  const suggestedPrice = useMemo(
    () =>
      calcTraySuggestedPrice(
        input.size,
        input.pricing.trayCoeffA,
        input.pricing.trayCoeffB,
      ),
    [input.size, input.pricing.trayCoeffA, input.pricing.trayCoeffB],
  );

  const hasAnyPrice = input.accessories.some((a) => a.unitPrice > 0);

  return (
    <div className="space-y-4">
      {/* 单价引导：首次使用最常见的坑——所有单价为 0 却直接保存 */}
      {!hasAnyPrice && !priceHintDismissed && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="flex-1 text-muted-foreground">
            配件单价当前均为 <span className="font-mono-display font-semibold text-foreground">¥0.00</span>
            ，建议先到 <button className="font-medium text-accent underline-offset-2 hover:underline" onClick={() => navigate('/settings')}>设置 → 配件配置</button> 维护常用单价，新建报价时自动带出。
          </p>
          <button
            type="button"
            aria-label="关闭提示"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setPriceHintDismissed(true);
              localStorage.setItem(PRICE_HINT_KEY, '1');
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 机柜配置：尺寸 + 颜色 + 费用计入，合并一卡 */}
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
          <SegmentedControl
            ariaLabel="型材颜色"
            value={input.color}
            onChange={setColor}
            options={[
              { value: 'silver', label: COLOR_LABEL.silver, dot: '#E4E4E7' },
              { value: 'black', label: COLOR_LABEL.black, dot: '#3F3F46' },
            ]}
          />
          {/* 费用计入：Switch 开关 + 明确的金额（0 也可见） */}
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs text-muted-foreground">费用计入总成本</Label>
            <FeeToggleRow
              label="运费"
              fee={input.pricing.freight}
              enabled={input.freightEnabled}
              onFeeChange={(v) => setPricing({ freight: v })}
              onEnabledChange={toggleFreight}
            />
            <FeeToggleRow
              label="安装费"
              fee={input.pricing.installFee}
              enabled={input.installEnabled}
              onFeeChange={(v) => setPricing({ installFee: v })}
              onEnabledChange={toggleInstall}
            />
          </div>
        </CardContent>
      </Card>

      {/* 配件清单 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">配件清单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* sm+ 表头：与配件行固定五列对齐 */}
          <div className="hidden grid-cols-[minmax(0,1fr)_72px_88px_88px_32px] items-end gap-2 border-b border-border pb-1 text-xs text-muted-foreground sm:grid">
            <div>名称</div>
            <div className="text-right">数量</div>
            <div className="text-right">单价</div>
            <div className="text-right">小计</div>
            <div />
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
                  {cat === 'tray' && trayCoeffsSet && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      建议价：{suggestedPrice.toFixed(2)}
                      <Button variant="ghost" size="sm" onClick={() => setTrayUnitPrice(suggestedPrice)}>
                        <Wand2 className="h-3 w-3" />
                        填入
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
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
                <div className="space-y-1">
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

      {/* 计价参数（折叠）：只保留型材与托盘两组；
          费用三项已在上方「费用计入」中编辑，重复入口曾导致同字段两处修改互相踩。 */}
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
          <CardContent className="grid grid-cols-1 gap-x-8 pt-0 lg:grid-cols-2">
            <div>
              <div className="label-mono mb-1 border-b border-border pb-1 text-[10px] text-muted-foreground/70">型材</div>
              <ParamRow label="银色单价" unit="元/m" value={input.pricing.silverPrice} onChange={(v) => setPricing({ silverPrice: v })} displayDecimals={2} />
              <ParamRow label="黑色单价" unit="元/m" value={input.pricing.blackPrice} onChange={(v) => setPricing({ blackPrice: v })} displayDecimals={2} />
              <ParamRow label="损耗率" unit="%" value={input.pricing.wastage} onChange={(v) => setPricing({ wastage: v })} wastage />
              <ParamRow label="毛利率" unit="%" value={input.pricing.profitRate} onChange={(v) => setPricing({ profitRate: v })} percent />
            </div>
            <div>
              <div className="label-mono mb-1 mt-3 border-b border-border pb-1 text-[10px] text-muted-foreground/70 lg:mt-0">托盘</div>
              {/* F-02：托盘系数允许负值（与设置页/shared schema 口径一致），必须传 unclamped */}
              <ParamRow label="托盘系数 A" unit="" value={input.pricing.trayCoeffA} onChange={(v) => setPricing({ trayCoeffA: v })} unclamped />
              <ParamRow label="托盘系数 B" unit="" value={input.pricing.trayCoeffB} onChange={(v) => setPricing({ trayCoeffB: v })} unclamped />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** 单行费用开关：Switch 决定计入与否；金额始终可见可编辑（0 显示为 0） */
function FeeToggleRow({
  label,
  fee,
  enabled,
  onFeeChange,
  onEnabledChange,
}: {
  label: string;
  fee: number;
  enabled: boolean;
  onFeeChange: (v: number) => void;
  onEnabledChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors',
        enabled ? 'border-accent/40 bg-accent/5' : 'border-input',
      )}
    >
      <span className={cn('text-sm font-medium', !enabled && 'text-muted-foreground')}>{label}</span>
      <div className="flex flex-1 items-center justify-end gap-3">
        <NumberField value={fee} onChange={onFeeChange} step={0.01} suffix="元" displayDecimals={2} className="w-36" />
        <Switch checked={enabled} onCheckedChange={onEnabledChange} ariaLabel={`计入${label}`} />
      </div>
    </div>
  );
}
