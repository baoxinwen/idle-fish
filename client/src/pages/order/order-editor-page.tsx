/**
 * 订单编辑器页。
 * 三种模式：
 *  - /orders/new             手动新建（空表单，调 ordersApi.create）
 *  - /orders/new?fromQuote=x 从报价转单（调 quotesApi.convert，带客户/收货信息）
 *  - /orders/:id             编辑（调 ordersApi.update）
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
import { useOrderStore } from '@/store/order-store';
import { useToast } from '@/components/toaster';
import { LoadingState } from '@/components/states';
import { Modal } from '@/components/ui/modal';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { ordersApi, quotesApi, settingsApi } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { calcOrderFinance } from '@idlefish/shared';
import type { AccessoryItem, CabinetSize, QuoteRecord } from '@idlefish/shared';

type Mode = 'create' | 'convert' | 'edit';

export function OrderEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const fromQuote = searchParams.get('fromQuote');
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);

  const mode: Mode = fromQuote ? 'convert' : id ? 'edit' : 'create';

  // 转单模式：本地持有报价记录 + 客户/收货表单（财务来自报价，不可改）
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [convertForm, setConvertForm] = useState({
    customer: { name: '', platformOrderNo: '' },
    shippingAddress: { receiver: '', phone: '', address: '' },
    remark: '',
  });

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
    setOtherFee,
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
  }, [trackSource]); // eslint-disable-line react-hooks/exhaustive-deps
  const { blocker, clearDirty } = useUnsavedChanges(dirty);

  useEffect(() => {
    justLoaded.current = true;
    if (mode === 'convert' && fromQuote) {
      setQuote(null); // 重新加载前清空，避免渲染上一个报价
      quotesApi
        .get(fromQuote)
        .then((q) => setQuote(q))
        .catch((e) => toast(`加载报价失败：${e}`));
    } else if (mode === 'edit' && id) {
      markLoading(); // 避免渲染上一个订单数据
      ordersApi
        .get(id)
        .then((r) => loadFromRecord(r))
        .catch((e) => toast(`加载订单失败：${e}`));
    } else {
      // 手动新建：加载设置，带出必选配件
      settingsApi
        .get()
        .then((s) => reset(s))
        .catch((e) => toast(`加载设置失败：${e}`));
    }
  }, [mode, fromQuote, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 实时财务（转单模式用报价纯材料成本+安装费，与后端 convert 口径一致：运费不计入预估成本）
  const finance = useMemo(() => {
    if (mode === 'convert' && quote) {
      const b = quote.result.breakdown;
      return calcOrderFinance(b.materialCost, b.installFee, quote.result.finalPrice);
    }
    return calcOrderFinance(form.materialCost, form.otherFee, form.actualPrice);
  }, [mode, quote, form]);

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
        // 后端 convert：用报价的材料成本/售价创建订单，状态置 converted
        const res = await quotesApi.convert(fromQuote, {
          customer: convertForm.customer,
          shippingAddress: convertForm.shippingAddress,
          remark: convertForm.remark,
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
          otherFee: form.otherFee,
          actualPrice: form.actualPrice,
          remark: form.remark,
        });
        justLoaded.current = true;
        baselineRef.current = JSON.stringify(form);
        setDirty(false);
        clearDirty();
        toast('已保存修改');
      } else {
        // 手动新建
        const res = await ordersApi.create({
          customer: form.customer,
          shippingAddress: form.shippingAddress,
          size: form.size,
          materials: form.materials,
          materialCost: form.materialCost,
          otherFee: form.otherFee,
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

  // 统一的字段访问器（转单模式用报价纯材料成本+安装费，与后端一致）
  const customer = mode === 'convert' ? convertForm.customer : form.customer;
  const shippingAddress = mode === 'convert' ? convertForm.shippingAddress : form.shippingAddress;
  const size: CabinetSize = mode === 'convert' ? quote!.input.size : form.size;
  const materials: AccessoryItem[] = mode === 'convert' ? quote!.input.accessories : form.materials;
  const materialCost = mode === 'convert' ? quote!.result.breakdown.materialCost : form.materialCost;
  const otherFee = mode === 'convert' ? quote!.result.breakdown.installFee : form.otherFee;
  const actualPrice = mode === 'convert' ? quote!.result.finalPrice : form.actualPrice;
  const remark = mode === 'convert' ? convertForm.remark : form.remark;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BackBar
          onBack={() => navigate('/orders')}
          title={mode === 'convert' ? '报价转订单' : mode === 'edit' ? '编辑订单' : '新建订单'}
          code="ORDER · 订单"
        />
        <div className="flex gap-2">
          <Button variant="outline" className="shrink-0" onClick={() => navigate('/orders')}>取消</Button>
          <Button variant="accent" className="shrink-0" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          {/* 客户信息 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">客户信息</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>客户名称</Label>
                <Input
                  value={customer.name}
                  onChange={(e) =>
                    mode === 'convert'
                      ? setConvertForm((f) => ({ ...f, customer: { ...f.customer, name: e.target.value } }))
                      : setCustomer({ name: e.target.value })
                  }
                  placeholder="客户名称"
                />
              </div>
              <div className="space-y-1.5">
                <Label>平台订单号</Label>
                <Input
                  value={customer.platformOrderNo}
                  onChange={(e) =>
                    mode === 'convert'
                      ? setConvertForm((f) => ({ ...f, customer: { ...f.customer, platformOrderNo: e.target.value } }))
                      : setCustomer({ platformOrderNo: e.target.value })
                  }
                  placeholder="如淘宝/京东订单号"
                />
              </div>
            </CardContent>
          </Card>

          {/* 收货信息 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">收货信息</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>收件人</Label>
                  <Input
                    value={shippingAddress.receiver}
                    onChange={(e) =>
                      mode === 'convert'
                        ? setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, receiver: e.target.value } }))
                        : setShippingAddress({ receiver: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>电话</Label>
                  <Input
                    value={shippingAddress.phone}
                    onChange={(e) =>
                      mode === 'convert'
                        ? setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, phone: e.target.value } }))
                        : setShippingAddress({ phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>收货地址</Label>
                <Input
                  value={shippingAddress.address}
                  onChange={(e) =>
                    mode === 'convert'
                      ? setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, address: e.target.value } }))
                      : setShippingAddress({ address: e.target.value })
                  }
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
                  onClick={() => addMaterial({ name: '自定义配件', category: 'custom', quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="h-3 w-3" />
                  添加
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {materials.length === 0 ? (
                <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
                  无材料
                </div>
              ) : (
                materials.map((m, i) => (
                  <AccessoryRow
                    key={i}
                    item={m}
                    index={i}
                    onUpdate={updateMaterial}
                    onRemove={removeMaterial}
                    nameEditable={mode !== 'convert'}
                  />
                ))
              )}
              {mode === 'convert' && materials.length > 0 && (
                <div className="text-xs text-muted-foreground">转单模式材料来自报价，不可修改</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右：财务 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">财务数据</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {mode === 'convert' ? (
                  <>
                    <ReadOnlyField label="材料成本" value={formatMoney(materialCost)} />
                    <ReadOnlyField label="其他费用" value={formatMoney(otherFee)} />
                    <ReadOnlyField label="实际售价" value={formatMoney(actualPrice)} className="col-span-2" />
                  </>
                ) : (
                  <>
                    <NumberField
                      label="材料成本"
                      value={materialCost}
                      onChange={(v) => setMaterialCost(v)}
                      step={0.01}
                      suffix="元"
                    />
                    <NumberField
                      label="其他费用"
                      value={otherFee}
                      onChange={(v) => setOtherFee(v)}
                      step={0.01}
                      suffix="元"
                    />
                    <NumberField
                      label="实际售价"
                      value={actualPrice}
                      onChange={(v) => setActualPrice(v)}
                      step={0.01}
                      suffix="元"
                      className="col-span-2"
                    />
                  </>
                )}
              </div>
              {mode === 'convert' && (
                <div className="text-xs text-muted-foreground">财务数据来自报价，转单后可在订单编辑页修改</div>
              )}

              <div className="space-y-2 rounded-lg bg-muted/50 p-4">
                <FinanceRow label="预估成本" value={formatMoney(finance.estimatedCost)} />
                <FinanceRow label="预估利润" value={formatMoney(finance.estimatedProfit)} accent={finance.estimatedProfit >= 0 ? 'good' : 'bad'} />
                <FinanceRow label="预估毛利率" value={`${finance.estimatedProfitRatePct}%`} />
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
    </div>
  );
}

function BackBar({ onBack, title, code }: { onBack: () => void; title: string; code?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        {code && <div className="label-mono text-[10px] text-accent">{code}</div>}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'good' | 'bad';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular font-semibold ${
          accent === 'good'
            ? 'text-emerald-600 dark:text-emerald-400'
            : accent === 'bad'
              ? 'text-destructive'
              : ''
        }`}
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
