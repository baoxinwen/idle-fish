/**
 * 报价文本生成（复制到剪贴板用）。
 */

import type { QuoteResult } from '@idlefish/shared';
import { calcProfileCost, getProfileUnitPrice } from '@idlefish/shared';
import { CATEGORY_LABEL, COLOR_LABEL } from './status';
import type { QuoteInput } from '@idlefish/shared';
import { formatMoney } from './utils';

/** 材料清单文本（无价格，过滤数量 0） */
export function buildMaterialsText(input: QuoteInput): string {
  const lines: string[] = [];
  lines.push('【材料清单】');
  lines.push(`机柜尺寸：${input.size.width}×${input.size.depth}×${input.size.height}mm（${COLOR_LABEL[input.color]}）`);
  lines.push('');
  // 铝型材（含长度）：按颜色取单价（与引擎一致，避免黑色型材用错单价）
  const unitPrice = getProfileUnitPrice(input.pricing, input.color);
  const profileLen = calcProfileCost(input.size, unitPrice, input.pricing.wastage).totalLength;
  lines.push(`铝型材 × ${profileLen}m`);
  lines.push('');
  // 配件按类别分组，过滤数量 0
  const byCat = new Map<string, typeof input.accessories>();
  for (const a of input.accessories) {
    if (a.quantity <= 0) continue;
    const arr = byCat.get(a.category) ?? [];
    arr.push(a);
    byCat.set(a.category, arr);
  }
  for (const [cat, items] of byCat) {
    lines.push(`[${CATEGORY_LABEL[cat] ?? cat}]`);
    for (const a of items) {
      lines.push(`  ${a.name} × ${a.quantity}`);
    }
  }
  // 托盘（数量>0 才列）
  if (input.trayCount > 0) {
    lines.push('');
    lines.push(`托盘 × ${input.trayCount}`);
  }
  return lines.join('\n');
}

/** 成本明细文本 */
export function buildCostText(result: QuoteResult): string {
  const b = result.breakdown;
  const lines: string[] = [];
  lines.push('【成本明细】');
  lines.push(`铝型材：${b.profile.totalLength}m × ${formatMoney(b.profile.unitPrice)}/m × 损耗${b.profile.wastage} = ${formatMoney(b.profile.cost)}`);
  lines.push(`切割处理费：${formatMoney(b.cuttingFee)}`);
  lines.push(`配件小计：${formatMoney(b.accessoryTotal)}`);
  lines.push(`托盘：${b.trayCount} × ${formatMoney(b.trayUnitPrice)} = ${formatMoney(b.trayCost)}`);
  lines.push(`材料成本：${formatMoney(b.materialCost)}`);
  if (b.installFee > 0) lines.push(`安装费：${formatMoney(b.installFee)}`);
  lines.push(`运费：${formatMoney(b.freight)}`);
  lines.push(`总成本：${formatMoney(b.totalCost)}`);
  lines.push('');
  lines.push(`最终报价：${formatMoney(result.finalPrice)}`);
  lines.push(`预计利润：${formatMoney(result.expectedProfit)}（毛利率 ${result.profitRatePct}%）`);
  return lines.join('\n');
}

/** 复制到剪贴板，返回是否成功。clipboard API 失败时降级 execCommand */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级：创建临时 textarea + execCommand('copy')，兼容 localhost 非 HTTPS
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
