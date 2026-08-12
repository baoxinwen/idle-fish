/**
 * 导出工具：DOM → PNG / PDF，Excel 生成。
 * 导出模板用固定内联样式（不依赖 Tailwind 主题变量），确保导出结果稳定。
 * 重依赖（html-to-image/jspdf/xlsx）动态 import，仅在用户点导出时加载。
 */

import type { QuoteRecord } from '@idlefish/shared';
import { formatMoney, formatDateTime } from './utils';
import { COLOR_LABEL, CATEGORY_LABEL } from './status';

/** 截图时应用的临时样式：去掉居中 margin/transform，避免 html-to-image 偏移致歪斜 */
const CAPTURE_STYLE: Record<string, string> = {
  margin: '0',
  transform: 'none',
  marginLeft: '0',
  marginRight: '0',
};

/** 等待字体加载完成，避免导出时字体回退 */
async function waitFonts() {
  try {
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  } catch {
    // 忽略
  }
}

/** DOM 节点 → PNG dataURL */
export async function domToPngDataUrl(node: HTMLElement, options?: { bg?: string }): Promise<string> {
  await waitFonts();
  const { toPng } = await import('html-to-image');
  return toPng(node, {
    pixelRatio: 2,
    backgroundColor: options?.bg ?? '#ffffff',
    cacheBust: true,
    style: CAPTURE_STYLE,
  });
}

/** DOM 节点 → JPEG dataURL（PDF 用，体积小） */
async function domToJpegDataUrl(node: HTMLElement): Promise<string> {
  await waitFonts();
  const { toJpeg } = await import('html-to-image');
  return toJpeg(node, {
    pixelRatio: 1.5,
    quality: 0.92,
    backgroundColor: '#ffffff',
    cacheBust: true,
    style: CAPTURE_STYLE,
  });
}

/** 触发浏览器下载 */
function download(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** DOM → PNG 下载 */
export async function exportNodeAsPng(node: HTMLElement, filename: string): Promise<void> {
  const url = await domToPngDataUrl(node);
  download(url, filename);
}

/** DOM → PDF 下载（JPEG 贴入 A4 页面，体积小） */
export async function exportNodeAsPdf(node: HTMLElement, filename: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<void> {
  const jpgUrl = await domToJpegDataUrl(node);
  if (!jpgUrl) throw new Error('生成图片失败');
  const { default: jsPDF } = await import('jspdf');
  const img = new Image();
  img.src = jpgUrl;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('图片解码超时')), 10000);
    img.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('图片解码失败'));
    };
  });

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (pageW - w) / 2;
  const y = margin;
  pdf.addImage(jpgUrl, 'JPEG', x, y, w, h);
  pdf.save(filename);
}

/** 导出报价明细 Excel */
export async function exportQuoteExcel(quote: QuoteRecord): Promise<void> {
  const XLSX = await import('xlsx');
  const b = quote.result.breakdown;
  const wb = XLSX.utils.book_new();

  // 报价汇总
  const summary = [
    ['报价编号', quote.quoteNo],
    ['状态', quote.status],
    ['生成时间', formatDateTime(quote.createdAt)],
    [''],
    ['机柜尺寸（外径）', `${quote.input.size.width}×${quote.input.size.depth}×${quote.input.size.height} mm`],
    ['型材颜色', COLOR_LABEL[quote.input.color]],
    ['托盘', `${quote.input.trayCount} 个 × ${formatMoney(quote.input.trayUnitPrice)}`],
    [''],
    ['成本项', '金额（元）'],
    ['铝型材', b.profile.cost],
    ['切割处理费', b.cuttingFee],
    // 配件行已含托盘（accessoryTotal 含托盘，托盘是配件项），不再单独列，避免重复计费
    ['配件', b.accessoryTotal],
    ['材料成本', b.materialCost],
    ['安装费', b.installFee],
    ['运费', b.freight],
    ['总成本', b.totalCost],
    ['最终报价', quote.result.finalPrice],
    ['预计利润', quote.result.expectedProfit],
    ['毛利率(%)', quote.result.profitRatePct],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '报价汇总');

  // 材料清单
  const materials: (string | number)[][] = [['类别', '名称', '数量', '单价', '小计']];
  for (const a of quote.input.accessories) {
    materials.push([
      CATEGORY_LABEL[a.category] ?? a.category,
      a.name,
      a.quantity,
      a.unitPrice,
      a.quantity * a.unitPrice,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(materials), '材料清单');

  XLSX.writeFile(wb, `${quote.quoteNo}.xlsx`);
}
