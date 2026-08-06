/**
 * 数据备份 / 导入恢复。
 * 导入是高风险操作（覆盖全部数据），UI 做风险分级警示。
 */

import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { backupApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { confirmDialog } from '@/components/confirm-dialog';
import { Download, Upload, AlertTriangle } from 'lucide-react';

export function BackupSection() {
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy(true);
    try {
      const blob = await backupApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // 文件名加时分，避免同天多次导出覆盖
      const ts = new Date().toISOString().slice(0, 16).replace('T', '-');
      a.download = `idlefish-backup-${ts}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast('已导出备份');
    } catch (e) {
      toast(`导出失败：${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(await confirmDialog({ message: '导入将覆盖当前全部数据，且已自动备份原库。确认继续？', confirmLabel: '导入恢复', variant: 'destructive' }))) {
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      await backupApi.restore(file);
      toast('恢复成功，刷新中…');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast(`恢复失败：${e}`);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">数据备份 / 导入</CardTitle>
        <CardDescription>导出整个数据库文件，或从备份恢复（恢复前自动备份当前库）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport} disabled={busy}>
            <Download className="h-4 w-4" />
            导出备份
          </Button>
          <Button variant="destructive" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            导入恢复
          </Button>
          <input ref={fileRef} type="file" accept=".db,.sqlite,.sqlite3" hidden onChange={handleImport} />
        </div>
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span>导入恢复会覆盖当前全部数据（报价、订单、设置、账户）。恢复前会自动备份原库，但仍建议先手动导出一份。</span>
        </div>
      </CardContent>
    </Card>
  );
}
