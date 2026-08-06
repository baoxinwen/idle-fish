/**
 * 报价列表页。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, ArrowRight, Trash2, FileText, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { quotesApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { confirmDialog } from '@/components/confirm-dialog';
import { LoadingState, EmptyState } from '@/components/states';
import { ExportDialog } from '@/components/export/export-dialog';
import { QUOTE_STATUS_LABEL, QUOTE_STATUS_BADGE, COLOR_LABEL } from '@/lib/status';
import { cn, formatMoney, formatDateTime } from '@/lib/utils';
import type { QuoteRecord, QuoteStatus } from '@idlefish/shared';

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
  const [loading, setLoading] = useState(true);
  const [exportQuote, setExportQuote] = useState<QuoteRecord | null>(null);

  useEffect(() => {
    refresh();
  }, [filter]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await quotesApi.list(filter === 'all' ? undefined : filter);
      setRecords(list);
    } catch (e) {
      toast(`加载失败：${e}`);
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-mono text-accent">QUOTES · 报价</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">报价管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">新建报价、查看历史、转订单</p>
        </div>
        <Button variant="accent" onClick={() => navigate('/quotes/new')}>
          <Plus className="h-4 w-4" />
          新建报价
        </Button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(f.key)}
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
            icon={FileText}
            text="暂无报价记录"
            hint="新建第一条报价，输入机柜尺寸即可实时算价"
            actionLabel="新建报价"
            onAction={() => navigate('/quotes/new')}
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-primary text-primary-foreground">
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
              {records.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-3 font-mono-display text-[13px] font-semibold">{r.quoteNo}</td>
                  <td className="px-4 py-3 font-mono-display text-muted-foreground">
                    {r.input.size.width}×{r.input.size.depth}×{r.input.size.height}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{COLOR_LABEL[r.input.color]}</td>
                  <td className="px-4 py-3 text-right font-mono-display text-[13px] font-semibold">
                    {formatMoney(r.result.finalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={QUOTE_STATUS_BADGE[r.status]}>
                      {QUOTE_STATUS_LABEL[r.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono-display text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/quotes/${r.id}`)} title="查看/编辑">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExportQuote(r)}
                        title="导出"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(r.status === 'converted' && 'opacity-40')}
                        disabled={r.status === 'converted'}
                        onClick={() => navigate(`/orders/new?fromQuote=${r.id}`)}
                        title="转为订单"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(r.id)}
                        title="删除"
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
      )}

      <ExportDialog open={exportQuote !== null} onClose={() => setExportQuote(null)} quote={exportQuote} />
    </div>
  );
}
