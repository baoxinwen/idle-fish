/**
 * 导出文档共享主题：色板、字体栈、页宽。
 * quote-sheet / production-sheet / three-views 共用，避免色值散落多处。
 */

export const C = {
  ink: '#0B1220',
  blue: '#1E3A5F',
  gold: '#C9A961',
  goldSoft: 'rgba(201,169,97,0.10)',
  paper: '#F5F2EC',
  muted: '#8A8A8A',
  line: '#E5DFD0',
  cardBg: '#FBF9F3',
  red: '#B23A3A',
} as const;

export const MONO = `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace`;
export const SANS = `Inter, system-ui, -apple-system, "Microsoft YaHei", sans-serif`;

/** 页面宽度 */
export const PAGE_WIDTH = 800;
