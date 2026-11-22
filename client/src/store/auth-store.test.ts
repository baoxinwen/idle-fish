/**
 * 鉴权 store 行为测试。
 * 评审 PWA-C1/PWA-I1：登录态快照（Service Worker 缓存）只在状态转换点失效——
 * 登出/登录/初始化成功都必须清快照，否则 SWR 秒回过期 authenticated 会造成
 * 登录页↔首页死循环、登出后 PII 留盘。
 * 评审 INF-I2：/api/auth/status 瞬时失败不得钉死 unauthenticated（不置 loaded），
 * 下次 ensureLoaded 必须真正重发请求。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  authApi: {
    status: vi.fn(),
    login: vi.fn(),
    setup: vi.fn(),
    logout: vi.fn(),
  },
}));

import { useAuthStore } from '@/store/auth-store';
import { authApi } from '@/lib/api';
import {
  SNAPSHOT_CACHE_NAME,
  AUTH_SNAPSHOT_CACHE_NAME,
} from '@/lib/snapshot-cache';

/** jsdom 无 CacheStorage：stub 最小面，记录被删的缓存名 */
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

// jsdom 的 location 不可直接赋值：替换为仅含 assign 的受控对象
function stubLocation() {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { assign },
    configurable: true,
  });
  return assign;
}

beforeEach(() => {
  vi.mocked(authApi.status).mockReset();
  vi.mocked(authApi.login).mockReset();
  vi.mocked(authApi.setup).mockReset();
  vi.mocked(authApi.logout).mockReset();
  useAuthStore.setState({
    status: 'loading',
    needsSetup: false,
    loaded: false,
    _pending: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // @ts-expect-error 还原被 defineProperty 的 location
  delete window.location;
});

describe('会话状态转换点的快照失效（PWA-C1/PWA-I1）', () => {
  it('logout 成功：清除两个快照缓存后再跳登录页', async () => {
    const assign = stubLocation();
    const deleted = stubCaches();
    vi.mocked(authApi.logout).mockResolvedValue({ ok: true });

    useAuthStore.setState({ status: 'authenticated', loaded: true });
    await useAuthStore.getState().logout();

    expect(deleted).toEqual(
      expect.arrayContaining([SNAPSHOT_CACHE_NAME, AUTH_SNAPSHOT_CACHE_NAME]),
    );
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('logout 的清理失败不阻断跳转（仍 assign /login）', async () => {
    const assign = stubLocation();
    vi.stubGlobal('caches', {
      delete: vi.fn(async () => {
        throw new Error('caches unavailable');
      }),
    });
    vi.mocked(authApi.logout).mockResolvedValue({ ok: true });

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('login 成功：清除过期快照（防旧 needsSetup/authenticated 变体）', async () => {
    stubLocation();
    const deleted = stubCaches();
    vi.mocked(authApi.login).mockResolvedValue({ authenticated: true });

    await useAuthStore.getState().login('admin', 'password123');

    expect(deleted.length).toBeGreaterThan(0);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('setup 成功：同样清除过期快照', async () => {
    stubLocation();
    const deleted = stubCaches();
    vi.mocked(authApi.setup).mockResolvedValue({ authenticated: true });

    await useAuthStore.getState().setup('admin', 'password123', 'token');

    expect(deleted.length).toBeGreaterThan(0);
  });
});

describe('status 瞬时失败不钉死（INF-I2）', () => {
  it('失败后 loaded 保持 false、记录 loadError；再次 ensureLoaded 真正重发请求', async () => {
    stubLocation();
    vi.mocked(authApi.status)
      .mockRejectedValueOnce(new Error('网络抖动'))
      .mockResolvedValueOnce({ authenticated: true, needsSetup: false });

    await expect(useAuthStore.getState().ensureLoaded()).rejects.toThrow('网络抖动');
    // 失败不置 loaded、不落 unauthenticated 认证假象，但必须留下可感知的错误
    expect(useAuthStore.getState().loaded).toBe(false);
    expect(useAuthStore.getState().status).not.toBe('unauthenticated');
    expect(useAuthStore.getState().loadError).toContain('网络抖动');

    // 第二次调用必须真正重发（不再命中短路缓存）
    await useAuthStore.getState().ensureLoaded();
    expect(authApi.status).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().loadError).toBeNull();
  });

  it('retryLoad：重发请求并在成功后清 loadError（加载失败态的唯一出口）', async () => {
    stubLocation();
    vi.mocked(authApi.status)
      .mockRejectedValueOnce(new Error('超时'))
      .mockResolvedValueOnce({ authenticated: true, needsSetup: false });

    await expect(useAuthStore.getState().ensureLoaded()).rejects.toThrow('超时');
    expect(useAuthStore.getState().loadError).toContain('超时');

    await useAuthStore.getState().retryLoad();
    expect(authApi.status).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().loaded).toBe(true);
    expect(useAuthStore.getState().loadError).toBeNull();
  });

  it('在途 ensureLoaded 并发调用共享同一次请求（_pending 防重复）', async () => {
    stubLocation();
    let reject!: (e: Error) => void;
    vi.mocked(authApi.status).mockImplementation(
      () =>
        new Promise<never>((_, r) => {
          reject = r;
        }),
    );

    const p1 = useAuthStore.getState().ensureLoaded();
    const p2 = useAuthStore.getState().ensureLoaded();
    reject(new Error('超时'));
    await expect(p1).rejects.toThrow('超时');
    await expect(p2.catch(() => {})).resolves.toBeUndefined();
    expect(authApi.status).toHaveBeenCalledTimes(1);
  });
});

describe('既有语义保持', () => {
  it('成功路径照常置 loaded/needsSetup，且不清快照', async () => {
    stubLocation();
    const deleted = stubCaches();
    vi.mocked(authApi.status).mockResolvedValue({
      authenticated: false,
      needsSetup: true,
    });

    await useAuthStore.getState().ensureLoaded();

    expect(useAuthStore.getState().loaded).toBe(true);
    expect(useAuthStore.getState().needsSetup).toBe(true);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(deleted).toEqual([]);
  });
});
