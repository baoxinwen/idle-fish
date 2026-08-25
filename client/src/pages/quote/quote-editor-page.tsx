/**
 * 报价新建/编辑页：左表单 + 右上 3D 预览 + 右下成本明细。
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Download, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { QuoteForm } from '@/components/quote-form/quote-form';
import { Cabinet3D } from '@/components/cabinet-3d/cabinet-3d';
import { CostSummary } from '@/components/cost-summary/cost-summary';
import { ExportDialog } from '@/components/export/export-dialog';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/states';
import { useQuoteStore } from '@/store/quote-store';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { emptyConvertForm, type ConvertConfirmForm } from '@/lib/convert-form';
import { useToast } from '@/components/toaster';
import { quotesApi, settingsApi } from '@/lib/api';
import { calcQuote, type QuoteRecord, type Settings } from '@idlefish/shared';

export function QuoteEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const { input, editingId, editingStatus, initialized, loadFromRecord, reset, markLoading, invalidateEditing } = useQuoteStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportQuote, setExportQuote] = useState<QuoteRecord | null>(null);
  // 转订单弹窗
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  // F-13：转单确认表单形状与 order-editor 共用 lib/convert-form
  const [convertForm, setConvertForm] = useState<ConvertConfirmForm>(emptyConvertForm);

  // 未保存修改跟踪：baseline 是上次加载/保存的 input 快照，input 变化与之比较
  const baselineRef = useRef<string>('');
  const justLoaded = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (justLoaded.current) {
      // 加载/重置/保存后的首次 input 变化：更新 baseline，不算 dirty
      baselineRef.current = JSON.stringify(input);
      setDirty(false);
      justLoaded.current = false;
      return;
    }
    setDirty(JSON.stringify(input) !== baselineRef.current);
  }, [input]);

  const { blocker, clearDirty } = useUnsavedChanges(dirty);

  // 加载设置 + 编辑记录
  useEffect(() => {
    // 创建后导航到 /quotes/:id 时，store 已通过 loadFromRecord 持有该记录，
    // editingId === id，此时跳过 markLoading/重载，避免短暂 LoadingState 闪屏。
    // 注意：此分支不产生 input 变化，不可重设 justLoaded.current——
    // 否则创建后第一次编辑会被误当作「刚加载」而吞掉 dirty 标记。
    if (id && editingId === id && initialized) {
      return;
    }
    let cancelled = false; // M7：竞态守卫——快速切换路由时丢弃迟到响应
    markLoading();
    justLoaded.current = true;
    (async () => {
      try {
        const s = await settingsApi.get();
        if (cancelled) return;
        setSettings(s);
        if (id) {
          const q = await quotesApi.get(id);
          if (cancelled) return;
          loadFromRecord(q.input, q.id, q.status);
        } else {
          reset(s);
        }
      } catch (e) {
        // M6：此前内层 promise 未 return/catch，坏 id（已删除/404/500）会永久卡 LoadingState
        // 且产生 unhandledrejection。现在统一兜底：提示后回列表（终止态），不再无限转圈。
        if (cancelled) return;
        toast(`加载失败：${e}`);
        navigate('/quotes', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]); // 依赖刻意为 id：id 变化即重新判定加载/跳过

  if (!initialized) {
    return <LoadingState />;
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      if (editingId) {
        await quotesApi.update(editingId, input);
        justLoaded.current = true;
        baselineRef.current = JSON.stringify(input);
        setDirty(false);
        clearDirty();
        toast('已保存修改');
      } else {
        const record = await quotesApi.create(input);
        justLoaded.current = true;
        loadFromRecord(record.input, record.id, record.status);
        clearDirty();
        toast(`已保存：${record.quoteNo}`);
        navigate(`/quotes/${record.id}`, { replace: true });
      }
    } catch (e) {
      toast(`保存失败：${e}`);
    } finally {
      setSaving(false);
    }
  }

  /** 打开转单弹窗前，确保报价已保存（新建未保存 / 有未保存修改都先存） */
  async function ensureSaved(): Promise<string | null> {
    if (editingId && !dirty) return editingId; // 已存且无修改
    setSaving(true);
    try {
      if (editingId) {
        await quotesApi.update(editingId, input);
        justLoaded.current = true;
        baselineRef.current = JSON.stringify(input);
        setDirty(false);
        clearDirty();
        return editingId;
      }
      // 新建：create 拿 id
      const record = await quotesApi.create(input);
      justLoaded.current = true;
      loadFromRecord(record.input, record.id, record.status);
      clearDirty();
      return record.id;
    } catch (e) {
      toast(`保存失败：${e}`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertSubmit() {
    if (!convertForm.customer.name.trim()) {
      toast('请填写客户名称');
      return;
    }
    const quoteId = await ensureSaved();
    if (!quoteId) return;
    setConverting(true);
    try {
      const res = await quotesApi.convert(quoteId, {
        customer: convertForm.customer,
        shippingAddress: convertForm.shippingAddress,
        remark: convertForm.remark,
        finance: convertForm.finance,
      });
      toast(`已转单：${res.orderNo}`);
      justLoaded.current = true;
      setDirty(false);
      clearDirty();
      setConvertOpen(false);
      navigate(`/orders/${res.orderId}`, { replace: true });
    } catch (e) {
      toast(`转单失败：${e}`);
    } finally {
      setConverting(false);
    }
  }

  function openConvert() {
    const result = calcQuote(input);
    setConvertForm({
      ...emptyConvertForm(),
      finance: {
        materialCost: result.breakdown.materialCost,
        installFee: result.breakdown.installFee,
        freight: result.breakdown.freight,
        actualPrice: result.finalPrice,
      },
    });
    setConvertOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 sticky：长表单时保存/转单始终可达 */}
      <div className="sticky top-0 z-20 -mx-3 flex flex-col gap-3 border-b bg-background/80 px-3 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:-mx-6 lg:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/quotes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="label-mono text-[10px] text-accent">QUOTE · 报价</div>
            <h1 className="text-xl font-bold">{editingId ? '编辑报价' : '新建报价'}</h1>
            {editingId && <p className="hidden text-xs text-muted-foreground sm:block">修改后保存将更新此报价</p>}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Button variant="outline" className="shrink-0" onClick={() => navigate('/quotes')}>取消</Button>
          {editingId && (
            <Button
              variant="outline"
              className="shrink-0"
              onClick={async () => {
                try {
                  // 取已存记录的元数据（编号/时间），但 input 用 store 实时值、result 重算，
                  // 确保导出与屏幕预览一致（含未保存的修改）
                  const saved = await quotesApi.get(editingId);
                  setExportQuote({
                    ...saved,
                    input,
                    result: calcQuote(input),
                  });
                } catch (e) {
                  toast(`加载失败：${e}`);
                }
              }}
            >
              <Download className="h-4 w-4" />
              导出
            </Button>
          )}
          <Button
            variant="outline"
            className="shrink-0"
            onClick={openConvert}
            disabled={saving || converting || editingStatus === 'converted'}
            title={editingStatus === 'converted' ? '该报价已转为订单' : undefined}
          >
            <FilePlus className="h-4 w-4" />
            {editingStatus === 'converted' ? '已转单' : '转订单'}
          </Button>
          <Button variant="accent" className="shrink-0" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 左：表单 */}
        <QuoteForm settings={settings} />

        {/* 右：3D + 成本明细，PC sticky 滚动表单时固定可见 */}
        <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          {/* 3D 预览：工程蓝图风背景 + 顶部标签 + 右下尺寸参考 */}
          <div className="relative h-[260px] overflow-hidden rounded-lg border bg-[radial-gradient(circle_at_50%_40%,#1E3A5F_0%,#0B1220_100%)] p-2 lg:h-[340px]">
            {/* 细网格线（蓝图感） */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(#C9A96133 1px,transparent 1px),linear-gradient(90deg,#C9A96133 1px,transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="label-mono pointer-events-none absolute left-3 top-3 z-10 text-[10px] text-accent/80">
              3D 预览 · 可拖拽旋转
            </div>
            <div className="label-mono pointer-events-none absolute bottom-3 right-3 z-10 rounded bg-black/30 px-2 py-1 text-[10px] text-accent/90 tabular">
              {input.size.width}×{input.size.depth}×{input.size.height}mm
            </div>
            <Cabinet3D size={input.size} color={input.color} />
          </div>
          <CostSummary />
        </div>
      </div>

      <ExportDialog open={exportQuote !== null} onClose={() => setExportQuote(null)} quote={exportQuote} />

      {/* 未保存修改导航拦截 */}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} title="有未保存的修改">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">离开会丢失当前未保存的修改，确认离开？</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => blocker.reset?.()}>继续编辑</Button>
            <Button
              variant="destructive"
              onClick={() => {
                // M5：先丢弃 store 中的编辑态再导航——否则重进同一报价时跳过分支命中，
                // 会复活刚被放弃的脏数据且立即标脏
                invalidateEditing();
                blocker.proceed?.();
              }}
            >
              放弃修改
            </Button>
          </div>
        </div>
      </Modal>

      {/* 转订单弹窗：填客户/收货信息并确认价格，提交时自动保存报价再转单 */}
      <Modal
        open={convertOpen}
        onClose={() => !converting && setConvertOpen(false)}
        title="报价转订单"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            转单将自动保存当前报价。请逐项确认材料成本、安装费、运费与实际售价后创建订单。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="材料成本"
              value={convertForm.finance.materialCost}
              onChange={(v) => setConvertForm((f) => ({ ...f, finance: { ...f.finance, materialCost: v } }))}
              step={0.01}
              suffix="元"
            />
            <NumberField
              label="安装费"
              value={convertForm.finance.installFee}
              onChange={(v) => setConvertForm((f) => ({ ...f, finance: { ...f.finance, installFee: v } }))}
              step={0.01}
              suffix="元"
            />
            <NumberField
              label="运费"
              value={convertForm.finance.freight}
              onChange={(v) => setConvertForm((f) => ({ ...f, finance: { ...f.finance, freight: v } }))}
              step={0.01}
              suffix="元"
            />
            <NumberField
              label="实际售价"
              value={convertForm.finance.actualPrice}
              onChange={(v) => setConvertForm((f) => ({ ...f, finance: { ...f.finance, actualPrice: v } }))}
              step={0.01}
              suffix="元"
            />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>客户名称 *</Label>
              <Input
                value={convertForm.customer.name}
                onChange={(e) => setConvertForm((f) => ({ ...f, customer: { ...f.customer, name: e.target.value } }))}
                placeholder="客户名称"
              />
            </div>
            <div className="space-y-1.5">
              <Label>平台订单号</Label>
              <Input
                value={convertForm.customer.platformOrderNo}
                onChange={(e) => setConvertForm((f) => ({ ...f, customer: { ...f.customer, platformOrderNo: e.target.value } }))}
                placeholder="如淘宝/京东订单号"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>收件人</Label>
                <Input
                  value={convertForm.shippingAddress.receiver}
                  onChange={(e) => setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, receiver: e.target.value } }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>电话</Label>
                <Input
                  value={convertForm.shippingAddress.phone}
                  onChange={(e) => setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, phone: e.target.value } }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>收货地址</Label>
              <Input
                value={convertForm.shippingAddress.address}
                onChange={(e) => setConvertForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, address: e.target.value } }))}
                placeholder="省市区详细地址"
              />
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Input
                value={convertForm.remark}
                onChange={(e) => setConvertForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConvertOpen(false)} disabled={converting}>取消</Button>
            <Button onClick={handleConvertSubmit} disabled={converting || saving}>
              {converting || saving ? '转单中…' : '确认转单'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
