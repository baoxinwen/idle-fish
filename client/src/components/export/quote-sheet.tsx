/**
 * 客户报价图 — 工程图签 + 印刷品质感，全中文，金线图签。
 * 正文无衬线提升可读性，数字等宽对齐；字距一律用 em 随字号缩放（better-typography）。
 * 布局：顶部品牌金条 + 四格图签栏 + 区块卡片化 + 暖金最终报价（含人民币大写）。
 * 印刷质感：四角裁切线、最终报价块斜纹微纹理、footer 生成时间。
 */

import { forwardRef, Fragment } from 'react';
import { ThreeViews } from './three-views';
import { C, MONO, SANS, PAGE_WIDTH } from './sheet-theme';

/** 卖家联系方式兜底值（sellerContact 未配置时沿用） */
const DEFAULT_SELLER_CONTACT = '15249983529';
import type { QuoteRecord } from '@idle-fish/shared';
import { formatMoney, localDate, formatDateTime, toCnyUppercase } from '@/lib/utils';
import { COLOR_LABEL } from '@/lib/status';

interface QuoteSheetProps {
  quote: QuoteRecord;
  /** 卖家名称（settings.brand.sellerName）；缺省沿用旧内置值 */
  sellerName?: string;
  /** 卖家联系方式（settings.brand.sellerContact）；缺省沿用旧内置值（CFL-M7：不再硬编码） */
  sellerContact?: string;
}

/** 报价有效期（天） */
const QUOTE_VALIDITY_DAYS = 7;

// 统一内容区左右留白
const PX = 52;

const S = {
  page: {
    width: PAGE_WIDTH,
    background: C.paper,
    color: C.ink,
    fontFamily: SANS,
    padding: 0,
    boxSizing: 'border-box' as const,
    borderRadius: 0,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  // 四角裁切线（印刷品 mark）：金色 L 形，纯装饰
  cropMark: {
    position: 'absolute' as const,
    width: 14,
    height: 14,
    borderColor: 'rgba(201,169,97,0.4)',
    borderStyle: 'solid' as const,
    borderWidth: 0,
  },
  // 顶部品牌金条：印刷品 top bar
  goldTopBar: { height: 4, background: C.gold },

  // 顶部图签栏：贴边 banner，深墨蓝底
  titleBlock: {
    background: C.ink,
    color: C.paper,
  },
  titleRow: {
    display: 'flex',
    borderBottom: `1px solid rgba(201,169,97,0.25)`,
  },
  brand: {
    padding: '22px 36px',
    borderRight: `1px solid rgba(255,255,255,0.08)`,
    flex: '0 0 auto',
  },
  brandMark: { fontFamily: SANS, fontSize: 11, letterSpacing: '0.18em', color: C.gold, marginBottom: 8, fontWeight: 500 },
  brandTitle: { fontFamily: SANS, fontSize: 22, fontWeight: 700, color: C.paper, letterSpacing: '0.04em' },
  brandSub: { fontFamily: MONO, fontSize: 11, color: 'rgba(245,242,236,0.55)', marginTop: 6, letterSpacing: '0.18em' },
  seller: { flex: 1, display: 'flex' },
  sellerCell: {
    padding: '22px 20px',
    borderRight: `1px solid rgba(255,255,255,0.08)`,
    flex: 1,
    minWidth: 0,
  },
  sellerCellLast: { padding: '22px 20px', flex: 1, minWidth: 0 },
  pageCell: {
    padding: '22px 20px',
    borderLeft: `1px solid rgba(255,255,255,0.08)`,
    flex: '0 0 auto',
  },
  cellLabel: {
    fontFamily: SANS,
    fontSize: 10,
    letterSpacing: '0.15em',
    color: 'rgba(245,242,236,0.5)',
    marginBottom: 8,
    fontWeight: 500,
  },
  cellValue: { fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.paper },
  cellValueSmall: { fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.paper, fontVariantNumeric: 'tabular-nums' as const },
  cellValueGold: { fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.gold },
  metaRow: { display: 'flex' },
  metaCell: {
    padding: '15px 20px',
    borderRight: `1px solid rgba(255,255,255,0.08)`,
    flex: 1,
  },
  metaCellLast: { padding: '15px 20px', flex: 1 },
  metaLabel: {
    fontFamily: SANS,
    fontSize: 10,
    letterSpacing: '0.15em',
    color: 'rgba(245,242,236,0.5)',
    marginBottom: 6,
    fontWeight: 500,
  },
  metaValue: { fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.paper, fontVariantNumeric: 'tabular-nums' as const },
  metaUnit: { fontFamily: SANS, fontSize: 11, fontWeight: 400, color: 'rgba(245,242,236,0.55)', marginLeft: 4 },

  // 内容区通用
  section: { padding: `24px ${PX}px 0` },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionNum: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.gold,
    fontWeight: 700,
    letterSpacing: '0.09em',
    background: C.goldSoft,
    padding: '3px 8px',
    borderRadius: 3,
  },
  sectionTitle: { fontFamily: SANS, fontSize: 14, color: C.ink, fontWeight: 700, letterSpacing: '0.1em' },
  sectionRule: { flex: 1, height: 1, background: C.line },

  // 三视图卡片
  viewsCard: {
    margin: `0 ${PX}px`,
    background: C.cardBg,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    padding: '14px 10px',
    display: 'flex',
    justifyContent: 'center',
  },

  // 配置摘要卡片
  summary: {
    margin: `16px ${PX}px 0`,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr', // M-13：单元格只有 3 个（费用项收起后），4 列声明导致右侧 1/4 空白
    gap: 0,
    background: C.cardBg,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  summaryCell: { padding: '14px 18px', borderRight: `1px solid ${C.line}` },
  summaryCellLast: { padding: '14px 18px', borderRight: 'none' },
  summaryLabel: { fontFamily: SANS, fontSize: 10, letterSpacing: '0.15em', color: C.muted, marginBottom: 6, fontWeight: 500 },
  summaryValue: { fontFamily: MONO, fontSize: 14, fontWeight: 600, color: C.ink, fontVariantNumeric: 'tabular-nums' as const },
  summaryValueGold: { fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.gold, fontVariantNumeric: 'tabular-nums' as const },

  // 明细表卡片
  tableWrap: {
    margin: `16px ${PX}px 0`,
    background: C.cardBg,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontFamily: SANS, fontSize: 14 },
  th: {
    textAlign: 'left' as const,
    padding: '10px 18px',
    background: C.ink,
    color: C.paper,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.13em',
  },
  thRight: { textAlign: 'right' as const },
  td: { padding: '10px 18px', borderBottom: `1px solid ${C.line}`, color: C.ink },
  tdLast: { borderBottom: 'none' },
  tdRight: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, fontFamily: MONO },
  tdSub: { color: C.muted, fontSize: 12 },
  // 分组行（类别标题，跨两列）：金色左条 + 暖金底，工程图分组标识
  tdGroup: {
    padding: '9px 15px 8px',
    fontFamily: SANS,
    fontSize: 11,
    letterSpacing: '0.15em',
    color: C.ink,
    background: 'rgba(201,169,97,0.08)',
    borderBottom: `1px solid ${C.line}`,
    fontWeight: 600,
    borderLeft: `3px solid ${C.gold}`,
  },

  // 最终报价：暖金强调大块 + 斜纹微纹理
  finalBox: {
    margin: `24px ${PX}px 0`,
    padding: '22px 28px',
    background: C.ink,
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(201,169,97,0.05) 0 1px, transparent 1px 8px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  finalGoldBar: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    background: C.gold,
  },
  finalLabel: { fontFamily: SANS, fontSize: 13, color: C.paper, letterSpacing: '0.15em', opacity: 0.8, fontWeight: 600 },
  finalSub: { fontFamily: SANS, fontSize: 11, color: C.gold, marginTop: 6, letterSpacing: '0.04em' },
  finalUpper: { fontFamily: SANS, fontSize: 12, color: 'rgba(245,242,236,0.75)', marginTop: 5, letterSpacing: '0.05em' },
  finalValueWrap: { textAlign: 'right' as const },
  finalValue: {
    fontFamily: MONO,
    fontSize: 38,
    fontWeight: 700,
    color: C.gold,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  finalCurrency: { fontSize: 24, fontWeight: 700, marginRight: 4 },

  // 有效期
  validity: {
    margin: `14px ${PX}px 0`,
    padding: '10px 16px',
    border: `1px solid ${C.gold}`,
    background: C.goldSoft,
    borderRadius: 8,
    fontFamily: SANS,
    fontSize: 12,
    lineHeight: 1.6,
    color: C.ink,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  validityIcon: {
    flex: '0 0 auto',
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `1.5px solid ${C.gold}`,
    color: C.gold,
    fontWeight: 700,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    padding: `18px ${PX}px 22px`,
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: SANS,
    fontSize: 10,
    color: C.muted,
    letterSpacing: '0.1em',
    marginTop: 16,
    borderTop: `1px solid ${C.line}`,
  },
};

function expiryDate(createdAt: string): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + QUOTE_VALIDITY_DAYS);
  return d.toLocaleDateString('en-CA');
}

export const QuoteSheet = forwardRef<HTMLDivElement, QuoteSheetProps>(
  ({ quote, sellerName = '@包黑蛋', sellerContact }, _ref) => {
    const b = quote.result.breakdown;
    const dateStr = localDate(quote.createdAt);
    const contact = sellerContact?.trim() ? sellerContact.trim() : DEFAULT_SELLER_CONTACT;
    const freightIncluded = b.freight > 0;
    const installIncluded = quote.input.installEnabled && b.installFee > 0;
    const upper = toCnyUppercase(quote.result.finalPrice);

    // 材料清单按类别分组：铝型材 / 配件（含托盘，过滤数量 0）。无价格，只列名称+数量。
    const accessoryItems = quote.input.accessories
      .filter((a) => a.quantity > 0)
      .map((a) => ({ name: a.name, qty: `${a.quantity} 个` }));
    const materialGroups: { group: string; items: { name: string; qty: string }[] }[] = [
      { group: '铝型材', items: [{ name: `${COLOR_LABEL[quote.input.color]}铝型材`, qty: `${b.profile.totalLength}m` }] },
      ...(accessoryItems.length > 0 ? [{ group: '配件', items: accessoryItems }] : []),
    ];

    return (
      <div style={S.page}>
        {/* 四角裁切线（印刷 mark） */}
        <span style={{ ...S.cropMark, left: 6, top: 6, borderTopWidth: 1, borderLeftWidth: 1 }} />
        <span style={{ ...S.cropMark, right: 6, top: 6, borderTopWidth: 1, borderRightWidth: 1 }} />
        <span style={{ ...S.cropMark, left: 6, bottom: 6, borderBottomWidth: 1, borderLeftWidth: 1 }} />
        <span style={{ ...S.cropMark, right: 6, bottom: 6, borderBottomWidth: 1, borderRightWidth: 1 }} />

        <div style={S.goldTopBar} />

        {/* 图签栏：品牌 | 卖家 | 联系方式 | 页码（第四格收右缘，工程图签惯例） */}
        <div style={S.titleBlock}>
          <div style={S.titleRow}>
            <div style={S.brand}>
              <div style={S.brandMark}>闲鱼 · 机柜报价</div>
              <div style={S.brandTitle}>铝型材机柜</div>
              <div style={S.brandSub}>QUOTATION · 报价单</div>
            </div>
            <div style={S.seller}>
              <div style={S.sellerCell}>
                <div style={S.cellLabel}>卖家</div>
                <div style={S.cellValueGold}>{sellerName}</div>
              </div>
              <div style={S.sellerCellLast}>
                <div style={S.cellLabel}>联系方式</div>
                <div style={S.cellValueSmall}>{contact}</div>
              </div>
            </div>
            <div style={S.pageCell}>
              <div style={S.cellLabel}>页码</div>
              <div style={S.cellValueSmall}>第 1 页 · 共 1 页</div>
            </div>
          </div>
          <div style={S.metaRow}>
            <div style={S.metaCell}>
              <div style={S.metaLabel}>报价日期</div>
              <div style={S.metaValue}>{dateStr}</div>
            </div>
            <div style={S.metaCell}>
              <div style={S.metaLabel}>有效期至</div>
              <div style={S.metaValue}>
                {expiryDate(quote.createdAt)}
                <span style={S.metaUnit}>（{QUOTE_VALIDITY_DAYS} 天）</span>
              </div>
            </div>
            <div style={S.metaCell}>
              <div style={S.metaLabel}>机柜尺寸（宽×深×高）</div>
              <div style={S.metaValue}>
                {quote.input.size.width}×{quote.input.size.depth}×{quote.input.size.height}
                <span style={S.metaUnit}>mm</span>
              </div>
            </div>
            <div style={S.metaCellLast}>
              <div style={S.metaLabel}>型材颜色</div>
              <div style={S.metaValue}>{COLOR_LABEL[quote.input.color]}</div>
            </div>
          </div>
        </div>

        {/* 01 三视图 */}
        <div style={S.section}>
          <div style={S.sectionHead}>
            <span style={S.sectionNum}>01</span>
            <span style={S.sectionTitle}>机柜尺寸 · 三视图</span>
            <span style={S.sectionRule} />
          </div>
        </div>
        <div style={S.viewsCard}>
          <ThreeViews size={quote.input.size} width={700} />
        </div>

        {/* 02 配置摘要 */}
        <div style={S.section}>
          <div style={S.sectionHead}>
            <span style={S.sectionNum}>02</span>
            <span style={S.sectionTitle}>配置摘要</span>
            <span style={S.sectionRule} />
          </div>
        </div>
        <div style={S.summary}>
          <div style={S.summaryCell}>
            <div style={S.summaryLabel}>运费</div>
            {/* M1：客户报价图只显示总价——费用项仅显示「已含/未含」状态，不泄露金额 */}
            <div style={freightIncluded ? S.summaryValueGold : S.summaryValue}>
              {freightIncluded ? '✓ 已含' : '— 未含'}
            </div>
          </div>
          <div style={S.summaryCell}>
            <div style={S.summaryLabel}>安装费</div>
            <div style={installIncluded ? S.summaryValueGold : S.summaryValue}>
              {installIncluded ? '✓ 已含' : '— 未含'}
            </div>
          </div>
          <div style={S.summaryCellLast}>
            <div style={S.summaryLabel}>铝型材用量</div>
            <div style={S.summaryValue}>{b.profile.totalLength}m</div>
          </div>
        </div>

        {/* 03 材料清单 */}
        <div style={S.section}>
          <div style={S.sectionHead}>
            <span style={S.sectionNum}>03</span>
            <span style={S.sectionTitle}>材料清单</span>
            <span style={S.sectionRule} />
          </div>
        </div>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>材料名称</th>
                <th style={{ ...S.th, ...S.thRight }}>数量</th>
              </tr>
            </thead>
            <tbody>
              {materialGroups.map((g, gi) => (
                <Fragment key={gi}>
                  <tr>
                    <td style={S.tdGroup} colSpan={2}>{g.group}</td>
                  </tr>
                  {g.items.map((m, i) => {
                    const isLast = gi === materialGroups.length - 1 && i === g.items.length - 1;
                    return (
                      <tr key={`${gi}-${i}`}>
                        <td style={{ ...S.td, ...(isLast ? S.tdLast : {}) }}>{m.name}</td>
                        <td style={{ ...S.td, ...S.tdRight, ...(isLast ? S.tdLast : {}) }}>{m.qty}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* 最终报价：金额 + 人民币大写（正式单据惯例） */}
        <div style={S.finalBox}>
          <span style={S.finalGoldBar} />
          <div>
            <div style={S.finalLabel}>最终报价</div>
            <div style={S.finalSub}>
              {freightIncluded ? '含运费' : '未含运费'} · {installIncluded ? '含安装费' : '未含安装费'}
            </div>
            <div style={S.finalUpper}>大写：{upper}</div>
          </div>
          <div style={S.finalValueWrap}>
            <span style={{ ...S.finalValue, ...S.finalCurrency }}>¥</span>
            <span style={S.finalValue}>{formatMoney(quote.result.finalPrice).replace('¥', '')}</span>
          </div>
        </div>

        {/* 有效期 */}
        <div style={S.validity}>
          <span style={S.validityIcon}>!</span>
          <span>
            本报价有效期 {QUOTE_VALIDITY_DAYS} 天（至 {expiryDate(quote.createdAt)}），逾期需重新核价。最终成交价以实际沟通为准。
          </span>
        </div>

        <div style={S.footer}>
          <span>卖家 {sellerName} · {contact}</span>
          <span>生成于 {formatDateTime(new Date().toISOString())} · 本报价单由系统生成</span>
        </div>
      </div>
    );
  },
);
QuoteSheet.displayName = 'QuoteSheet';
