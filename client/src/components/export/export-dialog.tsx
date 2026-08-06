/**
 * 导出对话框：预览报价图/生产单，导出 PNG/PDF/Excel。
 */

import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { QuoteSheet } from '@/components/export/quote-sheet';
import { ProductionSheet } from '@/components/export/production-sheet';
import { useToast } from '@/components/toaster';
import { exportNodeAsPng, exportNodeAsPdf, exportQuoteExcel } from '@/lib/export';
import type { QuoteRecord } from '@idlefish/shared';
import { FileImage, FileType, FileSpreadsheet, Download } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  quote: QuoteRecord | null;
}

type SheetType = 'quote' | 'production';

export function ExportDialog({ open, onClose, quote }: ExportDialogProps) {
  const [type, setType] = useState<SheetType>('quote');
  const nodeRef = useRef<HTMLDivElement>(null);
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);

  if (!quote) return null;

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
    setBusy(true);
    try {
      await exportQuoteExcel(quote!);
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
    <Modal open={open} onClose={onClose} title="导出" className="max-w-5xl">
      <div className="space-y-3">
        {/* 类型切换 */}
        <div className="flex gap-1">
          <Button variant={type === 'quote' ? 'default' : 'outline'} size="sm" onClick={() => setType('quote')}>
            <FileImage className="h-3.5 w-3.5" />
            客户报价图
          </Button>
          <Button variant={type === 'production' ? 'default' : 'outline'} size="sm" onClick={() => setType('production')}>
            <FileType className="h-3.5 w-3.5" />
            生产制作单
          </Button>
        </div>

        {/* 预览（可滚动） */}
        <div className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-4">
          <div ref={nodeRef} className="mx-auto" style={{ width: 800 }}>
            {type === 'quote' ? <QuoteSheet quote={quote} /> : <ProductionSheet quote={quote} />}
          </div>
        </div>

        {/* 导出按钮 */}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel 明细
          </Button>
          <Button variant="outline" onClick={handlePng} disabled={busy}>
            <Download className="h-4 w-4" />
            导出 PNG
          </Button>
          <Button onClick={handlePdf} disabled={busy}>
            <Download className="h-4 w-4" />
            导出 PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
