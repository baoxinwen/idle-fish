/**
 * 转单页脏跟踪契约（评审 CFL-I1）：/orders/new?fromQuote=X 加载完成后
 * 不做任何编辑就离开，不得弹「有未保存的修改」拦截。
 * 缺陷：effect 里 markLoaded() 后有两次 setConvertForm——空表单消费掉
 * justLoaded、把 baseline 定为空表单，异步报价到达后的 finance 填充
 * 被当成用户编辑 → dirty 假阳性。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { OrderEditorPage } from '@/pages/order/order-editor-page';
import { DEFAULT_SETTINGS, calcQuote, type QuoteInput, type QuoteRecord } from '@idle-fish/shared';

const input: QuoteInput = {
  size: { width: 600, depth: 400, height: 800 },
  color: 'silver',
  trayCount: 1,
  trayUnitPrice: 85,
  installEnabled: false,
  freightEnabled: true,
  accessories: [],
  pricing: DEFAULT_SETTINGS.defaultPricing,
};

const record: QuoteRecord = {
  id: 'A',
  quoteNo: 'Q-A',
  status: 'quoted',
  input,
  result: calcQuote(input),
  createdAt: '2026-11-21T00:00:00Z',
  updatedAt: '2026-11-21T00:00:00Z',
};

vi.mock('@/lib/api', () => ({
  quotesApi: {
    get: vi.fn(async () => record),
    convert: vi.fn(),
  },
  ordersApi: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  settingsApi: {
    get: vi.fn(async () => DEFAULT_SETTINGS),
    update: vi.fn(),
  },
  authApi: { changePassword: vi.fn() },
  backupApi: {},
}));

import { quotesApi } from '@/lib/api';

function renderConvertPage() {
  const router = createMemoryRouter(
    [
      { path: '/orders/new', element: <OrderEditorPage /> },
      { path: '/orders', element: <div>order-list</div> },
    ],
    { initialEntries: ['/orders/new?fromQuote=A'] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderEditorPage 转单模式脏跟踪（CFL-I1）', () => {
  it('报价加载完成后未编辑即离开：不弹「有未保存的修改」拦截', async () => {
    const user = userEvent.setup();
    renderConvertPage();

    // 等报价加载完成（finance 填充进确认表单）
    await waitFor(() => expect(quotesApi.get).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getAllByText(/材料成本/).length).toBeGreaterThan(0),
    );

    // 不做任何编辑，直接点「取消」离开
    const cancelButtons = screen.getAllByRole('button', { name: '取消' });
    await user.click(cancelButtons[0]);

    // 修复前：finance 填充被当成用户编辑 → blocker 弹「有未保存的修改」
    expect(screen.queryByText('有未保存的修改')).toBeNull();
  });

  it('加载完成后真实编辑再离开：拦截仍然生效（守卫不被削弱）', async () => {
    const user = userEvent.setup();
    renderConvertPage();

    await waitFor(() => expect(quotesApi.get).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getAllByText(/材料成本/).length).toBeGreaterThan(0),
    );

    // 真实编辑：填客户名称
    const nameInput = screen.getByLabelText('客户名称 *');
    await user.type(nameInput, '客户甲');

    const cancelButtons = screen.getAllByRole('button', { name: '取消' });
    await user.click(cancelButtons[0]);

    expect(screen.getByText('有未保存的修改')).toBeTruthy();
  });
});
