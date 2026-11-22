/**
 * 快照提示条（铁律配色跟随 warning 徽章）：两个触发源——
 *  1. 离线（offline/online 事件）：数据来自离线快照；
 *  2. 弱网快照回退（评审 PWA-I3）：在线但 SW 超时回退了缓存响应，
 *     由 api.ts 按 x-idle-fish-snapshot 响应头驱动 snapshot-state。
 * 在线且实时时零占位。这条横幅的职责就是诚实告知「看到的不是实时数据」，
 * 而不是让旧数据冒充实时的。
 */

import { useSyncExternalStore } from 'react';
import {
  isWeakSnapshot,
  subscribeWeakSnapshot,
} from '@/lib/snapshot-state';

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function OfflineBanner() {
  const onLine = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
  const weakSnapshot = useSyncExternalStore(subscribeWeakSnapshot, isWeakSnapshot);
  if (onLine && !weakSnapshot) return null;
  const label = onLine ? '弱网快照' : '离线快照';
  return (
    <div
      role="status"
      className="bg-amber-500/12 py-1.5 text-center text-xs text-amber-700 dark:text-amber-400"
    >
      {label} · 数据可能非最新，写操作以服务端为准
    </div>
  );
}
