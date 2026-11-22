/**
 * 离线缓存清空按钮的兜底契约（评审 PWA-I4）：clearOfflineCache 中途
 * reject 时按钮必须恢复可用并给出错误提示——兜底工具自身不能缺兜底
 * （此前 setBusy(true) 后异常外溢，按钮永久卡在「清除中…」）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/pwa-cache', () => ({
  clearOfflineCache: vi.fn(),
  offlineCacheAvailable: vi.fn(() => true),
}));
vi.mock('@/components/confirm-dialog', () => ({
  confirmDialog: vi.fn(async () => true),
}));
const toastMock = vi.fn();
vi.mock('@/components/toaster', () => ({
  // 组件内 useToast((s) => s.show) 返回的即 toast 函数
  useToast: () => toastMock,
}));

import { OfflineCacheSection } from '@/pages/settings/offline-cache-section';
import { clearOfflineCache } from '@/lib/pwa-cache';

beforeEach(() => {
  vi.mocked(clearOfflineCache).mockReset();
  toastMock.mockClear();
});

describe('OfflineCacheSection 清除失败兜底（PWA-I4）', () => {
  it('clearOfflineCache reject：按钮恢复可点并 toast 错误', async () => {
    const user = userEvent.setup();
    vi.mocked(clearOfflineCache).mockRejectedValue(new Error('存储被禁用'));
    render(<OfflineCacheSection />);

    await user.click(screen.getByRole('button', { name: /清除离线缓存/ }));

    expect(toastMock).toHaveBeenCalled();
    const button = await screen.findByRole('button', { name: /清除离线缓存/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('clearOfflineCache 返回 false（非 HTTPS）：提示不支持并恢复按钮', async () => {
    const user = userEvent.setup();
    vi.mocked(clearOfflineCache).mockResolvedValue(false);
    render(<OfflineCacheSection />);

    await user.click(screen.getByRole('button', { name: /清除离线缓存/ }));

    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('不支持'));
    const button = await screen.findByRole('button', { name: /清除离线缓存/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
