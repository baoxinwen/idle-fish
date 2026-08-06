/**
 * 鉴权 store：会话状态 + 登录/设置/登出。
 * status 三态：loading（未查询）/ authenticated / unauthenticated。
 * ensureLoaded 幂等且缓存 in-flight promise，避免并发调用重复请求。
 */

import { create } from 'zustand';
import { authApi } from '@/lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthStoreState {
  status: AuthStatus;
  needsSetup: boolean;
  loaded: boolean;
  /** in-flight ensureLoaded promise，防并发重复请求 */
  _pending: Promise<void> | null;

  ensureLoaded: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string, setupToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  status: 'loading',
  needsSetup: false,
  loaded: false,
  _pending: null,

  ensureLoaded: () => {
    if (get().loaded) return Promise.resolve();
    if (get()._pending) return get()._pending!;
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
        // 查询失败视为未登录，允许后续重试
        set({ status: 'unauthenticated', loaded: true, _pending: null });
        throw e;
      });
    set({ _pending: p });
    return p;
  },

  login: async (username, password) => {
    await authApi.login({ username, password });
    set({ status: 'authenticated', needsSetup: false, loaded: true });
  },

  setup: async (username, password, setupToken) => {
    await authApi.setup({ username, password, setupToken });
    set({ status: 'authenticated', needsSetup: false, loaded: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      // 整页刷新：清掉 quote/order/settings store 的内存状态，回到登录页
      window.location.assign('/login');
    }
  },
}));
