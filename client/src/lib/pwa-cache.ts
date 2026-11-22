/**
 * 离线缓存兜底：SW 出灵异问题（缓存错配、更新卡死）时的一键归零——
 * 删光 Cache Storage、注销全部 Service Worker，reload 后重新注册。
 * 守卫：非安全上下文（局域网 http）没有 serviceWorker，直接返回 false
 * 让调用方提示不可用。
 */

export async function clearOfflineCache(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return false;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  location.reload();
  return true;
}

/** 当前环境是否具备离线缓存能力（HTTPS / localhost 安全上下文） */
export function offlineCacheAvailable(): boolean {
  return 'serviceWorker' in navigator && 'caches' in window;
}
