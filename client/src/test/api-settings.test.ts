/**
 * settings 保存后的快照失效契约（评审 PWA-I2）：/api/settings 走 SWR
 * 「命中即返」，PUT 不命中 GET 缓存也不失效同 URL 缓存——保存成功后重进
 * 设置页会秒回保存前的旧参数，用户误判「保存失败」。PUT 成功后必须删除
 * 该 URL 的快照条目。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { settingsApi } from '@/lib/api';

/** jsdom 无 CacheStorage：stub open/delete，记录被删的 URL */
function stubCacheStorage() {
  const deletedUrls: string[] = [];
  const cache = {
    delete: vi.fn(async (req: RequestInfo | URL) => {
      deletedUrls.push(String(req));
      return true;
    }),
  };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  return { deletedUrls };
}

function stubFetchPutOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ updatedAt: '2026-11-21T00:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('settingsApi.update 后的快照失效（PWA-I2）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PUT 成功后删除 /api/settings 的快照条目', async () => {
    const { deletedUrls } = stubCacheStorage();
    stubFetchPutOk();

    await settingsApi.update({} as never);

    expect(deletedUrls.some((u) => u.endsWith('/api/settings'))).toBe(true);
  });

  it('非安全上下文（无 caches）保存照常成功不抛错', async () => {
    // 不 stub caches —— jsdom 无 caches
    stubFetchPutOk();
    await expect(settingsApi.update({} as never)).resolves.toEqual({
      updatedAt: '2026-11-21T00:00:00Z',
    });
  });
});
