/**
 * 经营统计看板。
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from './stat-card';
import { statsApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { ORDER_STATUS_LABEL, ORDER_STATUS_BADGE, QUOTE_STATUS_LABEL } from '@/lib/status';
import { formatMoney } from '@/lib/utils';
import type { StatsData, StatsRange } from '@idlefish/shared';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { FileText, Package, DollarSign, Target } from 'lucide-react';

const RANGES: { key: StatsRange; label: string }[] = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: '90d', label: '近 90 天' },
  { key: 'all', label: '全部' },
];

// 状态色板
const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  producing: '#3b82f6',
  ready: '#f59e0b',
  shipped: '#06b6d4',
  done: '#10b981',
  cancelled: '#ef4444',
};

export function DashboardPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [range, setRange] = useState<StatsRange>('30d');
  const toast = useToast((s) => s.show);

  useEffect(() => {
    statsApi
      .get(range)
      .then(setData)
      .catch((e) => toast(`加载统计失败：${e}`));
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="text-sm text-muted-foreground">加载中…</div>;

  const pieData = data.statusDistribution
    .filter((s) => s.count > 0)
    .map((s) => ({ name: ORDER_STATUS_LABEL[s.status], value: s.count, status: s.status }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-mono text-accent">DASHBOARD · 统计</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">经营统计</h1>
          <p className="mt-1 text-sm text-muted-foreground">报价与订单数据、利润趋势、状态分布</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 指标卡 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="报价数" value={String(data.quoteCount)} hint={`总金额 ${formatMoney(data.quoteTotalAmount)}`} icon={FileText} />
        <StatCard label="转订单率" value={`${data.conversionRatePct}%`} icon={Target} />
        <StatCard label="订单数" value={String(data.orderCount)} hint={`营收 ${formatMoney(data.orderRevenue)}`} icon={Package} />
        <StatCard
          label="总利润"
          value={formatMoney(data.totalProfit)}
          hint={`平均毛利率 ${data.avgProfitRatePct}%`}
          icon={DollarSign}
          accent={data.totalProfit >= 0 ? 'gold' : 'bad'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 状态分布饼图 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="label-mono font-semibold text-muted-foreground">订单状态分布</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {pieData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 报价+订单数趋势 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="label-mono font-semibold text-muted-foreground">报价与订单趋势</CardTitle></CardHeader>
          <CardContent>
            {data.trend.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="quoteCount" name="报价数" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="orderCount" name="订单数" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 利润趋势 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="label-mono font-semibold text-muted-foreground">利润趋势</CardTitle></CardHeader>
        <CardContent>
          {data.trend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Bar dataKey="profit" name="利润" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 最近列表 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="label-mono font-semibold text-muted-foreground">最近报价</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.recentQuotes.length === 0 ? (
              <div className="px-6 py-4 text-sm text-muted-foreground">暂无</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.recentQuotes.map((q) => (
                    <tr key={q.id} className="border-b last:border-0">
                      <td className="px-4 py-2 tabular font-medium">{q.quoteNo}</td>
                      <td className="px-4 py-2 text-right tabular">{formatMoney(q.finalPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-xs text-muted-foreground">{QUOTE_STATUS_LABEL[q.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="label-mono font-semibold text-muted-foreground">最近订单</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.recentOrders.length === 0 ? (
              <div className="px-6 py-4 text-sm text-muted-foreground">暂无</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="px-4 py-2 tabular font-medium">{o.orderNo}</td>
                      <td className="px-4 py-2 text-muted-foreground">{o.customerName || '—'}</td>
                      <td className="px-4 py-2 text-right tabular">{formatMoney(o.actualPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge variant={ORDER_STATUS_BADGE[o.status]} className="text-[10px]">
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      暂无数据
    </div>
  );
}
