/**
 * 鉴权 store：会话状态 + 登录/设置/登出。
 * status 三态：loading（未查询）/ authenticated / unauthenticated。
 * ensureLoaded 幂等且缓存 in-flight promise，避免并发调用重复请求。
 */

import { create } from 'zustand';
import { authApi } from '@/lib/api';
import { clearSnapshotCache } from '@/lib/snapshot-cache';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthStoreState {
  status: AuthStatus;
  needsSetup: boolean;
  loaded: boolean;
  /** ensureLoaded 最近一次失败的错误（加载失败态的 UI 出口，成功/重试后清空） */
  loadError: string | null;
  /** in-flight ensureLoaded promise，防并发重复请求 */
  _pending: Promise<void> | null;

  ensureLoaded: () => Promise<void>;
  /** 加载失败后的手动重试：清错误并重发 status（loaded=false 时真正重发） */
  retryLoad: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string, setupToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  status: 'loading',
  needsSetup: false,
  loaded: false,
  loadError: null,
  _pending: null,

  ensureLoaded: () => {
    if (get().loaded) return Promise.resolve();
    if (get()._pending) return get()._pending!;
    set({ loadError: null }); // 新一轮探测开始，清掉上次失败提示
    const p = authApi
      .status()
      .then((r) => {
        set({
          status: r.authenticated ? 'authenticated' : 'unauthenticated',
          needsSetup: r.needsSetup,
          loaded: true,
          _pending: null,
        });
      })
      .catch((e) => {
        // 瞬时失败（网络抖动/5xx）≠ 未登录：不置 loaded、不落 unauthenticated
        // 认证假象——置 loaded 会短路缓存这次失败，session 有效也被钉死在登录页。
        // 保持 loading 让页面停在加载态，但必须留下 loadError 给 UI 渲染重试出口
        //（否则永久卡「加载中」——INF-I2 修复首版只有 store 层可重试、UI 层无人触发）
        set({ status: 'loading', loaded: false, _pending: null, loadError: String(e) });
        throw e;
      });
    set({ _pending: p });
    return p;
  },

  retryLoad: async () => {
    set({ loadError: null });
    await get().ensureLoaded();
  },

  login: async (username, password) => {
    await authApi.login({ username, password });
    // 清过期快照：首次登录/初始化成功后，旧快照可能是 needsSetup:true 或
    // authenticated:false，整页刷新会被秒回弹错页（评审 PWA-C1 轻量变体）
    await clearSnapshotCache().catch(() => {});
    set({ status: 'authenticated', needsSetup: false, loaded: true });
  },

  setup: async (username, password, setupToken) => {
    await authApi.setup({ username, password, setupToken });
    await clearSnapshotCache().catch(() => {});
    set({ status: 'authenticated', needsSetup: false, loaded: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      // 登出只清 cookie 不清快照的话：过期 authenticated 快照秒回 → 登录页
      // 死循环；业务快照（客户 PII）留盘 7 天可离线查看（评审 PWA-C1/PWA-I1）。
      // await 确保整页导航终止 JS 前删除已落盘；失败不阻断跳转。
      await clearSnapshotCache().catch(() => {});
      // 整页刷新：清掉 quote/order/settings store 的内存状态，回到登录页
      window.location.assign('/login');
    }
  },
}));
