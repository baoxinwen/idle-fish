/**
 * 报价列表页。
 * PC：表格（整行点击进详情）；移动端：卡片列表。
 * 顶部汇总条 + 搜索 + 行内转单（共用 use-convert-quote 弹窗）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Trash2, FileText, ChevronRight, FilePlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ListToolbar } from '@/components/ui/list-toolbar';
import { quotesApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { confirmDialog } from '@/components/confirm-dialog';
import { LoadingState, EmptyState } from '@/components/states';
import { ExportDialog } from '@/components/export/export-dialog';
import { ConvertQuoteDialog, useConvertQuote } from '@/components/quote-form/convert-dialog';
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_BADGE, COLOR_LABEL } from '@/lib/status';
import { cn, formatMoney, formatShortDateTime } from '@/lib/utils';
import type { QuoteRecord, QuoteStatus } from '@idle-fish/shared';

const FILTERS: { key: 'all' | QuoteStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'quoted', label: '已报价' },
  { key: 'converted', label: '已转单' },
];

export function QuoteListPage() {
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [records, setRecords] = useState<QuoteRecord[]>([]);
  const [filter, setFilter] = useState<'all' | QuoteStatus>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportQuote, setExportQuote] = useState<QuoteRecord | null>(null);
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
      const list = await quotesApi.list(filter === 'all' ? undefined : filter);
      if (seq !== reqSeq.current) return;
      setRecords(list);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      toast(`加载失败：${e}`);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }

  // 搜索：编号 / 尺寸 / 颜色子串匹配，纯前端过滤（单用户数据量级内最直接）
  const visible = useMemo(() => {
    const q = query.trim();
    if (!q) return records;
    return records.filter((r) => {
      const size = `${r.input.size.width}×${r.input.size.depth}×${r.input.size.height}`;
      return (
        r.quoteNo.toLowerCase().includes(q.toLowerCase()) ||
        size.includes(q) ||
        COLOR_LABEL[r.input.color].includes(q)
      );
    });
  }, [records, query]);

  // 汇总条口径跟随当前筛选+搜索结果
  const summary = useMemo(() => {
    const total = visible.reduce((s, r) => s + r.result.finalPrice, 0);
    const converted = visible.filter((r) => r.status === 'converted').length;
    return { count: visible.length, total, converted };
  }, [visible]);

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ message: '确认删除该报价？', confirmLabel: '删除', variant: 'destructive' }))) return;
    try {
      await quotesApi.remove(id);
      toast('已删除');
      refresh();
    } catch (e) {
      toast(`删除失败：${e}`);
    }
  }

  const convert = useConvertQuote((orderId, orderNo) => {
    toast(`已转单：${orderNo}`);
    navigate(`/orders/${orderId}`);
    refresh(); // 报价状态已在后端变更，回来时对齐
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="QUOTES · 报价"
        title="报价管理"
        description="新建报价、查看历史、一键转订单"
        actions={
          <Button variant="accent" onClick={() => navigate('/quotes/new')}>
            <Plus className="h-4 w-4" />
            新建报价
          </Button>
        }
      />

      {/* 汇总条：跟随当前筛选与搜索结果 */}
      {!loading && visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-card px-4 py-2.5">
          <span className="text-sm text-muted-foreground">
            共 <span className="font-mono-display font-semibold text-foreground">{summary.count}</span> 笔
          </span>
          <span className="text-sm text-muted-foreground">
            合计{' '}
            <span className="font-mono-display text-sm font-semibold text-accent">
              {formatMoney(summary.total)}
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            已转单 <span className="font-mono-display font-semibold text-foreground">{summary.converted}</span> 笔
          </span>
        </div>
      )}

      <ListToolbar
        filters={FILTERS}
        active={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="搜编号 / 尺寸 / 颜色"
      />

      {loading ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <Card className="border-dashed">
          {query ? (
            <EmptyState icon={FileText} text={`没有匹配「${query}」的报价`} hint="换个关键词试试，或清空搜索查看全部" />
          ) : (
            <EmptyState
              icon={FileText}
              text="暂无报价记录"
              hint="新建第一条报价，输入机柜尺寸即可实时算价"
              actionLabel="新建报价"
              onAction={() => navigate('/quotes/new')}
            />
          )}
        </Card>
      ) : (
        <>
          {/* PC：表格（整行点击） */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="label-mono px-4 py-3 text-left font-medium">报价编号</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">尺寸</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">颜色</th>
                  <th className="label-mono px-4 py-3 text-right font-medium">金额</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">状态</th>
                  <th className="label-mono px-4 py-3 text-left font-medium">时间</th>
                  <th className="label-mono px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    className="group/row cursor-pointer border-b last:border-0 hover:bg-secondary/50"
                    onClick={() => navigate(`/quotes/${r.id}`)}
                  >
                    <td className="px-4 py-3 font-mono-display text-[13px] font-semibold">
                      <span className="inline-flex items-center gap-1">
                        {r.quoteNo}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-display text-muted-foreground">
                      {r.input.size.width}×{r.input.size.depth}×{r.input.size.height}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{COLOR_LABEL[r.input.color]}</td>
                    <td className="px-4 py-3 text-right font-mono-display text-[13px] font-bold tabular">
                      {formatMoney(r.result.finalPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={QUOTE_STATUS_BADGE[r.status]}>
                        {QUOTE_STATUS_LABEL[r.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono-display text-xs text-muted-foreground">
                      {formatShortDateTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={r.status === 'converted'}
                          title={r.status === 'converted' ? '已转为订单' : '转为订单'}
                          onClick={() => convert.start(r)}
                        >
                          <FilePlus className={cn('h-4 w-4', r.status !== 'converted' && 'text-accent')} />
                        </Button>
                        <Button variant="ghost" size="icon" title="导出" onClick={() => setExportQuote(r)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn('text-muted-foreground hover:text-destructive', r.status === 'converted' && 'opacity-40')}
                          disabled={r.status === 'converted'}
                          title="删除"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 移动端：卡片列表 */}
          <div className="space-y-2 lg:hidden">
            {visible.map((r) => (
              <Card
                key={r.id}
                className="card-hover cursor-pointer p-3"
                onClick={() => navigate(`/quotes/${r.id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-display text-[13px] font-semibold">{r.quoteNo}</span>
                  <Badge variant={QUOTE_STATUS_BADGE[r.status]} className="text-[10px]">
                    {QUOTE_STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{COLOR_LABEL[r.input.color]}</span>
                  <span className="font-mono-display">
                    {r.input.size.width}×{r.input.size.depth}×{r.input.size.height}
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div className="font-mono-display text-base font-bold">{formatMoney(r.result.finalPrice)}</div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={r.status === 'converted'}
                      title={r.status === 'converted' ? '已转为订单' : '转为订单'}
                      onClick={(e) => {
                        e.stopPropagation();
                        convert.start(r);
                      }}
                    >
                      <FilePlus className="h-3.5 w-3.5 text-accent" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="导出"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExportQuote(r);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="ml-0.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ExportDialog open={exportQuote !== null} onClose={() => setExportQuote(null)} quote={exportQuote} />
      <ConvertQuoteDialog
        target={convert.target}
        form={convert.form}
        setForm={convert.setForm}
        converting={convert.converting}
        onSubmit={convert.submit}
        onClose={convert.close}
      />
    </div>
  );
}
