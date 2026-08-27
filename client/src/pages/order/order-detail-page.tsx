/**
 * 订单详情页：完整信息展示 + 状态流转步骤条 + 发货核对。
 * v2：预估/实际财务合并为一张对照表（含差异列）；取消按钮降级靠右；
 *     零数量材料折叠；运单号可复制；来源报价可点击回跳。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Truck,
  XCircle,
  CheckCircle2,
  Factory,
  PackageCheck,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { ordersApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { LoadingState, EmptyState } from '@/components/states';
import { confirmDialog } from '@/components/confirm-dialog';
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE, CATEGORY_LABEL } from '@/lib/status';
import { formatMoney, formatShortDateTime, cn, profitColor } from '@/lib/utils';
import { copyText } from '@/lib/clipboard';
import type { OrderRecord, OrderStatus } from '@idlefish/shared';

/** 各状态可执行的动作 */
const ACTIONS: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus; icon: typeof Factory; variant: 'default' | 'outline' | 'destructive' }[]>
> = {
  pending: [{ label: '开始生产', next: 'producing', icon: Factory, variant: 'default' }],
  producing: [{ label: '完成生产', next: 'ready', icon: Factory, variant: 'default' }],
  ready: [{ label: '确认发货', next: 'shipped', icon: Truck, variant: 'default' }],
  shipped: [{ label: '确认签收', next: 'done', icon: CheckCircle2, variant: 'default' }],
  done: [],
  cancelled: [],
};

/** 状态流转步骤（取消态单独处理）。标签复用 lib/status 的 ORDER_STATUS_LABEL（F-08 去重） */
const FLOW: OrderStatus[] = ['pending', 'producing', 'ready', 'shipped', 'done'];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [record, setRecord] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ courier: '', trackingNo: '', actualFreight: 0, checkRemark: '' });
  // 零数量材料默认折叠
  const [showZeroMaterials, setShowZeroMaterials] = useState(false);

  // M7：竞态守卫——路由复用同一元素切换 id 时，丢弃迟到响应，避免 A 的数据覆盖 B
  const reqSeq = useRef(0);

  useEffect(() => {
    if (id) refresh();
  }, [id]);

  async function refresh() {
    if (!id) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const r = await ordersApi.get(id);
      if (seq !== reqSeq.current) return;
      setRecord(r);
      setShowZeroMaterials(false);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      toast(`加载失败：${e}`);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }

  async function handleTransition(next: OrderStatus) {
    if (!id) return;
    if (next === 'cancelled' && !(await confirmDialog({ message: '确认取消该订单？', confirmLabel: '取消订单', variant: 'destructive' }))) return;
    try {
      await ordersApi.setStatus(id, next);
      toast(`状态已更新：${ORDER_STATUS_LABEL[next]}`);
      refresh();
    } catch (e) {
      toast(`操作失败：${e}`);
    }
  }

  async function handleShip() {
    if (!id) return;
    if (!shipForm.courier || !shipForm.trackingNo) {
      toast('请填写快递公司和运单号');
      return;
    }
    try {
      await ordersApi.ship(id, {
        courier: shipForm.courier,
        trackingNo: shipForm.trackingNo,
        actualFreight: shipForm.actualFreight,
        checkRemark: shipForm.checkRemark,
      });
      toast('已确认发货');
      setShipOpen(false);
      setShipForm({ courier: '', trackingNo: '', actualFreight: 0, checkRemark: '' });
      refresh();
    } catch (e) {
      toast(`发货失败：${e}`);
    }
  }

  async function handleCopyTracking(text: string) {
    const ok = await copyText(text);
    toast(ok ? '已复制运单号' : '复制失败');
  }

  if (loading) return <LoadingState />;
  if (!id || !record) return <EmptyState text="订单不存在" />;

  const actions = ACTIONS[record.status] ?? [];
  const canEdit = record.status === 'pending' || record.status === 'producing' || record.status === 'ready';
  const currentStep = FLOW.indexOf(record.status);
  const cancelAction = record.status !== 'done' && record.status !== 'cancelled';

  const materials = record.materials;
  const activeMaterials = materials.filter((m) => m.quantity > 0);
  const zeroMaterials = materials.filter((m) => m.quantity === 0);

  /** 财务对照：实际列仅发货后有值 */
  const ship = record.shipping;
  const fin = record.finance;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="label-mono text-[10px] text-accent">ORDER · 订单</div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tabular">{record.orderNo}</h1>
              <Badge variant={ORDER_STATUS_BADGE[record.status]}>
                {ORDER_STATUS_LABEL[record.status]}
              </Badge>
            </div>
            {record.quoteId && (
              <Link
                to={`/quotes/${record.quoteId}`}
                className="mt-0.5 inline-block text-xs text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
              >
                由报价转入 ↗
              </Link>
            )}
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" className="shrink-0" onClick={() => navigate(`/orders/${record.id}/edit`)}>
            <Pencil className="h-4 w-4" />
            编辑
          </Button>
        )}
      </div>

      {/* 状态流转步骤条 */}
      <Card>
        <CardContent className="pt-6">
          {record.status === 'cancelled' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              该订单已取消
            </div>
          ) : (
            <>
              {/* PC：横向步骤条 */}
              <div className="hidden items-center sm:flex">
                {FLOW.map((s, i) => {
                  const done = i < currentStep;
                  const active = i === currentStep;
                  return (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors',
                            active && 'bg-accent text-accent-foreground ring-2 ring-accent/30 ring-offset-2 ring-offset-card',
                            done && 'bg-accent/20 text-accent',
                            !active && !done && 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className={cn('text-[10px] whitespace-nowrap', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                          {ORDER_STATUS_LABEL[s]}
                        </span>
                      </div>
                      {i < FLOW.length - 1 && (
                        <div className={cn('mx-1 h-0.5 flex-1 rounded', i < currentStep ? 'bg-accent' : 'bg-secondary')} />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* 移动端：紧凑进度提示 */}
              <div className="flex items-center gap-2 sm:hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground ring-2 ring-accent/30">
                  {currentStep + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{ORDER_STATUS_LABEL[record.status]}</div>
                  <div className="text-xs text-muted-foreground">第 {currentStep + 1}/{FLOW.length} 步 · {ORDER_STATUS_LABEL[FLOW[currentStep + 1] ?? FLOW[currentStep]]}</div>
                </div>
                <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((currentStep + 1) / FLOW.length) * 100}%` }} />
                </div>
              </div>
            </>
          )}
          {/* 操作区：主操作居左，取消这类破坏性动作降级为 outline 并靠右，避免误触 */}
          {(actions.length > 0 || cancelAction) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              {actions.map((a) => {
                const Icon = a.icon;
                const isShip = a.next === 'shipped';
                return (
                  <Button
                    key={a.next}
                    variant={a.variant}
                    onClick={() => (isShip ? setShipOpen(true) : handleTransition(a.next))}
                  >
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </Button>
                );
              })}
              {cancelAction && (
                <Button
                  variant="outline"
                  className="ml-auto border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => handleTransition('cancelled')}
                >
                  <XCircle className="h-4 w-4" />
                  取消订单
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 客户与收货 */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">客户与收货</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="客户名称" value={record.customer.name} />
            <InfoRow label="平台订单号" value={record.customer.platformOrderNo || '—'} />
            <InfoRow label="收件人" value={record.shippingAddress.receiver || '—'} />
            <InfoRow label="电话" value={record.shippingAddress.phone || '—'} />
            <InfoRow label="收货地址" value={record.shippingAddress.address || '—'} />
          </CardContent>
        </Card>

        {/* 机柜与材料 */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">机柜与材料</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow
              label="尺寸"
              value={`${record.size.width}×${record.size.depth}×${record.size.height} mm`}
            />
            <div>
              <div className="mb-1 text-muted-foreground">材料清单</div>
              {materials.length === 0 ? (
                <div className="text-muted-foreground">无</div>
              ) : (
                <div className="space-y-1">
                  {activeMaterials.map((m, i) => (
                    <MaterialLine key={i} m={m} />
                  ))}
                  {zeroMaterials.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowZeroMaterials((v) => !v)}
                        className="flex w-full items-center gap-1 rounded py-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {showZeroMaterials ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        未选用配件 {zeroMaterials.length} 项（数量为 0）
                      </button>
                      {showZeroMaterials && (
                        <div className="space-y-1 opacity-60">
                          {zeroMaterials.map((m, i) => (
                            <MaterialLine key={`z-${i}`} m={m} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 财务对照卡：预估 | 实际 | 差异 一眼可比（此前分两卡需左右横跳） */}
        <Card className="relative overflow-hidden lg:col-span-2">
          <span className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-accent" />
          <CardHeader className="pb-3">
            <CardTitle className="label-mono flex items-center gap-2 pl-3 text-xs font-semibold text-muted-foreground">
              <PackageCheck className="h-4 w-4" />
              财务对照
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-3">
            {!ship ? (
              <>
                <CompareTableHead actual={false} />
                <CompareRow label="材料成本" estimated={formatMoney(fin.materialCost)} muted />
                <CompareRow label="安装费" estimated={formatMoney(fin.installFee)} muted />
                <CompareRow label="运费（预估）" estimated={formatMoney(fin.freight)} muted />
                <CompareRow label="成本合计" estimated={formatMoney(fin.estimatedCost)} bold />
                <CompareRow
                  label="预估利润"
                  estimated={formatMoney(fin.estimatedProfit)}
                  valueClass={profitColor(fin.estimatedProfit)}
                  bold
                />
                <CompareRow label="预估毛利率" estimated={`${fin.estimatedProfitRatePct}%`} />
                <p className="mt-2 text-xs text-muted-foreground">未发货——确认发货并填写实际运费后，将在此展示实际成本、利润与差异。</p>
              </>
            ) : (
              <>
                <CompareTableHead actual />
                <CompareRow
                  label="材料成本 + 安装费"
                  estimated={formatMoney(fin.materialCost + fin.installFee)}
                  actual={formatMoney(fin.materialCost + fin.installFee)}
                />
                <CompareRow
                  label="运费"
                  estimated={formatMoney(fin.freight)}
                  actual={formatMoney(ship.actualFreight)}
                  diff={ship.actualFreight - fin.freight}
                  inverseDiff
                />
                <CompareRow
                  label="成本合计"
                  estimated={formatMoney(fin.estimatedCost)}
                  actual={formatMoney(ship.actualCost)}
                  diff={ship.actualCost - fin.estimatedCost}
                  inverseDiff
                  bold
                />
                <CompareRow
                  label="利润"
                  estimated={formatMoney(fin.estimatedProfit)}
                  actual={formatMoney(ship.actualProfit)}
                  diff={ship.actualProfit - fin.estimatedProfit}
                  valueClassOverride={{ estimated: undefined, actual: profitColor(ship.actualProfit), diff: profitColor(ship.actualProfit - fin.estimatedProfit) }}
                  bold
                />
                <CompareRow
                  label="毛利率"
                  estimated={`${fin.estimatedProfitRatePct}%`}
                  actual={
                    <span className={ship.actualProfit >= 0 ? '' : 'text-destructive'}>
                      {ship.actualProfitRatePct}%
                    </span>
                  }
                  diff={Number((ship.actualProfitRatePct - fin.estimatedProfitRatePct).toFixed(1))}
                  isPercent
                />
                <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                  <InfoRow
                    label="快递"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        {ship.courier} · {ship.trackingNo}
                        <button
                          type="button"
                          title="复制运单号"
                          aria-label="复制运单号"
                          onClick={() => handleCopyTracking(ship.trackingNo)}
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    }
                  />
                  {ship.checkRemark && <InfoRow label="核对备注" value={ship.checkRemark} />}
                  <InfoRow label="确认时间" value={formatShortDateTime(ship.confirmedAt)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {record.remark && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">备注</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{record.remark}</CardContent>
        </Card>
      )}

      {/* 发货核对弹窗 */}
      <Modal open={shipOpen} onClose={() => setShipOpen(false)} title="确认发货">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>快递公司</Label>
            <Input
              value={shipForm.courier}
              onChange={(e) => setShipForm((f) => ({ ...f, courier: e.target.value }))}
              placeholder="如顺丰、中通"
            />
          </div>
          <div className="space-y-1.5">
            <Label>运单号</Label>
            <Input
              value={shipForm.trackingNo}
              onChange={(e) => setShipForm((f) => ({ ...f, trackingNo: e.target.value }))}
              placeholder="快递运单号"
            />
          </div>
          <NumberField
            label="实际运费"
            value={shipForm.actualFreight}
            onChange={(v) => setShipForm((f) => ({ ...f, actualFreight: v }))}
            step={0.01}
            suffix="元"
            displayDecimals={2}
          />
          <div className="space-y-1.5">
            <Label>核对备注</Label>
            <Input
              value={shipForm.checkRemark}
              onChange={(e) => setShipForm((f) => ({ ...f, checkRemark: e.target.value }))}
              placeholder="发货核对说明"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShipOpen(false)}>取消</Button>
            <Button variant="accent" onClick={handleShip}>
              <Truck className="h-4 w-4" />
              确认发货
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MaterialLine({ m }: { m: { category: keyof typeof CATEGORY_LABEL; name: string; quantity: number; unitPrice: number } }) {
  return (
    <div className="flex justify-between tabular">
      <span>
        <span className="text-xs text-muted-foreground">[{CATEGORY_LABEL[m.category]}]</span> {m.name}
      </span>
      <span className="text-muted-foreground">
        {m.quantity} × {formatMoney(m.unitPrice)}
      </span>
    </div>
  );
}

function CompareTableHead({ actual }: { actual: boolean }) {
  return (
    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_88px_88px_72px] items-center gap-2 border-b border-border pb-1 text-[10px] text-muted-foreground label-mono sm:grid-cols-[minmax(0,1fr)_110px_110px_90px]">
      <div>项目</div>
      <div className="text-right">预估</div>
      <div className="text-right">{actual ? '实际' : '实际'}</div>
      <div className="text-right">{actual ? '差异' : ''}</div>
    </div>
  );
}

function CompareRow({
  label,
  estimated,
  actual,
  diff,
  bold,
  muted,
  valueClass,
  valueClassOverride,
  inverseDiff,
  isPercent,
}: {
  label: string;
  estimated: React.ReactNode;
  /** 未发货时省略即显示 — */
  actual?: React.ReactNode;
  diff?: number;
  bold?: boolean;
  muted?: boolean;
  /** 统一的文本色（默认前景色） */
  valueClass?: string;
  /** 分别覆盖 预估/实际/差异 三格配色 */
  valueClassOverride?: { estimated?: string; actual?: string; diff?: string };
  /** 成本类指标：差异 >0 为坏（红）；利润类反之。默认利好绿 */
  inverseDiff?: boolean;
  isPercent?: boolean;
}) {
  const weight = bold ? 'font-semibold' : muted ? 'font-normal text-muted-foreground' : '';
  let diffNode: React.ReactNode = null;
  if (diff !== undefined && Number.isFinite(diff)) {
    const good = inverseDiff ? diff <= 0 : diff >= 0;
    const sign = diff > 0 ? '+' : '';
    diffNode = (
      <span className={cn('tabular', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
        {isPercent ? `${sign}${diff}pp` : `${sign}${formatMoney(diff)}`}
      </span>
    );
  } else if (diff === undefined) {
    diffNode = <span className="text-muted-foreground/40">—</span>;
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_72px] items-center gap-2 border-b border-border/50 py-1.5 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_110px_110px_90px]">
      <span className={cn('text-muted-foreground', bold && 'font-medium text-foreground')}>{label}</span>
      <span className={cn('text-right tabular', weight, valueClass ?? '', valueClassOverride?.estimated)}>{estimated}</span>
      <span className={cn('text-right tabular', weight, actual == null ? 'text-muted-foreground/40' : '', valueClass ?? '', valueClassOverride?.actual)}>
        {actual == null ? '—' : actual}
      </span>
      <span className="text-right text-xs">{diffNode}</span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  accent?: 'good' | 'bad';
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular text-right',
          bold && 'font-semibold',
          accent === 'good' && 'text-emerald-600 dark:text-emerald-400',
          accent === 'bad' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}
