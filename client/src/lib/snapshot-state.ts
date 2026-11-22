/**
 * 弱网快照状态机（评审 PWA-I3）。
 * 弱网超时回退发生在 SW 层（NetworkFirst 3s 超时回缓存），浏览器在线时
 * navigator.onLine 恒 true——此前页面侧无法区分「实时响应」与「快照回退」，
 * 旧数据冒充实时的信息缺口正是快照机制的目标场景。
 *
 * 机制：SW 对回退的缓存响应注入 x-idle-fish-snapshot 头（vite.config
 * runtimeCaching plugin，仅 NetworkFirst 业务数据路由；SWR 两路秒回缓存是
 * 设计行为不标记），api.ts request() 按响应头驱动本状态，OfflineBanner 订阅。
 */

let weakSnapshot = false;
const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

/** SW 回退快照响应：置弱网态（api.ts 按 x-idle-fish-snapshot 头调用） */
export function markSnapshotServed() {
  if (weakSnapshot) return;
  weakSnapshot = true;
  emit();
}

/** 实时响应：恢复（任意无标记的成功响应都算实时证据） */
export function markLiveServed() {
  if (!weakSnapshot) return;
  weakSnapshot = false;
  emit();
}

export function isWeakSnapshot() {
  return weakSnapshot;
}

export function subscribeWeakSnapshot(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 测试隔离用：归零状态与订阅者 */
export function resetSnapshotState() {
  weakSnapshot = false;
  listeners.clear();
}
