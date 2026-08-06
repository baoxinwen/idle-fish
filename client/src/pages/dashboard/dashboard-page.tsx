/**
 * 经营统计看板。
 * 图表色板基于主题（墨蓝/暖金/石板灰），Tooltip/Legend 自定义样式适配深色模式。
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/states';
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { FileText, Package, DollarSign, Target, BarChart3 } from 'lucide-react';
const RANGES: { key: StatsRange; label: string }[] = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: '90d', label: '近 90 天' },
  { key: 'all', label: '全部' },
];

// 主题图表色板（与 globals.css 工程蓝图风协调，低饱和度）
const CHART = {
  blue: '#1E3A5F', // 墨蓝 - 报价
  gold: '#C9A961', // 暖金 - 订单/利润
  slate: '#64748B', // 石板灰 - 辅助
};

// 状态色板：从主题派生，降低饱和度
const STATUS_COLORS: Record<string, string> = {
  pending: '#94A3B8', // 灰
  producing: '#1E3A5F', // 墨蓝
  ready: '#C9A961', // 暖金
  shipped: '#0891B2', // 青灰
  done: '#15803D', // 墨绿
  cancelled: '#B91C1C', // 暗红
};

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

/** 自定义 Tooltip：卡片样式适配深色模式 */
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium text-foreground">
            {typeof p.value === 'number' && label?.includes('利润') ? formatMoney(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 日期格式化：7d/30d/90d 显示 MM-DD，all 显示 YYYY-MM */
function formatDate(date: string, range: StatsRange): string {
  if (range === 'all') return date; // 已是 YYYY-MM
  // date 是 YYYY-MM-DD，取 MM-DD
  return date.slice(5);
}

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

  const showDots = range === '7d';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="label-mono text-accent">DASHBOARD · 统计</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">经营统计</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            报价与订单数据、利润趋势、状态分布
          </p>
        </div>
        {/* 区间选择：移动端可横滚 */}
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              variant={range === r.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRange(r.key)}
              className="shrink-0"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 指标卡：移动端 2 列，PC 4 列 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <div className="grid gap-3 lg:grid-cols-3">
        {/* 状态分布饼图 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="label-mono font-semibold text-muted-foreground">订单状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={38} paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status]} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* 状态图例列表（PC + 移动端统一，替代 Recharts Legend） */}
            {pieData.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                {pieData.map((d) => (
                  <div key={d.status} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[d.status] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium tabular">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 报价+订单数趋势 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="label-mono font-semibold text-muted-foreground">报价与订单趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {data.trend.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.trend} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d) => formatDate(d, range)} minTickGap={24} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="quoteCount" name="报价数" stroke={CHART.blue} strokeWidth={2.5} dot={showDots ? { r: 3, fill: CHART.blue } : false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="orderCount" name="订单数" stroke={CHART.gold} strokeWidth={2.5} dot={showDots ? { r: 3, fill: CHART.gold } : false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {/* 趋势图图例（移动端也显示，便于区分两条线） */}
            {data.trend.length > 0 && (
              <div className="mt-1 flex justify-center gap-4">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-3 rounded-full" style={{ background: CHART.blue }} />
                  <span className="text-muted-foreground">报价数</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-3 rounded-full" style={{ background: CHART.gold }} />
                  <span className="text-muted-foreground">订单数</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 利润趋势 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="label-mono font-semibold text-muted-foreground">利润趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.trend} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d) => formatDate(d, range)} minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} width={32} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                <Bar dataKey="profit" name="利润" fill={CHART.gold} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 最近列表：移动端单列，表格可横滚 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="label-mono font-semibold text-muted-foreground">最近报价</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentQuotes.length === 0 ? (
              <div className="px-6 py-4 text-sm text-muted-foreground">暂无</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="label-mono font-semibold text-muted-foreground">最近订单</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentOrders.length === 0 ? (
              <div className="px-6 py-4 text-sm text-muted-foreground">暂无</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <EmptyState icon={BarChart3} text="暂无数据" className="h-[200px] py-0" />;
}
