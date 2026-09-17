/**
 * 报价新建/编辑页：左表单 + 右上 3D 预览 + 右下成本明细。
 * 移动端由底部 PriceActionBar 常驻最终报价与保存按钮。
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Download, FilePlus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuoteForm } from '@/components/quote-form/quote-form';
import { Cabinet3D } from '@/components/cabinet-3d/cabinet-3d';
import { CostSummary } from '@/components/cost-summary/cost-summary';
import { PriceActionBar } from '@/components/price-action-bar';
import { ExportDialog } from '@/components/export/export-dialog';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/states';
import { ConvertQuoteDialog, useConvertQuote } from '@/components/quote-form/convert-dialog';
import { useQuoteStore } from '@/store/quote-store';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { useDirtyTracking } from '@/lib/use-dirty-tracking';
import { useToast } from '@/components/toaster';
import { quotesApi, settingsApi } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { calcQuote, type QuoteRecord, type Settings } from '@idle-fish/shared';

export function QuoteEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const { input, editingId, editingStatus, initialized, loadFromRecord, reset, markLoading, invalidateEditing } = useQuoteStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [exportQuote, setExportQuote] = useState<QuoteRecord | null>(null);
  // 3D 预览在移动端默认折叠，长表单不用滚过整块画布
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const convert = useConvertQuote((orderId, orderNo) => {
    toast(`已转单：${orderNo}`);
    clearDirty();
    setDirty(false);
    navigate(`/orders/${orderId}`, { replace: true });
  });

  // 未保存修改跟踪：baseline 是上次加载/保存的 input 快照，input 变化与之比较
  //（I-2：抽为共用 hook——保存必须 markSaved()，悬挂的 justLoaded 会吞掉保存后首次编辑）
  const { dirty, setDirty, markLoaded, markSaved } = useDirtyTracking(input);

  const { blocker, clearDirty } = useUnsavedChanges(dirty);

  // 加载设置 + 编辑记录
  useEffect(() => {
    // 创建后导航到 /quotes/:id 时，store 已通过 loadFromRecord 持有该记录，
    // editingId === id，此时跳过 markLoading/重载，避免短暂 LoadingState 闪屏。
    // 注意：此分支不产生 input 变化，不可重设 justLoaded.current——
    // 否则创建后第一次编辑会被误当作「刚加载」而吞掉 dirty 标记。
    if (id && editingId === id && initialized) {
      // C-3：跳过分支只覆盖「创建后跳转」场景。用户离开编辑页后本地 settings 随组件
      // 卸载丢失，重进同一报价时命中此分支会停在 settings=null——保存静默失效、
      // 「恢复默认计价参数」入口消失。此处仅补拉 settings，编辑态仍以 store 为准。
      if (!settings) {
        let cancelled = false;
        settingsApi
          .get()
          .then((s) => {
            if (!cancelled) setSettings(s);
          })
          .catch((e) => {
            if (cancelled) return;
            toast(`加载失败：${e}`);
            navigate('/quotes', { replace: true });
          });
        return () => {
          cancelled = true;
        };
      }
      return;
    }
    let cancelled = false; // M7：竞态守卫——快速切换路由时丢弃迟到响应
    markLoading();
    markLoaded();
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
        // M6：坏 id（已删除/404/500）统一兜底：提示后回列表（终止态），不再无限转圈。
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
    if (!settings) {
      // C-3 伴随提示：settings 补拉窗口内点击保存不再静默无动作
      toast('计价参数加载中，请稍候');
      return;
    }
    // I-6：已转单报价服务端拒绝更新（WHERE status != 'converted'），
    // 前端同步禁保存并明示，不让用户在必败路径上输入
    if (editingStatus === 'converted') {
      toast('该报价已转为订单，不可编辑保存');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await quotesApi.update(editingId, input);
        // I-2：保存不改变 input 引用、effect 不会执行——必须直接定基线
        markSaved();
        clearDirty();
        toast('已保存修改');
      } else {
        const record = await quotesApi.create(input);
        markLoaded();
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
  async function openConvert() {
    setSaving(true);
    let savedId: string | null = null;
    try {
      if (editingId) {
        await quotesApi.update(editingId, input);
        savedId = editingId;
      } else {
        const record = await quotesApi.create(input);
        savedId = record.id;
        markLoaded();
        loadFromRecord(record.input, record.id, record.status);
        navigate(`/quotes/${record.id}`, { replace: true });
      }
      markSaved();
      clearDirty();
    } catch (e) {
      toast(`保存失败：${e}`);
    } finally {
      setSaving(false);
    }
    if (savedId) convert.start({ id: savedId, input });
  }

  const statusLabel = editingStatus === 'converted';

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
            {editingId && !statusLabel && (
              <p className="hidden text-xs text-muted-foreground sm:block">修改后保存将更新此报价</p>
            )}
            {statusLabel && (
              <p className="text-xs text-destructive">该报价已转为订单，内容只读，不可保存</p>
            )}
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
            disabled={saving || convert.converting || statusLabel}
            title={statusLabel ? '该报价已转为订单' : undefined}
          >
            <FilePlus className="h-4 w-4" />
            {statusLabel ? '已转单' : '转订单'}
          </Button>
          <Button
            variant="accent"
            className="hidden lg:inline-flex"
            onClick={handleSave}
            disabled={saving || statusLabel}
            title={statusLabel ? '该报价已转为订单，不可保存' : undefined}
          >
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
          {/* 移动端折叠的 3D 预览 */}
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm font-medium lg:hidden"
            onClick={() => setMobilePreviewOpen((v) => !v)}
          >
            <span className="label-mono text-xs text-muted-foreground">3D 预览 · 可拖拽旋转</span>
            {mobilePreviewOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div
            className={`relative h-[260px] overflow-hidden rounded-lg border bg-[radial-gradient(circle_at_50%_40%,#1E3A5F_0%,#0B1220_100%)] p-2 lg:block lg:h-[340px] ${
              mobilePreviewOpen ? 'block' : 'hidden'
            }`}
          >
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

      {/* 转订单确认弹窗（列表/编辑器共用） */}
      <ConvertQuoteDialog
        target={convert.target}
        form={convert.form}
        setForm={convert.setForm}
        preparing={saving}
        converting={convert.converting}
        onSubmit={convert.submit}
        onClose={convert.close}
      />

      {/* 移动端底部常驻价格条 */}
      <QuoteMobilePriceBar onSave={handleSave} saving={saving} converted={statusLabel} />
    </div>
  );
}

/** 报价页移动端价格条内容：实时最终报价 + 总成本提示 */
function QuoteMobilePriceBar({
  onSave,
  saving,
  converted,
}: {
  onSave: () => void;
  saving: boolean;
  converted?: boolean;
}) {
  const input = useQuoteStore((s) => s.input);
  const result = useMemo(() => calcQuote(input), [input]);
  return (
    <PriceActionBar
      value={result.finalPrice}
      label="最终报价"
      hint={`总成本 ${formatMoney(result.breakdown.totalCost)} · 毛利率 ${result.profitRatePct}%`}
      danger={result.expectedProfit < 0}
      onSave={onSave}
      saving={saving}
      disabled={converted}
    />
  );
}
