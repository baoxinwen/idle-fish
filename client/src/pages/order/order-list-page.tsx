/**
 * 订单列表页。
 * PC：表格（整行点击进详情）；移动端：卡片列表。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Package, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ordersApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { confirmDialog } from '@/components/confirm-dialog';
import { LoadingState, EmptyState } from '@/components/states';
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE } from '@/lib/status';
import { formatMoney, formatDateTime, cn } from '@/lib/utils';
import type { OrderRecord, OrderStatus } from '@idlefish/shared';

const FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待生产' },
  { key: 'producing', label: '生产中' },
  { key: 'ready', label: '待发货' },
  { key: 'shipped', label: '已发货' },
  { key: 'done', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
];

export function OrderListPage() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [records, setRecords] = useState<OrderRecord[]>([]);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() {
    setLoading(true);
    try {
      const list = await ordersApi.list(filter === 'all' ? undefined : filter);
      setRecords(list);
    } catch (e) {
      toast(`加载失败：${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ message: '确认删除该订单？', confirmLabel: '删除', variant: 'destructive' }))) return;
    try {
      await ordersApi.remove(id);
      toast('已删除');
      refresh();
    } catch (e) {
      toast(`删除失败：${e}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="label-mono text-accent">ORDERS · 订单</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">订单管理</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">待生产 → 生产中 → 待发货 → 已发货 → 已完成</p>
        </div>
        <Button variant="accent" className="shrink-0" onClick={() => navigate('/orders/new')}>
          <Plus className="h-4 w-4" />
          新建订单
        </Button>
      </div>

      {/* 筛选条：横滚模式（与 dashboard 一致） */}
      <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(f.key)}
            className="shrink-0"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : records.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Package}
            text="暂无订单"
            hint="从报价一键转单，或手动新建订单"
            actionLabel="新建订单"
            onAction={() => navigate('/orders/new')}
          />
        </Card>
      ) : (
        <>
          {/* PC：表格（整行点击进详情） */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="label-mono px-4 py-3 text-left font-medium">订单编号</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">客户</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">尺寸</th>
                  <th className="label-mono px-4 py-3 text-right font-medium">售价</th>
                  <th className="label-mono px-4 py-3 text-right font-medium">利润</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">状态</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">下单时间</th>
                  <th className="label-mono px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const profit = r.shipping?.actualProfit ?? r.finance.estimatedProfit;
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-secondary/50"
                      onClick={() => navigate(`/orders/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-mono-display text-[13px] font-semibold">{r.orderNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.customer.name || '—'}</td>
                      <td className="px-4 py-3 font-mono-display text-muted-foreground">
                        {r.size.width}×{r.size.depth}×{r.size.height}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-display text-[13px] font-semibold">
                        {formatMoney(r.finance.actualPrice)}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono-display text-[13px] font-semibold', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                        {formatMoney(profit)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ORDER_STATUS_BADGE[r.status]}>
                          {ORDER_STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono-display text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(r.id)}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* 移动端：卡片列表 */}
          <div className="space-y-2 lg:hidden">
            {records.map((r) => {
              const profit = r.shipping?.actualProfit ?? r.finance.estimatedProfit;
              return (
                <Card
                  key={r.id}
                  className="cursor-pointer p-3 transition-colors hover:bg-secondary/30"
                  onClick={() => navigate(`/orders/${r.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-display text-[13px] font-semibold">{r.orderNo}</span>
                    <Badge variant={ORDER_STATUS_BADGE[r.status]} className="text-[10px]">
                      {ORDER_STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{r.customer.name || '—'}</span>
                    <span className="ml-2 shrink-0 font-mono-display">
                      {r.size.width}×{r.size.depth}×{r.size.height}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <div className="font-mono-display text-base font-bold">{formatMoney(r.finance.actualPrice)}</div>
                      <div className={cn('text-xs font-medium tabular', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                        利润 {formatMoney(profit)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(r.createdAt).slice(5, 16)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
