/**
 * CopyButton 反馈契约（铁律 9/10）：
 * 复制成功 → 图标切对勾并微弹（欠阻尼），2.5s 后自熄恢复；
 * 复制失败 → 不进入对勾态。成功与否通过 onResult 交还调用方处理。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CopyButton } from '@/components/ui/copy-button';
import { copyText } from '@/lib/clipboard';

vi.mock('@/lib/clipboard', () => ({ copyText: vi.fn(async () => true) }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(copyText).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

async function clickCopy(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  // copyText 是 async，等微任务队列把 setDone 冲出来
  await act(async () => {
    await Promise.resolve();
  });
}

describe('CopyButton（复制反馈自熄）', () => {
  it('复制成功后进入已复制态，2.5s 后自熄恢复', async () => {
    render(<CopyButton getText="明细文本" label="复制明细" />);
    await clickCopy('复制明细');

    const btn = screen.getByRole('button', { name: '已复制' });
    expect(btn.getAttribute('title')).toBe('已复制');
    expect(copyText).toHaveBeenCalledWith('明细文本');

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole('button', { name: '复制明细' }).getAttribute('title')).toBe('复制明细');
  });

  it('复制失败不进入已复制态', async () => {
    vi.mocked(copyText).mockResolvedValueOnce(false);
    render(<CopyButton getText="明细文本" label="复制明细" />);
    await clickCopy('复制明细');

    const btn = screen.getByRole('button', { name: '复制明细' });
    expect(btn.getAttribute('title')).toBe('复制明细');
    // 失败同样不挂自熄定时器：2.5s 后仍是初始态
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(btn.getAttribute('title')).toBe('复制明细');
  });
});
