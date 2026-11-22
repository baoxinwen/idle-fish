/**
 * 离线标识条契约：offline 事件 → 显示提示；online 事件 → 零占位消失。
 * 弱网快照态（评审 PWA-I3）：在线但响应来自 SW 快照回退（api 层按
 * x-idle-fish-snapshot 头驱动 snapshot-state）→ 显示弱网提示。
 * jsdom 的 navigator.onLine 只读恒 true，须 defineProperty 模拟。
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OfflineBanner } from '@/components/offline-banner';
import { markSnapshotServed, markLiveServed, resetSnapshotState } from '@/lib/snapshot-state';

function setOnline(on: boolean) {
  const original = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', { value: on, configurable: true });
  return () => Object.defineProperty(navigator, 'onLine', { value: original, configurable: true });
}

beforeEach(() => {
  resetSnapshotState();
});

afterEach(() => {
  setOnline(true)(); // 还原，避免污染同文件后续用例
});

describe('OfflineBanner', () => {
  it('默认在线：不渲染（零占位）', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.textContent).toBe('');
  });

  it('offline 事件 → 显示「离线快照」提示', () => {
    const restore = setOnline(false);
    render(<OfflineBanner />);
    fireEvent(window, new Event('offline'));
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('离线快照');
    expect(banner.textContent).toContain('数据可能非最新');
    restore();
    // 在线恢复 → 消失
    fireEvent(window, new Event('online'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('在线但弱网快照回退 → 显示「弱网快照」提示；实时恢复后消失（PWA-I3）', () => {
    // 此前只认 navigator.onLine：弱网超时回退快照时 onLine=true，横幅不渲染，
    // 旧数据冒充实时的信息缺口正是快照机制的目标场景
    markSnapshotServed();
    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('弱网快照');
    expect(banner.textContent).toContain('数据可能非最新');

    act(() => {
      markLiveServed();
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
