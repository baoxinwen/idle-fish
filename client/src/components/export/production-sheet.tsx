/**
 * 生产制作单 — 工程蓝图风。
 * 图签栏 + 裁切尺寸（内径）+ 三视图（内径标注）+ 材料清单。
 */

import { forwardRef } from 'react';
import { ThreeViews } from './three-views';
import { C, MONO, SANS } from './sheet-theme';
import type { QuoteRecord } from '@idlefish/shared';
import { formatMoney } from '@/lib/utils';
import { COLOR_LABEL, CATEGORY_LABEL } from '@/lib/status';
import { SIZE_GAP, toInnerSize } from '@idlefish/shared';

interface ProductionSheetProps {
  quote: QuoteRecord;
}

const S = {
  page: {
    width: 800,
    background: C.paper,
    color: C.ink,
    fontFamily: SANS,
    padding: 0,
    boxSizing: 'border-box' as const,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  titleBlock: {
    display: 'flex',
    borderBottom: `2px solid ${C.ink}`,
    borderTop: `2px solid ${C.ink}`,
    background: C.ink,
  },
  brand: {
    padding: '20px 28px',
    borderRight: `1px solid ${C.blue}`,
    flex: '0 0 auto',
  },
  brandMark: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: C.gold, marginBottom: 4 },
  brandTitle: { fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.paper, letterSpacing: 0.5 },
  brandSub: { fontFamily: MONO, fontSize: 13, color: C.gold, marginTop: 2 },
  titleInfo: { flex: 1, display: 'flex' },
  titleCell: { padding: '20px 18px', borderRight: `1px solid ${C.blue}`, flex: 1, minWidth: 0 },
  titleCellLabel: { fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, color: C.muted, marginBottom: 4 },
  titleCellValue: { fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.paper },
  section: { padding: '24px 28px 8px' },
  sectionHead: { display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  sectionNum: { fontFamily: MONO, fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: 1 },
  sectionTitle: { fontFamily: MONO, fontSize: 11, color: C.ink, fontWeight: 700, letterSpacing: 2 },
  sectionRule: { flex: 1, height: 1, background: C.line },
  cutCards: { padding: '8px 28px 16px', display: 'flex', gap: 12 },
  cutCard: {
    flex: 1,
    border: `1px solid ${C.ink}`,
    padding: '16px 12px',
    textAlign: 'center' as const,
    background: C.paper,
    borderRadius: 8,
  },
  cutCardGold: { borderLeft: `4px solid ${C.gold}` },
  cutLabel: { fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, color: C.muted, marginBottom: 6 },
  cutValue: { fontFamily: MONO, fontSize: 22, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' as const },
  cutHint: { fontFamily: MONO, fontSize: 8, color: C.muted, marginTop: 4 },
  viewsBox: { padding: '8px 28px 16px', display: 'flex', justifyContent: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontFamily: MONO, fontSize: 12 },
  th: {
    textAlign: 'left' as const,
    padding: '8px 16px',
    background: C.ink,
    color: C.paper,
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  thRight: { textAlign: 'right' as const },
  td: { padding: '9px 16px', borderBottom: `1px solid ${C.line}`, color: C.ink },
  tdRight: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
  tdCat: { color: C.muted, fontSize: 10 },
  footer: {
    padding: '16px 28px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: MONO,
    fontSize: 8,
    color: C.muted,
    letterSpacing: 1,
    borderTop: `1px solid ${C.line}`,
    marginTop: 8,
  },
};

export const ProductionSheet = forwardRef<HTMLDivElement, ProductionSheetProps>(({ quote }, _ref) => {
  const innerSize = toInnerSize(quote.input.size);
  const inner = {
    w: innerSize.width,
    d: innerSize.depth,
    h: innerSize.height,
  };

  return (
    <div style={S.page}>
      {/* 图签栏（深底，区别于报价图） */}
      <div style={S.titleBlock}>
        <div style={S.brand}>
          <div style={S.brandMark}>闲置鱼 · 制作单</div>
          <div style={S.brandTitle}>生产制作单</div>
          <div style={S.brandSub}>铝型材机柜 · 加工用</div>
        </div>
        <div style={S.titleInfo}>
          <div style={S.titleCell}>
            <div style={S.titleCellLabel}>报价编号</div>
            <div style={S.titleCellValue}>{quote.quoteNo}</div>
          </div>
          <div style={S.titleCell}>
            <div style={S.titleCellLabel}>日期</div>
            <div style={S.titleCellValue}>{quote.createdAt.slice(0, 10)}</div>
          </div>
          <div style={S.titleCell}>
            <div style={S.titleCellLabel}>外径 W×D×H</div>
            <div style={S.titleCellValue}>
              {quote.input.size.width}×{quote.input.size.depth}×{quote.input.size.height}
            </div>
          </div>
          <div style={{ ...S.titleCell, borderRight: 'none' }}>
            <div style={S.titleCellLabel}>型材</div>
            <div style={S.titleCellValue}>{COLOR_LABEL[quote.input.color]} 铝</div>
          </div>
        </div>
      </div>

      {/* 裁切尺寸 */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <span style={S.sectionNum}>01</span>
          <span style={S.sectionTitle}>裁切尺寸 · 内径 = 外径 − {SIZE_GAP}</span>
          <span style={S.sectionRule} />
        </div>
      </div>
      <div style={S.cutCards}>
        <div style={{ ...S.cutCard, ...S.cutCardGold }}>
          <div style={S.cutLabel}>宽（内径）</div>
          <div style={S.cutValue}>{inner.w}</div>
          <div style={S.cutHint}>
            {quote.input.size.width} − {SIZE_GAP}
          </div>
        </div>
        <div style={{ ...S.cutCard, ...S.cutCardGold }}>
          <div style={S.cutLabel}>深（内径）</div>
          <div style={S.cutValue}>{inner.d}</div>
          <div style={S.cutHint}>
            {quote.input.size.depth} − {SIZE_GAP}
          </div>
        </div>
        <div style={{ ...S.cutCard, ...S.cutCardGold }}>
          <div style={S.cutLabel}>高（内径）</div>
          <div style={S.cutValue}>{inner.h}</div>
          <div style={S.cutHint}>
            {quote.input.size.height} − {SIZE_GAP}
          </div>
        </div>
        <div style={S.cutCard}>
          <div style={S.cutLabel}>型材</div>
          <div style={{ ...S.cutValue, fontSize: 15 }}>{COLOR_LABEL[quote.input.color]}</div>
          <div style={S.cutHint}>{formatMoney(quote.result.breakdown.profile.unitPrice)}/m</div>
        </div>
      </div>

      {/* 三视图（内径标注） */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <span style={S.sectionNum}>02</span>
          <span style={S.sectionTitle}>三视图</span>
          <span style={S.sectionRule} />
        </div>
      </div>
      <div style={S.viewsBox}>
        <ThreeViews size={quote.input.size} showInner width={720} />
      </div>

      {/* 材料清单 */}
      <div style={S.section}>
        <div style={S.sectionHead}>
          <span style={S.sectionNum}>03</span>
          <span style={S.sectionTitle}>材料清单</span>
          <span style={S.sectionRule} />
        </div>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>类别</th>
            <th style={S.th}>名称</th>
            <th style={{ ...S.th, ...S.thRight }}>数量</th>
            <th style={{ ...S.th, ...S.thRight }}>单价</th>
            <th style={{ ...S.th, ...S.thRight }}>小计</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...S.td, ...S.tdCat }}>型材</td>
            <td style={S.td}>{COLOR_LABEL[quote.input.color]}铝型材</td>
            <td style={{ ...S.td, ...S.tdRight }}>{quote.result.breakdown.profile.totalLength}m</td>
            <td style={{ ...S.td, ...S.tdRight }}>{formatMoney(quote.result.breakdown.profile.unitPrice)}</td>
            <td style={{ ...S.td, ...S.tdRight }}>{formatMoney(quote.result.breakdown.profile.cost)}</td>
          </tr>
          {quote.input.accessories.map((a, i) => (
            <tr key={i}>
              <td style={{ ...S.td, ...S.tdCat }}>{CATEGORY_LABEL[a.category]}</td>
              <td style={S.td}>{a.name}</td>
              <td style={{ ...S.td, ...S.tdRight }}>{a.quantity}</td>
              <td style={{ ...S.td, ...S.tdRight }}>{formatMoney(a.unitPrice)}</td>
              <td style={{ ...S.td, ...S.tdRight }}>{formatMoney(a.quantity * a.unitPrice)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...S.td, ...S.tdCat }}>托盘</td>
            <td style={S.td}>托盘</td>
            <td style={{ ...S.td, ...S.tdRight }}>{quote.input.trayCount}</td>
            <td style={{ ...S.td, ...S.tdRight }}>{formatMoney(quote.input.trayUnitPrice)}</td>
            <td style={{ ...S.td, ...S.tdRight }}>{formatMoney(quote.result.breakdown.trayCost)}</td>
          </tr>
          <tr>
            <td style={S.td} colSpan={4}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: 1 }}>
                切割处理费
              </span>
            </td>
            <td style={{ ...S.td, ...S.tdRight, fontWeight: 700 }}>
              {formatMoney(quote.result.breakdown.cuttingFee)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={S.footer}>
        <span>闲置鱼 · 制作单 · {quote.quoteNo}</span>
        <span>本制作单供生产加工使用</span>
      </div>
    </div>
  );
});
ProductionSheet.displayName = 'ProductionSheet';
