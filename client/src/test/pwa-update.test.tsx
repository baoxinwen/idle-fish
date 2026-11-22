/**
 * PWA 更新接线契约：onNeedRefresh → 常驻 toast；点击「立即刷新」→
 * updateSW(true)（新 SW 接管 + reload）；三时机检查（注册即查 + 回前台查
 * + 每小时查）的守卫（页面可见且在线才查）。
 * virtual:pwa-register 经 vitest alias 到测试替身（stubs/pwa-register.ts）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: vi.fn() }));

import {
  __triggerNeedRefresh,
  __triggerRegistered,
  __getHooks,
  __setUpdateSW,
  __reset,
} from '../test/stubs/pwa-register';
import { setupPwaUpdate } from '@/lib/pwa-update';

const updateSWMock = vi.fn();

function registrationWith(update: () => Promise<void>) {
  return { update } as unknown as ServiceWorkerRegistration;
}

// jsdom 的 visibilityState/onLine 只读，用 defineProperty 模拟
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}
function setOnline(on: boolean) {
  const original = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', { value: on, configurable: true });
  return () => Object.defineProperty(navigator, 'onLine', { value: original, configurable: true });
}

beforeEach(() => {
  vi.mocked(toast).mockClear();
  updateSWMock.mockClear();
  __reset();
  __setUpdateSW(updateSWMock);
  setVisibility('visible');
});

describe('setupPwaUpdate', () => {
  it('注册时 immediate: true（注册即查一次更新）', () => {
    setupPwaUpdate();
    expect(__getHooks()?.immediate).toBe(true);
  });

  it('onNeedRefresh → 弹「新版本已就绪」常驻 toast', () => {
    setupPwaUpdate();
    __triggerNeedRefresh();
    expect(toast).toHaveBeenCalledWith(
      '新版本已就绪',
      expect.objectContaining({ duration: Infinity, id: 'pwa-update' }),
    );
  });

  it('toast 的「立即刷新」→ updateSW(true) 接管并重载', () => {
    setupPwaUpdate();
    __triggerNeedRefresh();
    const opts = vi.mocked(toast).mock.calls[0][1] as {
      action: { label: string; onClick: () => void };
    };
    expect(opts.action.label).toBe('立即刷新');
    opts.action.onClick();
    expect(updateSWMock).toHaveBeenCalledWith(true);
  });

  it('回前台（visible + online）触发 registration.update()（三时机之一）', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    setupPwaUpdate();
    __triggerRegistered(registrationWith(update));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalled();
  });

  it('离线时不查更新（守卫：注册即查也被拦截）', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const restore = setOnline(false);
    try {
      setupPwaUpdate();
      __triggerRegistered(registrationWith(update));
      document.dispatchEvent(new Event('visibilitychange'));
      expect(update).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('隐藏标签页不触发 update（守卫：注册即查也被拦截）', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    setVisibility('hidden');
    try {
      setupPwaUpdate();
      __triggerRegistered(registrationWith(update));
      document.dispatchEvent(new Event('visibilitychange'));
      expect(update).not.toHaveBeenCalled();
    } finally {
      setVisibility('visible');
    }
  });
});
