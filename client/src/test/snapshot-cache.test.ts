/**
 * 快照缓存清理契约（评审 PWA-C1/PWA-I1）：会话状态转换点必须让快照失效——
 * 登录态与业务数据两个缓存都要删，非安全上下文安全返回不抛错。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  clearSnapshotCache,
  SNAPSHOT_CACHE_NAME,
  AUTH_SNAPSHOT_CACHE_NAME,
} from '@/lib/snapshot-cache';

/** jsdom 无 CacheStorage：stub 最小面（delete 记录调用） */
function stubCaches() {
  const deleted: string[] = [];
  vi.stubGlobal('caches', {
    delete: vi.fn(async (name: string) => {
      deleted.push(name);
      return true;
    }),
  });
  return deleted;
}

describe('clearSnapshotCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('同时删除业务快照与登录态快照两个缓存', async () => {
    const deleted = stubCaches();
    await expect(clearSnapshotCache()).resolves.toBe(true);
    expect(deleted).toEqual(
      expect.arrayContaining([SNAPSHOT_CACHE_NAME, AUTH_SNAPSHOT_CACHE_NAME]),
    );
  });

  it('非安全上下文（无 caches）安全返回 false 不抛错', async () => {
    // jsdom 默认未实现 caches —— 不 stub 即模拟 http 局域网场景
    await expect(clearSnapshotCache()).resolves.toBe(false);
  });
});
