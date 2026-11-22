/**
 * 离线缓存（PWA）兜底：SW 出灵异问题（缓存错配、更新卡死）时的一键归零。
 * 真权威是服务端数据——这里清的只是界面与快照副本，清完 reload 重新注册。
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toaster';
import { clearOfflineCache, offlineCacheAvailable } from '@/lib/pwa-cache';
import { RefreshCw } from 'lucide-react';

export function OfflineCacheSection() {
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);

  async function handleClear() {
    if (!(await confirmDialog({
      message: '清除离线缓存？将删除已缓存的界面与数据副本，页面随后自动重新加载。',
      confirmLabel: '清除并重载',
      variant: 'destructive',
    }))) return;
    setBusy(true);
    // 兜底工具自身要有兜底（评审 PWA-I4）：caches/unregister 任一 reject
    // （隐私限制、存储被禁用）不得把按钮永久卡在「清除中…」
    try {
      const ok = await clearOfflineCache();
      if (!ok) {
        setBusy(false);
        toast('当前环境不支持离线缓存（非 HTTPS 访问）');
      }
      // 成功路径：clearOfflineCache 内部已 reload，无需恢复 busy
    } catch {
      setBusy(false);
      toast('清除失败，请刷新页面后重试');
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">离线缓存</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleClear} disabled={busy || !offlineCacheAvailable()}>
          <RefreshCw className="h-4 w-4" />
          {busy ? '清除中…' : '清除离线缓存'}
        </Button>
        {!offlineCacheAvailable() && (
          <p className="mt-2 text-xs text-muted-foreground">当前为非 HTTPS 访问，离线缓存不可用</p>
        )}
      </CardContent>
    </Card>
  );
}
