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
} from '@idlefish/shared';

/** 订单创建/编辑入参（与后端 createOrderBodySchema 对齐） */
export interface OrderCreateBody {
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  size: CabinetSize;
  materials: AccessoryItem[];
  materialCost: number;
  otherFee?: number;
  actualPrice: number;
  remark?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // 带 session cookie（同源默认会带，显式更稳）
    ...init,
    // headers 放 init 之后合并，避免 init.headers 覆盖掉默认 Content-Type
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  // 受保护 API 401（会话过期/失效）：整页跳登录并清前端状态。
  // 仅排除 /api/auth/login 与 /api/auth/setup 的 401（错密码/错 token 要内联报错，不跳转）；
  // /api/auth/password 是受保护端点（gate 之后），会话过期应与其他受保护端点一致跳登录。
  const isAuthBypass = url === '/api/auth/login' || url === '/api/auth/setup';
  if (res.status === 401 && !isAuthBypass) {
    window.location.assign('/login');
    throw new Error('未登录');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `请求失败 ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- 报价 ----------

export const quotesApi = {
  list: (status?: string) => request<QuoteRecord[]>(`/api/quotes${status ? `?status=${status}` : ''}`),
  get: (id: string) => request<QuoteRecord>(`/api/quotes/${id}`),
  create: (input: QuoteInput) => request<QuoteRecord>('/api/quotes', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: QuoteInput) =>
    request<{ id: string; input: QuoteInput; updatedAt: string }>(`/api/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: string) => request<void>(`/api/quotes/${id}`, { method: 'DELETE' }),
  convert: (id: string, body: { customer: { name: string; platformOrderNo: string }; shippingAddress: { receiver: string; phone: string; address: string }; remark?: string }) =>
    request<{ orderId: string; orderNo: string }>(`/api/quotes/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ---------- 订单 ----------

export const ordersApi = {
  list: (status?: string) => request<OrderRecord[]>(`/api/orders${status ? `?status=${status}` : ''}`),
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
  update: (settings: Settings) => request<{ updatedAt: string }>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};

// ---------- 统计 ----------

export const statsApi = {
  get: (range: StatsRange) => request<StatsData>(`/api/stats?range=${range}`),
};

// ---------- 备份 ----------

export const backupApi = {
  export: async (): Promise<Blob> => {
    const res = await fetch('/api/backup', { credentials: 'include' });
    if (!res.ok) throw new Error('导出失败');
    return res.blob();
  },
  restore: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/backup/restore', { method: 'POST', body: form, credentials: 'include' });
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
