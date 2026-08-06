/**
 * 订单详情页：完整信息展示 + 状态流转步骤条 + 发货核对。
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Truck, XCircle, CheckCircle2, Factory, PackageCheck } from 'lucide-react';
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
import { formatMoney, formatDateTime, cn } from '@/lib/utils';
import type { OrderRecord, OrderStatus } from '@idlefish/shared';

/** 各状态可执行的动作 */
const ACTIONS: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus; icon: typeof Factory; variant: 'default' | 'outline' | 'destructive' }[]>
> = {
  pending: [
    { label: '开始生产', next: 'producing', icon: Factory, variant: 'default' },
    { label: '取消订单', next: 'cancelled', icon: XCircle, variant: 'destructive' },
  ],
  producing: [
    { label: '完成生产', next: 'ready', icon: Factory, variant: 'default' },
    { label: '取消订单', next: 'cancelled', icon: XCircle, variant: 'destructive' },
  ],
  ready: [
    { label: '确认发货', next: 'shipped', icon: Truck, variant: 'default' },
    { label: '取消订单', next: 'cancelled', icon: XCircle, variant: 'destructive' },
  ],
  shipped: [{ label: '确认签收', next: 'done', icon: CheckCircle2, variant: 'default' }],
  done: [],
  cancelled: [],
};

/** 状态流转步骤（取消态单独处理） */
const FLOW: OrderStatus[] = ['pending', 'producing', 'ready', 'shipped', 'done'];
const FLOW_LABEL: Record<OrderStatus, string> = {
  pending: '待生产',
  producing: '生产中',
  ready: '待发货',
  shipped: '已发货',
  done: '已完成',
  cancelled: '已取消',
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [record, setRecord] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ courier: '', trackingNo: '', actualFreight: 0, checkRemark: '' });

  useEffect(() => {
    if (id) refresh();
  }, [id]);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const r = await ordersApi.get(id);
      setRecord(r);
    } catch (e) {
      toast(`加载失败：${e}`);
    } finally {
      setLoading(false);
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

  if (loading) return <LoadingState />;
  if (!id || !record) return <EmptyState text="订单不存在" />;

  const actions = ACTIONS[record.status] ?? [];
  const canEdit = record.status === 'pending' || record.status === 'producing' || record.status === 'ready';
  const currentStep = FLOW.indexOf(record.status);

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
            {record.quoteId && <p className="text-xs text-muted-foreground">由报价转入</p>}
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
                          {FLOW_LABEL[s]}
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
                  <div className="text-sm font-medium">{FLOW_LABEL[record.status]}</div>
                  <div className="text-xs text-muted-foreground">第 {currentStep + 1}/{FLOW.length} 步 · {FLOW_LABEL[FLOW[currentStep + 1] ?? FLOW[currentStep]]}</div>
                </div>
                {/* 进度条 */}
                <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((currentStep + 1) / FLOW.length) * 100}%` }} />
                </div>
              </div>
            </>
          )}
          {/* 操作按钮 */}
          {actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
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
              {record.materials.length === 0 ? (
                <div className="text-muted-foreground">无</div>
              ) : (
                <div className="space-y-1">
                  {record.materials.map((m, i) => (
                    <div key={i} className="flex justify-between tabular">
                      <span>
                        <span className="text-xs text-muted-foreground">[{CATEGORY_LABEL[m.category]}]</span> {m.name}
                      </span>
                      <span className="text-muted-foreground">
                        {m.quantity} × {formatMoney(m.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 财务（预估）— accent 强调；移动端置顶 */}
        <Card className="relative order-first overflow-hidden lg:order-none">
          <span className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-accent" />
          <CardHeader className="pb-3"><CardTitle className="label-mono text-xs font-semibold text-muted-foreground">财务（预估）</CardTitle></CardHeader>
          <CardContent className="space-y-2 pl-4 text-sm">
            <InfoRow label="材料成本" value={formatMoney(record.finance.materialCost)} />
            <InfoRow label="其他费用" value={formatMoney(record.finance.otherFee)} />
            <InfoRow label="预估成本" value={formatMoney(record.finance.estimatedCost)} />
            <InfoRow label="实际售价" value={formatMoney(record.finance.actualPrice)} bold />
            <InfoRow
              label="预估利润"
              value={formatMoney(record.finance.estimatedProfit)}
              accent={record.finance.estimatedProfit >= 0 ? 'good' : 'bad'}
            />
            <InfoRow label="预估毛利率" value={`${record.finance.estimatedProfitRatePct}%`} />
          </CardContent>
        </Card>

        {/* 发货信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="label-mono flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <PackageCheck className="h-4 w-4" />
              发货与实际财务
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {record.shipping ? (
              <>
                <InfoRow label="快递公司" value={record.shipping.courier} />
                <InfoRow label="运单号" value={record.shipping.trackingNo} />
                <InfoRow label="实际运费" value={formatMoney(record.shipping.actualFreight)} />
                <InfoRow label="核对备注" value={record.shipping.checkRemark || '—'} />
                <InfoRow label="确认时间" value={formatDateTime(record.shipping.confirmedAt)} />
                <div className="my-2 border-t" />
                <InfoRow label="实际成本" value={formatMoney(record.shipping.actualCost)} />
                <InfoRow
                  label="实际利润"
                  value={formatMoney(record.shipping.actualProfit)}
                  accent={record.shipping.actualProfit >= 0 ? 'good' : 'bad'}
                />
                <InfoRow label="实际毛利率" value={`${record.shipping.actualProfitRatePct}%`} />
              </>
            ) : (
              <div className="text-muted-foreground">未发货，发货后显示实际成本与利润</div>
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
            />
          </div>
          <NumberField
            label="实际运费"
            value={shipForm.actualFreight}
            onChange={(v) => setShipForm((f) => ({ ...f, actualFreight: v }))}
            step={0.01}
            suffix="元"
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

function InfoRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
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
