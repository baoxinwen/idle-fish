/**
 * 导出对话框：预览报价图/生产单，导出 PNG/PDF/Excel。
 * v2：Modal size=xl 修复此前宽度覆盖 bug；预览按容器宽等比缩放（导出仍取原始节点，精度不变）；
 *     卖家名来自设置 brand.sellerName。
 */

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { QuoteSheet } from './quote-sheet';
import { ProductionSheet } from './production-sheet';
import { PAGE_WIDTH } from './sheet-theme';
import { useToast } from '@/components/toaster';
import { settingsApi } from '@/lib/api';
import { exportNodeAsPng, exportNodeAsPdf, exportQuoteExcel } from '@/lib/export';
import type { QuoteRecord } from '@idle-fish/shared';
import { FileImage, FileType, FileSpreadsheet, Download } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  quote: QuoteRecord | null;
}

type SheetType = 'quote' | 'production';

export function ExportDialog({ open, onClose, quote }: ExportDialogProps) {
  const [type, setType] = useState<SheetType>('quote');
  /** 导出节点：保持原始尺寸，供 html-to-image 截取 */
  const nodeRef = useRef<HTMLDivElement>(null);
  /** 缩放外层：只影响视觉，transform 不进入克隆渲染 */
  const scaleWrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  // M-12：不再做会话级缓存——改卖家名后导出仍用旧名的陈旧窗口无法接受；
  // 每次打开弹窗拉一次 settings（单用户工具，往返开销可忽略），失败沿用默认值
  const [sellerName, setSellerName] = useState('@包黑蛋');

  // 打开时拉取品牌信息
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    settingsApi
      .get()
      .then((s) => {
        if (!cancelled) setSellerName(s.brand.sellerName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 预览缩放：容器宽 / 版面宽；ResizeObserver 跟随弹窗尺寸与窗口变化
  useEffect(() => {
    if (!open) return;
    const container = scaleWrapRef.current?.parentElement;
    if (!container) return;
    const measure = () => setScale(Math.min(1, container.clientWidth / (PAGE_WIDTH + 32)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [open]);

  async function handlePng() {
    if (!nodeRef.current) return;
    setBusy(true);
    try {
      await exportNodeAsPng(nodeRef.current, `${filename()}.png`);
      toast('已导出 PNG');
    } catch (e) {
      toast(`导出失败：${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf() {
    if (!nodeRef.current) return;
    setBusy(true);
    try {
      await exportNodeAsPdf(nodeRef.current, `${filename()}.pdf`);
      toast('已导出 PDF');
    } catch (e) {
      toast(`导出失败：${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleExcel() {
    if (!quote) return;
    setBusy(true);
    try {
      await exportQuoteExcel(quote);
      toast('已导出 Excel');
    } catch (e) {
      toast(`导出失败：${e}`);
    } finally {
      setBusy(false);
    }
  }

  function filename() {
    return `${quote!.quoteNo}-${type === 'quote' ? '报价图' : '生产单'}`;
  }

  return (
    <Modal open={open} onClose={onClose} title={`导出 · ${quote?.quoteNo ?? ''}`} size="xl">
      <div className="space-y-3">
        {/* 类型切换（M-11：导出进行中禁用——首次导出含动态 import，期间切换
            会导致文件名在点击时定型而内容在克隆时定型，二者可能不符） */}
        <div className="flex gap-1">
          <Button
            variant={type === 'quote' ? 'default' : 'outline'}
            size="sm"
            disabled={busy}
            onClick={() => setType('quote')}
          >
            <FileImage className="h-3.5 w-3.5" />
            客户报价图
          </Button>
          <Button
            variant={type === 'production' ? 'default' : 'outline'}
            size="sm"
            disabled={busy}
            onClick={() => setType('production')}
          >
            <FileType className="h-3.5 w-3.5" />
            生产制作单
          </Button>
        </div>

        {/* 预览：按容器宽缩放展示；节点 ref 挂在未缩放内层，导出精度不受 transform 影响 */}
        <div className="max-h-[62vh] overflow-auto rounded-md border bg-muted/50 p-4">
          <div ref={scaleWrapRef} style={{ width: PAGE_WIDTH * scale }}>
            <div
              ref={nodeRef}
              style={{ width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              className="shadow-sm"
            >
              {quote &&
                (type === 'quote' ? (
                  <QuoteSheet quote={quote} sellerName={sellerName} />
                ) : (
                  <ProductionSheet quote={quote} />
                ))}
            </div>
          </div>
        </div>

        {/* 导出按钮 */}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleExcel} disabled={busy}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel 明细
          </Button>
          <Button variant="outline" onClick={handlePng} disabled={busy}>
            <Download className="h-4 w-4" />
            导出 PNG
          </Button>
          <Button variant="accent" onClick={handlePdf} disabled={busy}>
            <Download className="h-4 w-4" />
            导出 PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
