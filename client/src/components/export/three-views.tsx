/**
 * 机柜三视图（俯视 / 主视 / 侧视），工程制图风。
 * 细线轮廓 + 内框（型材截面）+ 尺寸标注线（端点小竖线 + 数字）。
 * 报价图与生产单共用。
 */

import type { CabinetSize } from '@idlefish/shared';
import { toInnerSize } from '@idlefish/shared';
import { C } from './sheet-theme';

interface ThreeViewsProps {
  size: CabinetSize;
  /** 外径标注（true，默认）或内径标注（false，生产单用） */
  showInner?: boolean;
  width?: number;
}

export function ThreeViews({ size, showInner = false, width = 720 }: ThreeViewsProps) {
  const outer = size;
  const inner = toInnerSize(size);
  const label = showInner ? inner : outer;

  // 每个视图独立缩放，保证视觉均衡
  const viewW = (width - 48) / 3; // 三列，留间隙
  const pad = 56; // 标注线空间

  const top = renderView({
    label: '俯视图',
    boxW: outer.width,
    boxH: outer.depth,
    innerW: inner.width,
    innerH: inner.depth,
    dimH: label.width,
    dimV: label.depth,
    dimHLabel: '宽',
    dimVLabel: '深',
    viewW,
    pad,
  });
  const front = renderView({
    label: '主视图',
    boxW: outer.width,
    boxH: outer.height,
    innerW: inner.width,
    innerH: inner.height,
    dimH: label.width,
    dimV: label.height,
    dimHLabel: '宽',
    dimVLabel: '高',
    viewW,
    pad,
  });
  const side = renderView({
    label: '侧视图',
    boxW: outer.depth,
    boxH: outer.height,
    innerW: inner.depth,
    innerH: inner.height,
    dimH: label.depth,
    dimV: label.height,
    dimHLabel: '深',
    dimVLabel: '高',
    viewW,
    pad,
  });

  const svgW = width;
  const svgH = pad * 2 + Math.max(top.boxH, front.boxH, side.boxH) + 40;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: 'transparent' }}>
      <g transform={`translate(0, 8)`}>{top.node}</g>
      <g transform={`translate(${viewW + 24}, 8)`}>{front.node}</g>
      <g transform={`translate(${(viewW + 24) * 2}, 8)`}>{side.node}</g>
    </svg>
  );
}

interface ViewParams {
  label: string;
  boxW: number; // 实际尺寸 mm
  boxH: number;
  innerW: number;
  innerH: number;
  dimH: number; // 标注值
  dimV: number;
  dimHLabel: string;
  dimVLabel: string;
  viewW: number;
  pad: number;
}

function renderView(p: ViewParams): { node: React.ReactNode; boxH: number } {
  const maxDrawW = p.viewW - p.pad * 2;
  const maxDrawH = 180;
  const scale = Math.min(maxDrawW / p.boxW, maxDrawH / p.boxH);
  const w = p.boxW * scale;
  const h = p.boxH * scale;
  const innerW = p.innerW * scale;
  const innerH = p.innerH * scale;

  // 视图内居中
  const ox = (p.viewW - w) / 2;
  const oy = p.pad + 20;
  const cx = ox + w / 2;
  const ix = ox + (w - innerW) / 2;
  const iy = oy + (h - innerH) / 2;

  const dimBelowY = oy + h + 18;
  const dimRightX = ox + w + 18;

  return {
    boxH: h,
    node: (
      <g>
        {/* 视图标签 */}
        <text x={cx} y={oy - 12} textAnchor="middle" fontSize={9} fill={C.muted} letterSpacing={1.5}>
          {p.label}
        </text>
        {/* 外轮廓 */}
        <rect x={ox} y={oy} width={w} height={h} fill="none" stroke={C.ink} strokeWidth={1.2} />
        {/* 内框（型材截面） */}
        <rect x={ix} y={iy} width={innerW} height={innerH} fill="none" stroke={C.ink} strokeWidth={0.5} opacity={0.4} />
        {/* 水平标注（底部） */}
        <DimLine
          x1={ox}
          y1={dimBelowY}
          x2={ox + w}
          y2={dimBelowY}
          label={`${p.dimHLabel} ${p.dimH}`}
          vertical={false}
        />
        {/* 垂直标注（右侧） */}
        <DimLine
          x1={dimRightX}
          y1={oy}
          x2={dimRightX}
          y2={oy + h}
          label={`${p.dimVLabel} ${p.dimV}`}
          vertical
        />
        <text x={cx} y={dimBelowY + 24} textAnchor="middle" fontSize={10} fill={C.blue} fontWeight={600}>
          {p.dimH} × {p.dimV}
        </text>
      </g>
    ),
  };
}

function DimLine({
  x1,
  y1,
  x2,
  y2,
  label,
  vertical,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  vertical: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.blue} strokeWidth={0.8} />
      {/* 端点延伸小线 */}
      <line x1={x1} y1={y1 - 3} x2={x1} y2={y1 + 3} stroke={C.blue} strokeWidth={0.8} />
      <line x1={x2} y1={y2 - 3} x2={x2} y2={y2 + 3} stroke={C.blue} strokeWidth={0.8} />
      {/* 标注文字背景留白（避免压线） */}
      <rect
        x={mx - (vertical ? 18 : 22)}
        y={my - (vertical ? 6 : 7)}
        width={vertical ? 36 : 44}
        height={12}
        fill="#F5F2EC"
      />
      <text
        x={mx}
        y={my}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill={C.blue}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}
