/**
 * 默认配件配置：按类别分组的分区布局（替代原双列表格 + 每行类别下拉）。
 * 类别即配件身份（三通/螺母…极少换组）：组头即类别，组内「+」直接新增该类配件。
 */

import { useId, useMemo, useRef, useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/store/settings-store';
import { CATEGORY_LABEL } from '@/lib/status';
import type { AccessoryCategory } from '@idle-fish/shared';
// F-03：输入收敛统一走 lib/input-sanitize（此前与 accessory-row 各持一份拷贝）
import { toCount, toPrice } from '@/lib/input-sanitize';
import { parseNumberInput } from '@/lib/number-input';

const GROUP_ORDER: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'tray', 'custom'];

/**
 * 配置页数字输入的 C-2 修复形态（评审 CFL-I3）——与 accessory-row NumCell 同策略：
 * 本地 text 态 + 仅提交可解析值，失焦统一收口。此前桌面/移动端四处裸 input 直接
 * 绑定数值 prop，键入 "." 的净化空串以 Number("")=0 实时回写擦掉输入，"12.5"
 * 落库成 5（本项目在 accessory-row.tsx:131 记录过同一缺陷）。
 */
function ConfigNumberInput({
  value,
  step,
  sanitize,
  commit,
  ariaLabel,
  id,
  className = 'h-8 w-full rounded-md border border-input bg-background px-2 text-right text-base sm:text-sm tabular focus-interlock',
}: {
  value: number;
  step: string;
  /** 字段语义收口：数量 toCount（整数）、单价 toPrice（两位金额） */
  sanitize: (raw: string) => number;
  commit: (n: number) => void;
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <input
      id={id}
      type="number"
      min={0}
      step={step}
      value={text}
      aria-label={ariaLabel}
      className={className}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        // 空串 → 0（清空语义）；非法中间态 sanitize 亦归 0，与既有口径一致
        commit(sanitize(text));
        setText(String(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        // 净化中间态（"" / "12." 读出 ""）不提交：保持本地文本原样，
        // react-dom 不会写回 DOM，浏览器内部编辑缓冲得以保留
        if (parseNumberInput(e.target.value) !== null) {
          commit(sanitize(e.target.value));
        }
      }}
    />
  );
}

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
          默认配件配置 <span className="ml-1 text-muted-foreground">({totalCount} 项)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map(({ cat, items }) => (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="label-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {CATEGORY_LABEL[cat]}{' '}
                <span className="text-muted-foreground/50">({items.length})</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addTo(cat)}
                title={`新增${CATEGORY_LABEL[cat]}`}
              >
                <Plus className="h-3 w-3" />
                添加
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">暂无该类配件</p>
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
                    <div
                      className="grid gap-2 sm:hidden"
                      style={{ gridTemplateColumns: '72px 96px auto' }}
                    >
                      <AccessoryFields
                        i={i}
                        name={a.name}
                        quantity={a.defaultQuantity}
                        unitPrice={a.defaultUnitPrice}
                        onUpdate={updateAccessory}
                      />
                    </div>
                    <div
                      className="hidden items-center gap-2 sm:grid"
                      style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 96px 32px' }}
                    >
                      <Input
                        value={a.name}
                        onChange={(e) => updateAccessory(i, { name: e.target.value })}
                        className="h-8"
                        aria-label="配件名称"
                      />
                      <ConfigNumberInput
                        ariaLabel="默认数量"
                        value={a.defaultQuantity}
                        step="1"
                        sanitize={toCount}
                        commit={(n) => updateAccessory(i, { defaultQuantity: n })}
                      />
                      <ConfigNumberInput
                        ariaLabel="默认单价"
                        value={a.defaultUnitPrice}
                        step="0.01"
                        sanitize={toPrice}
                        commit={(n) => updateAccessory(i, { defaultUnitPrice: n })}
                      />
                      <button
                        type="button"
                        title="删除"
                        aria-label="删除"
                        onClick={() => removeAccessory(i)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                      >
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
  // 可见 label 经 htmlFor 关联（i 是渲染序号、非稳定 id，这里用 useId 保证唯一）
  const idName = useId();
  const idQty = useId();
  const idPrice = useId();
  return (
    <>
      <div className="col-span-full">
        <label htmlFor={idName} className="mb-1 block text-xs text-muted-foreground">
          名称
        </label>
        <Input
          id={idName}
          value={name}
          onChange={(e) => onUpdate(i, { name: e.target.value })}
          className="h-8"
        />
      </div>
      <div>
        <label htmlFor={idQty} className="mb-1 block text-xs text-muted-foreground">
          数量
        </label>
        <ConfigNumberInput
          id={idQty}
          value={quantity}
          step="1"
          sanitize={toCount}
          commit={(n) => onUpdate(i, { defaultQuantity: n })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-base sm:text-sm tabular"
        />
      </div>
      <div>
        <label htmlFor={idPrice} className="mb-1 block text-xs text-muted-foreground">
          单价
        </label>
        <ConfigNumberInput
          id={idPrice}
          value={unitPrice}
          step="0.01"
          sanitize={toPrice}
          commit={(n) => onUpdate(i, { defaultUnitPrice: n })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-right text-base sm:text-sm tabular"
        />
      </div>
      <RemoveInline i={i} />
    </>
  );
}

function RemoveInline({ i }: { i: number }) {
  const removeAccessory = useSettingsStore.getState().removeAccessory;
  return (
    <button
      type="button"
      onClick={() => removeAccessory(i)}
      title="删除"
      aria-label="删除"
      className="mt-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
