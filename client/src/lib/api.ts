/**
 * 后端 API 封装。所有 fetch 走相对路径 /api，开发期由 Vite proxy 转发到 :3000。
 */

import type {
  AuthStatus,
  OrderRecord,
  QuoteRecord,
  Settings,
  StatsData,
  StatsRange,
  QuoteInput,
  ShippingInfo,
  CustomerInfo,
  ShippingAddress,
  CabinetSize,
  AccessoryItem,
} from '@idle-fish/shared';
import { clearSnapshotCache, SNAPSHOT_CACHE_NAME } from './snapshot-cache';
import { markSnapshotServed, markLiveServed } from './snapshot-state';

/** 订单创建/编辑入参（与后端 createOrderBodySchema 对齐） */
export interface OrderCreateBody {
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  size: CabinetSize;
  materials: AccessoryItem[];
  materialCost: number;
  installFee?: number;
  freight?: number;
  actualPrice: number;
  remark?: string;
}

/** 报价转订单时确认的财务数据 */
export interface QuoteConvertFinance {
  materialCost: number;
  installFee: number;
  freight: number;
  actualPrice: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // 带 session cookie（同源默认会带，显式更稳）
    ...init,
    // headers 放 init 之后合并，避免 init.headers 覆盖掉默认 Content-Type
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  // 受保护 API 401（会话过期/失效）：整页跳登录并清前端状态。
  // 仅排除 /api/auth/login、/api/auth/setup（错密码/错 token 要内联报错，不跳转）
  // 与 /api/auth/status（状态查询本身不应触发刷新循环——若未来 status 异常返回 401，
  // 整页 assign('/login') 会形成「status→刷新→status」死循环）。
  const isAuthBypass =
    url === '/api/auth/login' || url === '/api/auth/setup' || url === '/api/auth/status';
  if (res.status === 401 && !isAuthBypass) {
    // 会话已失效：快照里的 authenticated:true 立即不可信，必须先删
    // （await 确保整页导航终止 JS 前删除已落盘），否则 SWR 秒回过期登录态
    // 造成 /login ↔ / 死循环（评审 PWA-C1）
    await clearSnapshotCache().catch(() => {});
    window.location.assign('/login');
    throw new Error('未登录');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `请求失败 ${res.status}`);
  }
  // 弱网快照提示的数据源（评审 PWA-I3）：SW 对回退的缓存响应注入
  // x-idle-fish-snapshot，实时响应无此头——据此驱动 OfflineBanner
  if (res.headers.get('x-idle-fish-snapshot') === '1') {
    markSnapshotServed();
  } else {
    markLiveServed();
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- 报价 ----------

export const quotesApi = {
  list: (status?: string) =>
    request<QuoteRecord[]>(`/api/quotes${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => request<QuoteRecord>(`/api/quotes/${id}`),
  create: (input: QuoteInput) => request<QuoteRecord>('/api/quotes', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: QuoteInput) =>
    request<{ id: string; input: QuoteInput; updatedAt: string }>(`/api/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: string) => request<void>(`/api/quotes/${id}`, { method: 'DELETE' }),
  convert: (id: string, body: { customer: { name: string; platformOrderNo: string }; shippingAddress: { receiver: string; phone: string; address: string }; remark?: string; finance?: QuoteConvertFinance }) =>
    request<{ orderId: string; orderNo: string }>(`/api/quotes/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ---------- 订单 ----------

export const ordersApi = {
  list: (status?: string) =>
    request<OrderRecord[]>(`/api/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  get: (id: string) => request<OrderRecord>(`/api/orders/${id}`),
  create: (body: OrderCreateBody) =>
    request<{ id: string; orderNo: string; status: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<OrderCreateBody>) =>
    request<{ id: string; updatedAt: string }>(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setStatus: (id: string, status: string) =>
    request<{ id: string; status: string }>(`/api/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  ship: (id: string, body: { courier: string; trackingNo: string; actualFreight: number; checkRemark?: string }) =>
    request<{ id: string; status: string; shipping: ShippingInfo }>(`/api/orders/${id}/ship`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  remove: (id: string) => request<void>(`/api/orders/${id}`, { method: 'DELETE' }),
};

// ---------- 设置 ----------

export const settingsApi = {
  get: () => request<Settings>('/api/settings'),
  update: async (settings: Settings) => {
    const res = await request<{ updatedAt: string }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    // settings 走 SWR「命中即返」，PUT 不命中 GET 缓存也不会失效同 URL 条目——
    // 不删的话保存成功后重进设置页会秒回保存前的旧参数（评审 PWA-I2）
    if ('caches' in window) {
      await caches
        .open(SNAPSHOT_CACHE_NAME)
        .then((c) => c.delete('/api/settings'))
        .catch(() => {});
    }
    return res;
  },
};

// ---------- 统计 ----------

export const statsApi = {
  get: (range: StatsRange) => request<StatsData>(`/api/stats?range=${encodeURIComponent(range)}`),
};

// ---------- 备份 ----------

/** restore 的服务端响应结构（INF-M6：此前返回隐式 any） */
export interface BackupRestoreResult {
  ok: boolean;
  autoBackup: string | null;
  message: string;
}

export const backupApi = {
  export: async (): Promise<Blob> => {
    const res = await fetch('/api/backup', { credentials: 'include' });
    if (res.status === 401) {
      // L8：与统一 request() 的 401 行为对齐——会话失效时跳登录，而非误报「导出失败」
      window.location.assign('/login');
      throw new Error('未登录');
    }
    if (!res.ok) {
      // INF-M5：解析服务端错误详情，与 restore 一致，不再笼统「导出失败」
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `导出失败 ${res.status}`);
    }
    return res.blob();
  },
  restore: async (file: File): Promise<BackupRestoreResult> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/backup/restore', { method: 'POST', body: form, credentials: 'include' });
    if (res.status === 401) {
      window.location.assign('/login');
      throw new Error('未登录');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || '恢复失败');
    }
    return res.json();
  },
};

// ---------- 鉴权 ----------

export const authApi = {
  status: () => request<AuthStatus>('/api/auth/status'),
  login: (body: { username: string; password: string }) =>
    request<{ authenticated: boolean }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  setup: (body: { username: string; password: string; setupToken: string }) =>
    request<{ authenticated: boolean }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-setup-token': body.setupToken },
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (body: { oldPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/password', { method: 'POST', body: JSON.stringify(body) }),
};
