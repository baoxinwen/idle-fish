/**
 * I-5 组件级回归测试（order-editor / settings-page / order-detail 加载失败终止态）。
 * 缺陷：加载失败只 toast，页面停留永久 Loading 或误导性「订单不存在」，无重试。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { OrderEditorPage } from '@/pages/order/order-editor-page';
import { SettingsPage } from '@/pages/settings/settings-page';
import { OrderDetailPage } from '@/pages/order/order-detail-page';
import { useOrderStore } from '@/store/order-store';
import { useSettingsStore } from '@/store/settings-store';

vi.mock('@/lib/api', () => ({
  ordersApi: {
    get: vi.fn(async (id: string) => {
      void id;
      throw new Error('网络错误');
    }),
    update: vi.fn(),
    create: vi.fn(),
    setStatus: vi.fn(),
    ship: vi.fn(),
  },
  quotesApi: { get: vi.fn(), update: vi.fn(), create: vi.fn(), convert: vi.fn() },
  settingsApi: {
    get: vi.fn(async () => {
      throw new Error('网络错误');
    }),
    update: vi.fn(),
  },
  backupApi: {},
  authApi: { changePassword: vi.fn() },
}));

function renderAt(path: string, element: React.ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/orders/:id', element },
      { path: '*', element },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  useOrderStore.setState({ initialized: false, editingId: null });
  useSettingsStore.setState({ settings: null, loaded: false, dirty: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('order-editor 加载失败（I-5）', () => {
  it('edit 模式加载失败：显示终止错误态与重试按钮，而非永久 Loading', async () => {
    renderAt('/orders/999', <OrderEditorPage />);
    await waitFor(() => expect(screen.getByText('加载失败')).toBeTruthy());
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});

describe('settings-page 加载失败（I-5）', () => {
  it('load 失败：显示终止错误态与重试按钮，而非永久 Loading', async () => {
    renderAt('/settings', <SettingsPage />);
    await waitFor(() => expect(screen.getByText('加载失败')).toBeTruthy());
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});

describe('order-detail 加载失败（I-5）', () => {
  it('请求失败：显示「加载失败 + 重试」而非误导性的「订单不存在」', async () => {
    renderAt('/orders/999', <OrderDetailPage />);
    await waitFor(() => expect(screen.getByText('加载失败')).toBeTruthy());
    expect(screen.queryByText('订单不存在')).toBeNull();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});
