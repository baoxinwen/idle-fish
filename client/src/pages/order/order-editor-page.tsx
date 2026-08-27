/**
 * 订单编辑器页。
 * 三种模式：
 *  - /orders/new             手动新建（空表单，调 ordersApi.create）
 *  - /orders/new?fromQuote=x 从报价转单（调 quotesApi.convert，带客户/收货信息）
 *  - /orders/:id             编辑（调 ordersApi.update）
 *
 * v2：客户与收货合并一卡；材料按类别分组；零材料成本时利润中性显示防误导；
 *     移动端底部常驻预估利润条。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { AccessoryRow } from '@/components/quote-form/accessory-row';
import { PriceActionBar } from '@/components/price-action-bar';
import { useOrderStore } from '@/store/order-store';
import { useToast } from '@/components/toaster';
import { LoadingState } from '@/components/states';
import { Modal } from '@/components/ui/modal';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { emptyConvertForm, type ConvertConfirmForm } from '@/lib/convert-form';
import { ordersApi, quotesApi, settingsApi } from '@/lib/api';
import { formatMoney, cn } from '@/lib/utils';
import { calcOrderFinance, roundMoney } from '@idlefish/shared';
import { CATEGORY_LABEL } from '@/lib/status';
import type { AccessoryCategory, AccessoryItem, CabinetSize, QuoteRecord } from '@idlefish/shared';

type Mode = 'create' | 'convert' | 'edit';

/** 材料分组展示顺序（custom 兜底在最后） */
const MATERIAL_ORDER: AccessoryCategory[] = ['connector', 'fastener', 'blindplate', 'tray', 'custom'];

export function OrderEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const fromQuote = searchParams.get('fromQuote');
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);

  const mode: Mode = fromQuote ? 'convert' : id ? 'edit' : 'create';

  // 转单模式：本地持有报价记录 + 客户/收货/财务确认表单
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertConfirmForm>(emptyConvertForm);

  // 手动新建/编辑模式：用 store
  const {
    form,
    editingId,
    initialized,
    loadFromRecord,
    reset,
    markLoading,
    setCustomer,
    setShippingAddress,
    setSize,
    setMaterialCost,
    setInstallFee,
    setFreight,
    setActualPrice,
    setRemark,
    updateMaterial,
    addMaterial,
    removeMaterial,
  } = useOrderStore();

  const [saving, setSaving] = useState(false);

  // 未保存修改跟踪
  const baselineRef = useRef('');
  const justLoaded = useRef(false);
  const [dirty, setDirty] = useState(false);
  // 跟踪对象：convert 模式用 convertForm，其他用 store form
  const trackSource = mode === 'convert' ? convertForm : form;
  useEffect(() => {
    if (justLoaded.current) {
      baselineRef.current = JSON.stringify(trackSource);
      setDirty(false);
      justLoaded.current = false;
      return;
    }
    setDirty(JSON.stringify(trackSource) !== baselineRef.current);
  }, [trackSource]); // 依赖刻意绑定 trackSource 根对象引用：字段级订阅会破坏整树 dirty 比对
  const { blocker, clearDirty } = useUnsavedChanges(dirty);

  useEffect(() => {
    let cancelled = false; // M7：竞态守卫——快速切换路由/参数时丢弃迟到响应
    justLoaded.current = true;
    if (mode === 'convert' && fromQuote) {
      setQuote(null); // 重新加载前清空，避免渲染上一个报价
      // L11：整体重置确认表单——同路由连续转单（?fromQuote=A→B）不残留上一单客户/收货信息
      setConvertForm(emptyConvertForm());
      quotesApi
        .get(fromQuote)
        .then((q) => {
          if (cancelled) return;
          setQuote(q);
          setConvertForm((f) => ({
            ...f,
            finance: {
              materialCost: q.result.breakdown.materialCost,
              installFee: q.result.breakdown.installFee,
              freight: q.result.breakdown.freight,
              actualPrice: q.result.finalPrice,
            },
          }));
        })
        .catch((e) => {
          if (!cancelled) toast(`加载报价失败：${e}`);
        });
    } else if (mode === 'edit' && id) {
      markLoading(); // 避免渲染上一个订单数据
      ordersApi
        .get(id)
        .then((r) => {
          if (!cancelled) loadFromRecord(r);
        })
        .catch((e) => {
          if (!cancelled) toast(`加载订单失败：${e}`);
        });
    } else {
      // 手动新建：markLoading 避免闪现上一个订单的陈旧数据（此前编辑过订单时 initialized=true）
      markLoading();
      // 加载设置，带出必选配件
      settingsApi
        .get()
        .then((s) => {
          if (!cancelled) reset(s);
        })
        .catch((e) => {
          if (!cancelled) toast(`加载设置失败：${e}`);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [mode, fromQuote, id]); // 依赖刻意为三元组：共同决定加载目标

  // 实时财务（转单模式用用户在右侧确认的价格）
  const finance = useMemo(() => {
    if (mode === 'convert' && quote) {
      const f = convertForm.finance;
      return calcOrderFinance(f.materialCost, f.installFee, f.freight, f.actualPrice);
    }
    // 新建模式：材料成本按材料清单实时计算（Σ 数量×单价），随清单编辑联动；编辑用已存值
    const mc =
      mode === 'create'
        ? roundMoney(form.materials.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0))
        : form.materialCost;
    return calcOrderFinance(mc, form.installFee, form.freight, form.actualPrice);
  }, [mode, quote, convertForm.finance, form]);

  async function handleSave() {
    // 必填校验
    const customerName = mode === 'convert' ? convertForm.customer.name : form.customer.name;
    if (!customerName.trim()) {
      toast('请填写客户名称');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'convert' && fromQuote && quote) {
        // 后端 convert：用确认后的材料成本/安装费/运费/售价创建订单，状态置 converted
        const res = await quotesApi.convert(fromQuote, {
          customer: convertForm.customer,
          shippingAddress: convertForm.shippingAddress,
          remark: convertForm.remark,
          finance: convertForm.finance,
        });
        toast(`已转单：${res.orderNo}`);
        justLoaded.current = true;
        setDirty(false);
        clearDirty();
        navigate(`/orders/${res.orderId}`, { replace: true });
      } else if (mode === 'edit' && editingId) {
        await ordersApi.update(editingId, {
          customer: form.customer,
          shippingAddress: form.shippingAddress,
          size: form.size,
          materials: form.materials,
          materialCost: form.materialCost,
          installFee: form.installFee,
          freight: form.freight,
          actualPrice: form.actualPrice,
          remark: form.remark,
        });
        justLoaded.current = true;
        baselineRef.current = JSON.stringify(form);
        setDirty(false);
        clearDirty();
        toast('已保存修改');
      } else {
        // 手动新建：材料成本按材料清单实时计算值提交
        const res = await ordersApi.create({
          customer: form.customer,
          shippingAddress: form.shippingAddress,
          size: form.size,
          materials: form.materials,
          materialCost,
          installFee: form.installFee,
          freight: form.freight,
          actualPrice: form.actualPrice,
          remark: form.remark,
        });
        toast(`已创建：${res.orderNo}`);
        justLoaded.current = true;
        setDirty(false);
        clearDirty();
        navigate('/orders', { replace: true });
      }
    } catch (e) {
      toast(`保存失败：${e}`);
    } finally {
      setSaving(false);
    }
  }

  // 转单模式下，若报价已转单则禁止
  if (mode === 'convert' && quote?.status === 'converted') {
    return (
      <div className="space-y-4">
        <BackBar onBack={() => navigate('/orders')} title="转订单" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            该报价已转为订单，不可重复转单。
          </CardContent>
        </Card>
      </div>
    );
  }

  const ready = mode === 'convert' ? quote !== null : initialized;

  if (!ready) return <LoadingState />;

  // 统一的字段访问器（转单模式用右侧确认表单，创建/编辑用 store）
  const customer = mode === 'convert' ? convertForm.customer : form.customer;
  const shippingAddress = mode === 'convert' ? convertForm.shippingAddress : form.shippingAddress;
  const size: CabinetSize = mode === 'convert' ? quote!.input.size : form.size;
  const materials: AccessoryItem[] = mode === 'convert' ? quote!.input.accessories : form.materials;
  // 材料成本：新建模式按材料清单实时计算（Σ 数量×单价）；转单用确认表单；编辑用手填/已存值
  const materialCost =
    mode === 'convert'
      ? convertForm.finance.materialCost
      : mode === 'create'
        ? roundMoney(materials.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0))
        : form.materialCost;
  const installFee = mode === 'convert' ? convertForm.finance.installFee : form.installFee;
  const freight = mode === 'convert' ? convertForm.finance.freight : form.freight;
  const actualPrice = mode === 'convert' ? convertForm.finance.actualPrice : form.actualPrice;
  const remark = mode === 'convert' ? convertForm.remark : form.remark;

  /** 材料成本为 0：利润指标无意义，降为中性提示而非绿色「盈利」 */
  const zeroMaterialCost = materialCost === 0;

  const bindCustomer = (patch: Partial<typeof customer>) =>
    mode === 'convert'
      ? setConvertForm((f) => ({ ...f, customer: { ...f.customer, ...patch } }))
      : setCustomer(patch);
  const bindAddress = (patch: Partial<typeof shippingAddress>) =>
    mode === 'convert'
      ? setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, ...patch } }))
      : setShippingAddress(patch);

  // M8：edit 模式材料清单可编辑，但材料成本此前用的是已存旧值——清单变更后自动按清单重算，
  // 避免「新清单 + 旧材料成本」落库导致预估成本/利润与看板统计失真。
  function recalcMaterialCost(next: AccessoryItem[]) {
    setMaterialCost(roundMoney(next.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0)));
  }
  function handleMaterialUpdate(index: number, patch: Partial<AccessoryItem>) {
    updateMaterial(index, patch);
    if (mode === 'edit') recalcMaterialCost(form.materials.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }
  function handleMaterialRemove(index: number) {
    removeMaterial(index);
    if (mode === 'edit') recalcMaterialCost(form.materials.filter((_, i) => i !== index));
  }
  function handleMaterialAdd(item: AccessoryItem) {
    addMaterial(item);
    if (mode === 'edit') recalcMaterialCost([...form.materials, item]);
  }

  /** 材料按类别分组（保持类别顺序，custom 最后）。数据量小，普通派生即可——不可用 useMemo：
      本组件在它之前存在条件性提前 return，hook 数量会随渲染分支变化触发 React #310。 */
  const groupedMaterials = MATERIAL_ORDER.map((cat) => ({
    cat,
    items: materials
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  const setFieldByMode =
    <K extends 'materialCost' | 'installFee' | 'freight' | 'actualPrice'>(key: K) =>
    (v: number) =>
      mode === 'convert'
        ? setConvertForm((f) => ({ ...f, finance: { ...f.finance, [key]: v } }))
        : key === 'materialCost'
          ? setMaterialCost(v)
          : key === 'installFee'
            ? setInstallFee(v)
            : key === 'freight'
              ? setFreight(v)
              : setActualPrice(v);

  return (
    <div className="space-y-4">
      {/* 操作栏 sticky：长表单时保存始终可达 */}
      <div className="sticky top-0 z-20 -mx-3 flex flex-col gap-3 border-b bg-background/80 px-3 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:-mx-6 lg:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">
            {mode === 'convert' ? '报价转订单' : mode === 'edit' ? '编辑订单' : '新建订单'}
          </h1>
          <span className="label-mono hidden text-[10px] text-accent sm:block">ORDER · 订单</span>
        </div>
        <div className="flex gap-2 lg:hidden">
          <Button variant="outline" onClick={() => navigate('/orders')}>取消</Button>
          <Button variant="accent" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button variant="outline" className="shrink-0" onClick={() => navigate('/orders')}>取消</Button>
          <Button variant="accent" className="shrink-0" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 左：订单要素 */}
        <div className="space-y-4">
          {/* 客户与收货（合并卡）：sm 起两列网格，减少半屏滚动距离 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">客户与收货</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>客户名称 *</Label>
                  <Input
                    value={customer.name}
                    onChange={(e) => bindCustomer({ name: e.target.value })}
                    placeholder="客户名称"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>平台订单号</Label>
                  <Input
                    value={customer.platformOrderNo}
                    onChange={(e) => bindCustomer({ platformOrderNo: e.target.value })}
                    placeholder="如淘宝/京东订单号"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>收件人</Label>
                  <Input
                    value={shippingAddress.receiver}
                    onChange={(e) => bindAddress({ receiver: e.target.value })}
                    placeholder="收件人姓名"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>电话</Label>
                  <Input
                    value={shippingAddress.phone}
                    onChange={(e) => bindAddress({ phone: e.target.value })}
                    placeholder="手机号码"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>收货地址</Label>
                <Input
                  value={shippingAddress.address}
                  onChange={(e) => bindAddress({ address: e.target.value })}
                  placeholder="省市区详细地址"
                />
              </div>
            </CardContent>
          </Card>

          {/* 尺寸（转单只读） */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">机柜尺寸</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {(['width', 'depth', 'height'] as const).map((f) => (
                <NumberField
                  key={f}
                  label={f === 'width' ? '宽' : f === 'depth' ? '深' : '高'}
                  value={size[f]}
                  onChange={(v) => { if (mode !== 'convert') setSize(f, v); }}
                  suffix="mm"
                />
              ))}
            </CardContent>
            {mode === 'convert' && (
              <div className="px-6 pb-4 text-xs text-muted-foreground">转单模式尺寸来自报价，不可修改</div>
            )}
          </Card>

          {/* 材料清单（转单只读展示，手动可编辑） */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">材料清单</CardTitle>
              {mode !== 'convert' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMaterialAdd({ name: '自定义配件', category: 'custom', quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="h-3 w-3" />
                  添加
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedMaterials.length === 0 ? (
                <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
                  无材料
                </div>
              ) : (
                groupedMaterials.map(({ cat, items }) => (
                  <div key={cat} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{CATEGORY_LABEL[cat]}</Label>
                    <div className="hidden grid-cols-[minmax(0,1fr)_72px_88px_88px_32px] items-end gap-2 border-b border-border pb-1 text-xs text-muted-foreground sm:grid">
                      <div>名称</div>
                      <div className="text-right">数量</div>
                      <div className="text-right">单价</div>
                      <div className="text-right">小计</div>
                      <div />
                    </div>
                    <div className="space-y-1">
                      {items.map(({ m, i }) => (
                        <AccessoryRow
                          key={i}
                          item={m}
                          index={i}
                          onUpdate={handleMaterialUpdate}
                          onRemove={handleMaterialRemove}
                          nameEditable={mode !== 'convert'}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
              {mode === 'convert' && materials.length > 0 && (
                <div className="text-xs text-muted-foreground">转单模式材料来自报价，不可修改</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右：财务，PC sticky 滚动表单时固定可见 */}
        <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">财务数据</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {mode === 'convert' ? (
                  <>
                    <NumberField label="材料成本" value={materialCost} onChange={setFieldByMode('materialCost')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="安装费" value={installFee} onChange={setFieldByMode('installFee')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="运费" value={freight} onChange={setFieldByMode('freight')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="实际售价" value={actualPrice} onChange={setFieldByMode('actualPrice')} step={0.01} suffix="元" displayDecimals={2} />
                  </>
                ) : mode === 'create' ? (
                  <>
                    {/* 新建：材料成本按材料清单实时计算，只读 */}
                    <ReadOnlyField label="材料成本（按清单计算）" value={formatMoney(materialCost)} />
                    <NumberField label="安装费" value={installFee} onChange={setFieldByMode('installFee')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="运费" value={freight} onChange={setFieldByMode('freight')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="实际售价" value={actualPrice} onChange={setFieldByMode('actualPrice')} step={0.01} suffix="元" displayDecimals={2} />
                  </>
                ) : (
                  <>
                    <NumberField
                      label="材料成本"
                      value={materialCost}
                      onChange={setFieldByMode('materialCost')}
                      step={0.01}
                      suffix="元"
                      displayDecimals={2}
                      helper="修改材料清单后将自动按清单重算"
                    />
                    <NumberField label="安装费" value={installFee} onChange={setFieldByMode('installFee')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="运费" value={freight} onChange={setFieldByMode('freight')} step={0.01} suffix="元" displayDecimals={2} />
                    <NumberField label="实际售价" value={actualPrice} onChange={setFieldByMode('actualPrice')} step={0.01} suffix="元" displayDecimals={2} />
                  </>
                )}
              </div>
              {mode === 'convert' && (
                <div className="text-xs text-muted-foreground">
                  请逐项确认材料成本、安装费、运费与实际售价，确认后提交转单。
                </div>
              )}

              <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                <FinanceRow label="预估成本" value={formatMoney(finance.estimatedCost)} />
                {zeroMaterialCost ? (
                  <>
                    <FinanceRow label="预估利润" value={formatMoney(finance.estimatedProfit)} muted />
                    <FinanceRow label="预估毛利率" value={`${finance.estimatedProfitRatePct}%`} muted />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      材料成本为 0，利润仅供参考——请在清单中填写单价或手工填入材料成本后再判断盈亏。
                    </p>
                  </>
                ) : (
                  <>
                    <FinanceRow
                      label="预估利润"
                      value={formatMoney(finance.estimatedProfit)}
                      accent={finance.estimatedProfit >= 0 ? 'good' : 'bad'}
                    />
                    <FinanceRow label="预估毛利率" value={`${finance.estimatedProfitRatePct}%`} />
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>备注</Label>
                <Input
                  value={remark}
                  onChange={(e) =>
                    mode === 'convert'
                      ? setConvertForm((f) => ({ ...f, remark: e.target.value }))
                      : setRemark(e.target.value)
                  }
                  placeholder="选填"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 未保存修改导航拦截 */}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} title="有未保存的修改">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">离开会丢失当前未保存的修改，确认离开？</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => blocker.reset?.()}>继续编辑</Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>放弃修改</Button>
          </div>
        </div>
      </Modal>

      {/* 移动端底部常驻利润条 */}
      <PriceActionBar
        label="预估利润"
        value={finance.estimatedProfit}
        hint={`毛利率 ${finance.estimatedProfitRatePct}%${zeroMaterialCost ? ' · 材料成本为 0' : ''}`}
        danger={finance.estimatedProfit < 0 || zeroMaterialCost}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: 'good' | 'bad';
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular font-semibold',
          !accent && !muted && 'text-foreground',
          accent === 'good' && 'text-emerald-600 dark:text-emerald-400',
          accent === 'bad' && 'text-destructive',
          muted && 'font-normal text-muted-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm tabular">
        {value}
      </div>
    </div>
  );
}
