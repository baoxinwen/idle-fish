/**
 * 弱网快照缓存的统一命名与失效入口（评审 PWA-C1/PWA-I1）。
 *
 * SWR 快照只在「写入」与「7 天过期/LRU 淘汰」时消失，没有任何状态转换点
 * 让它失效——登出、会话 401、登录/初始化成功后，过期快照里的
 * authenticated:true 会被秒回，形成登录页↔首页整页跳转死循环；登出后
 * 业务快照（客户 PII）还会留盘 7 天可离线查看。
 *
 * 因此登录态快照独立成缓存（不被业务 30 条 LRU 挤出），并在上述转换点
 * 由 clearSnapshotCache 一并删除。调用方：api.ts（401）、auth-store
 * （logout/login/setup）。
 */

export const SNAPSHOT_CACHE_NAME = 'idle-fish-snapshot';
/** 登录态探测独立缓存：单 URL，不与业务快照共享 30 条 LRU 名额 */
export const AUTH_SNAPSHOT_CACHE_NAME = 'idle-fish-auth';

/** 删除全部快照缓存。非安全上下文（局域网 http 无 caches）安全返回 false。 */
export async function clearSnapshotCache(): Promise<boolean> {
  if (!('caches' in window)) return false;
  await Promise.all([
    caches.delete(SNAPSHOT_CACHE_NAME),
    caches.delete(AUTH_SNAPSHOT_CACHE_NAME),
  ]);
  return true;
}
