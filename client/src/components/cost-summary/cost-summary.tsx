/**
 * 成本明细 + 实时试算结果。
 */

import { useMemo } from 'react';
import { Copy, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuoteStore } from '@/store/quote-store';
import { useToast } from '@/components/toaster';
import { calcQuote } from '@idlefish/shared';
import { CATEGORY_LABEL } from '@/lib/status';
import { buildCostText, buildMaterialsText, copyText } from '@/lib/clipboard';
import { formatMoney, profitColor, cn } from '@/lib/utils';

export function CostSummary() {
  const input = useQuoteStore((s) => s.input);
  const result = useMemo(() => calcQuote(input), [input]);
  const toast = useToast((s) => s.show);

  async function handleCopyMaterials() {
    const ok = await copyText(buildMaterialsText(input));
    toast(ok ? '已复制材料清单' : '复制失败');
  }

  async function handleCopyCost() {
    const ok = await copyText(buildCostText(result));
    toast(ok ? '已复制成本明细' : '复制失败');
  }

  const b = result.breakdown;
  const negativeProfit = result.expectedProfit < 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">成本明细</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopyMaterials} title="复制材料清单" className="px-2">
            <ClipboardList className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyCost} title="复制成本明细" className="px-2">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label={`铝型材（${b.profile.totalLength}m）`} value={formatMoney(b.profile.cost)} />
        <Row label="切割处理费" value={formatMoney(b.cuttingFee)} />
        {b.accessoryGroups.map((g) => (
          <Row key={g.category} label={`配件·${CATEGORY_LABEL[g.category]}`} value={formatMoney(g.subtotal)} sub={`${g.items.length} 项`} />
        ))}
        <Row label={`托盘（${b.trayCount}个）`} value={formatMoney(b.trayCost)} />
        <Divider />
        <Row label="材料成本" value={formatMoney(b.materialCost)} bold />
        <Row label="安装费" value={b.installFee > 0 ? formatMoney(b.installFee) : '未计入'} muted={!b.installFee} />
        <Row label="运费" value={b.freight > 0 ? formatMoney(b.freight) : '未计入'} muted={!b.freight} />
        <Row label="总成本" value={formatMoney(b.totalCost)} bold />

        {/* 最终报价 + 利润：负利润加警告环 */}
        <div className={cn(
          'mt-4 rounded-lg p-4',
          negativeProfit ? 'bg-destructive/5 ring-1 ring-destructive/30' : 'bg-primary/5',
        )}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="label-mono text-xs text-muted-foreground">最终报价</div>
              <div className="tabular text-2xl font-bold text-accent sm:text-3xl">{formatMoney(result.finalPrice)}</div>
            </div>
            <div className="text-left sm:text-right">
              <div className="label-mono text-xs text-muted-foreground">预计利润</div>
              <div className={cn('tabular text-lg font-semibold', profitColor(result.expectedProfit))}>
                {formatMoney(result.expectedProfit)}
              </div>
              <div className="tabular text-xs text-muted-foreground">毛利率 {result.profitRatePct}%</div>
              {negativeProfit && (
                <div className="mt-1 text-xs text-destructive">⚠ 低于成本，建议调整售价或毛利率</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  sub,
  bold,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? 'font-medium' : 'text-muted-foreground'}>
        {label}
        {sub && <span className="ml-1 text-xs text-muted-foreground">({sub})</span>}
      </span>
      <span className={cn('tabular', bold && 'font-semibold', muted && 'text-muted-foreground/60')}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t" />;
}
