/**
 * 订单列表页。
 * PC：表格（整行点击进详情）；移动端：卡片列表。
 * v2：搜索工具条、利润口径标注（预估/实际）、待生产→开工与已发货→签收的行内快捷流转。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Package, ChevronRight, Factory, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ListToolbar } from '@/components/ui/list-toolbar';
import { ordersApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { confirmDialog } from '@/components/confirm-dialog';
import { LoadingState, EmptyState } from '@/components/states';
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE } from '@/lib/status';
import { formatMoney, formatShortDateTime, profitColor, cn } from '@/lib/utils';
import type { OrderRecord, OrderStatus } from '@idle-fish/shared';

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
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // M7：竞态守卫——快速切换筛选时丢弃迟到响应，避免旧筛选结果覆盖新列表
  const reqSeq = useRef(0);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖刻意为 filter：筛选变化即重查
  }, [filter]);

  async function refresh() {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const list = await ordersApi.list(filter === 'all' ? undefined : filter);
      if (seq !== reqSeq.current) return;
      setRecords(list);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      toast(`加载失败：${e}`);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }

  // 搜索：编号 / 客户名 / 尺寸
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const size = `${r.size.width}×${r.size.depth}×${r.size.height}`;
      return (
        r.orderNo.toLowerCase().includes(q) ||
        (r.customer.name || '').toLowerCase().includes(q) ||
        size.includes(q)
      );
    });
  }, [records, query]);

  /** 行内快捷流转：仅无副作用的单向推进（发货需填单仍进详情） */
  async function quickTransition(r: OrderRecord, next: OrderStatus) {
    try {
      await ordersApi.setStatus(r.id, next);
      toast(`状态已更新：${ORDER_STATUS_LABEL[next]}`);
      refresh();
    } catch (e) {
      toast(`操作失败：${e}`);
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
      <PageHeader
        eyebrow="ORDERS · 订单"
        title="订单管理"
        description="待生产 → 生产中 → 待发货 → 已发货 → 已完成"
        actions={
          <Button variant="accent" onClick={() => navigate('/orders/new')}>
            <Plus className="h-4 w-4" />
            新建订单
          </Button>
        }
      />

      <ListToolbar
        filters={FILTERS}
        active={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="搜编号 / 客户 / 尺寸"
        resultLabel={visible.length > 0 ? `${visible.length} 单` : undefined}
      />

      {loading ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <Card className="border-dashed">
          {query ? (
            <EmptyState icon={Package} text={`没有匹配「${query}」的订单`} hint="换个关键词试试，或清空搜索查看全部" />
          ) : (
            <EmptyState
              icon={Package}
              text="暂无订单"
              hint="从报价一键转单，或手动新建订单"
              actionLabel="新建订单"
              onAction={() => navigate('/orders/new')}
            />
          )}
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
                  <th className="label-mono px-4 py-3 text-right font-medium" title="已发货/已完成显示实际利润，其余为预估利润">
                    利润 <span className="text-[10px] normal-case">(实/预)</span>
                  </th>
                  <th className="label-mono px-4 py-3 text-left font-medium">状态</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">下单时间</th>
                  <th className="label-mono px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const actual = r.status === 'shipped' || r.status === 'done';
                  const profit = r.shipping?.actualProfit ?? r.finance.estimatedProfit;
                  return (
                    <tr
                      key={r.id}
                      className="group/row cursor-pointer border-b last:border-0 hover:bg-secondary/50"
                      onClick={() => navigate(`/orders/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-mono-display text-[13px] font-semibold">
                        <span className="inline-flex items-center gap-1">
                          {r.orderNo}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
                        </span>
                      </td>
                      <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{r.customer.name || '—'}</td>
                      <td className="px-4 py-3 font-mono-display text-muted-foreground">
                        {r.size.width}×{r.size.depth}×{r.size.height}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-display text-[13px] font-bold tabular">
                        {formatMoney(r.finance.actualPrice)}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono-display text-[13px] font-semibold', profitColor(profit))}>
                        <span
                          title={actual ? '实际利润（含发货运费）' : '预估利润（按预估成本计算）'}
                          className="inline-flex items-center justify-end gap-1"
                        >
                          {!actual && <span className="text-[10px] font-normal text-muted-foreground/70">预</span>}
                          {formatMoney(profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ORDER_STATUS_BADGE[r.status]}>
                          {ORDER_STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono-display text-xs text-muted-foreground">
                        {formatShortDateTime(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {r.status === 'pending' && (
                            <Button variant="ghost" size="icon" title="开始生产" onClick={() => quickTransition(r, 'producing')}>
                              <Factory className="h-4 w-4 text-accent" />
                            </Button>
                          )}
                          {r.status === 'shipped' && (
                            <Button variant="ghost" size="icon" title="确认签收" onClick={() => quickTransition(r, 'done')}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            title="删除"
                            onClick={() => handleDelete(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* 移动端：卡片列表 */}
          <div className="space-y-2 lg:hidden">
            {visible.map((r) => {
              const actual = r.status === 'shipped' || r.status === 'done';
              const profit = r.shipping?.actualProfit ?? r.finance.estimatedProfit;
              return (
                <Card
                  key={r.id}
                  className="card-hover cursor-pointer p-3"
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
                      <div className={cn('text-xs font-medium tabular', profitColor(profit))}>
                        {actual ? '实际利润' : '预估利润'} {formatMoney(profit)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{formatShortDateTime(r.createdAt)}</span>
                      {r.status === 'shipped' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            quickTransition(r, 'done');
                          }}
                        >
                          签收
                        </Button>
                      )}
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
