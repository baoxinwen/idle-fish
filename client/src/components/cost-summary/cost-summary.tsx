/**
 * 成本明细 + 实时试算结果。
 */

import { useMemo } from 'react';
import { Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuoteStore } from '@/store/quote-store';
import { useToast } from '@/components/toaster';
import { calcQuote } from '@idlefish/shared';
import { CATEGORY_LABEL } from '@/lib/status';
import { buildCostText, buildMaterialsText, copyText } from '@/lib/clipboard';
import { formatMoney } from '@/lib/utils';

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

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">成本明细</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopyMaterials} title="复制材料清单">
            <Copy className="h-3 w-3" />
            清单
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyCost} title="复制成本明细">
            <Copy className="h-3 w-3" />
            明细
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
        {b.installFee > 0 && <Row label="安装费" value={formatMoney(b.installFee)} />}
        <Row label="运费" value={formatMoney(b.freight)} />
        <Row label="总成本" value={formatMoney(b.totalCost)} bold />

        <div className="mt-4 rounded-lg bg-primary/10 p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">最终报价</div>
              <div className="tabular text-3xl font-bold text-primary">{formatMoney(result.finalPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">预计利润</div>
              <div className="tabular text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {formatMoney(result.expectedProfit)}
              </div>
              <div className="tabular text-xs text-muted-foreground">毛利率 {result.profitRatePct}%</div>
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
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? 'font-medium' : 'text-muted-foreground'}>
        {label}
        {sub && <span className="ml-1 text-xs text-muted-foreground">({sub})</span>}
      </span>
      <span className={`tabular ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t" />;
}
