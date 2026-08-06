/**
 * 数据备份 / 导入恢复。
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { backupApi } from '@/lib/api';
import { useToast } from '@/components/toaster';
import { confirmDialog } from '@/components/confirm-dialog';
import { Download, Upload } from 'lucide-react';

export function BackupSection() {
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const blob = await backupApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `idlefish-backup-${new Date().toISOString().slice(0, 10)}.db`;
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
        <CardTitle className="text-sm">数据备份 / 导入</CardTitle>
        <CardDescription>导出整个数据库文件，或从备份恢复（恢复前自动备份当前库）</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleExport} disabled={busy}>
          <Download className="h-4 w-4" />
          导出备份
        </Button>
        <Button variant="outline" onClick={() => document.getElementById('import-input')?.click()} disabled={busy}>
          <Upload className="h-4 w-4" />
          导入恢复
        </Button>
        <input id="import-input" type="file" accept=".db,.sqlite,.sqlite3" hidden onChange={handleImport} />
      </CardContent>
    </Card>
  );
}
