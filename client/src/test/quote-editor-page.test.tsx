/**
 * C-3 / I-6 组件级回归测试（报价编辑页）。
 * C-3：重进同一报价（store 命中 skip 分支）时本地 settings 丢失——必须补拉，
 *      否则保存静默失效、恢复默认参数入口消失。
 * I-6：已转单报价必须禁保存并明示，不得让用户在必败路径上输入。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QuoteEditorPage } from '@/pages/quote/quote-editor-page';
import { useQuoteStore } from '@/store/quote-store';
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

function makeRecord(id: string, status: QuoteRecord['status']): QuoteRecord {
  return {
    id,
    quoteNo: `Q-${id}`,
    status,
    input,
    result: calcQuote(input),
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
  };
}

vi.mock('@/components/cabinet-3d/cabinet-3d', () => ({
  Cabinet3D: () => <div data-testid="cabinet-3d-stub" />,
}));
vi.mock('@/lib/export', () => ({
  exportNodeAsPng: vi.fn(),
  exportNodeAsPdf: vi.fn(),
  exportQuoteExcel: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  quotesApi: {
    get: vi.fn(async (id: string) => makeRecord(id, 'quoted')),
    update: vi.fn(async () => ({})),
    create: vi.fn(),
    convert: vi.fn(),
  },
  settingsApi: {
    get: vi.fn(async () => DEFAULT_SETTINGS),
    update: vi.fn(async () => ({})),
  },
  ordersApi: {},
  backupApi: {},
  authApi: { changePassword: vi.fn() },
}));

import { quotesApi, settingsApi } from '@/lib/api';

function renderPage(id: string) {
  const router = createMemoryRouter(
    [
      { path: '/quotes/:id', element: <QuoteEditorPage /> },
      { path: '/quotes', element: <div>quote-list</div> },
      { path: '/orders/*', element: <div>order-page</div> },
    ],
    { initialEntries: [`/quotes/${id}`] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks 不恢复实现：显式重置 get 的默认行为，防跨测试污染
  vi.mocked(quotesApi.get).mockImplementation(async (id: string) => makeRecord(id, 'quoted'));
  useQuoteStore.setState({
    editingId: null,
    editingStatus: null,
    initialized: false,
  });
});

describe('QuoteEditorPage 重进同一报价（C-3）', () => {
  it('skip 分支命中时补拉 settings：settingsApi.get 被调用', async () => {
    useQuoteStore.setState({
      editingId: 'A',
      editingStatus: 'quoted',
      initialized: true,
      input,
    });
    renderPage('A');

    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());
  });

  it('重进后点保存：修改能够落盘（quotesApi.update 被调用）', async () => {
    useQuoteStore.setState({
      editingId: 'A',
      editingStatus: 'quoted',
      initialized: true,
      input,
    });
    renderPage('A');

    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());
    const saveButtons = screen.getAllByRole('button', { name: '保存' });
    saveButtons[0].click();

    await waitFor(() => expect(quotesApi.update).toHaveBeenCalledWith('A', input));
  });
});

describe('QuoteEditorPage 已转单报价（I-6）', () => {
  it('保存按钮禁用，点击不发起更新请求', async () => {
    useQuoteStore.setState({
      editingId: 'A',
      editingStatus: 'converted',
      initialized: true,
      input,
    });
    renderPage('A');

    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());
    const saveButtons = screen.getAllByRole('button', { name: '保存' }) as HTMLButtonElement[];
    expect(saveButtons[0].disabled).toBe(true);
    expect(saveButtons[1].disabled).toBe(true);

    saveButtons[0].click();
    await waitFor(() => expect(screen.getByText(/已转为订单/)).toBeTruthy());
    expect(quotesApi.update).not.toHaveBeenCalled();
  });
});

describe('QuoteEditorPage 编辑器内转单成功（CFL-I2）', () => {
  it('转单成功后失效编辑态：重进同一报价重新从服务端加载并禁编辑', async () => {
    const user = userEvent.setup();
    vi.mocked(quotesApi.convert).mockResolvedValue({ orderId: 'o1', orderNo: 'O-1' });
    // 编辑器正常编辑态（store 残留是转单前的现状）
    useQuoteStore.setState({
      editingId: 'A',
      editingStatus: 'quoted',
      initialized: true,
      input,
    });
    renderPage('A');

    await waitFor(() => expect(settingsApi.get).toHaveBeenCalled());

    // 打开转单弹窗并提交
    await user.click(screen.getByRole('button', { name: '转订单' }));
    await screen.findByText('报价转订单');
    await user.type(screen.getByLabelText('客户名称 *'), '客户甲');
    await user.click(screen.getByRole('button', { name: '确认转单' }));

    await waitFor(() => expect(quotesApi.convert).toHaveBeenCalled());
    // 修复前：store 残留 editingId/quoted → skip 分支命中 → 重进得到假可编辑界面
    expect(useQuoteStore.getState().editingId).toBeNull();

    // 重进同一报价：服务端已 converted → 必须重新加载并同步禁编辑
    vi.mocked(quotesApi.get).mockImplementation(async (id: string) =>
      makeRecord(id, 'converted'),
    );
    renderPage('A');
    await waitFor(() => expect(quotesApi.get).toHaveBeenCalledWith('A'));
    const saveButtons = screen.getAllByRole('button', { name: '保存' }) as HTMLButtonElement[];
    expect(saveButtons[0].disabled).toBe(true);
  });
});
