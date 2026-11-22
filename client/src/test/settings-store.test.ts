/**
 * I-3 回归测试：settings-store.save() 在请求往返期间的新编辑不得被静默吞掉。
 * 缺陷：save() 无条件 set({ dirty: false })——PUT 往返期间的在途修改
 * 既不在 payload 里又失去「未保存」保护，离开设置页后被服务端值覆盖丢失。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSettingsStore } from '@/store/settings-store';
import { DEFAULT_SETTINGS, type Settings } from '@idle-fish/shared';

function makeSettings(sellerName: string): Settings {
  return {
    ...DEFAULT_SETTINGS,
    brand: { ...DEFAULT_SETTINGS.brand, sellerName },
    defaultAccessories: [...DEFAULT_SETTINGS.defaultAccessories],
  };
}

/** 受控的 fetch：让 save() 的往返停留在我们编辑 store 的时刻 */
function deferFetch() {
  let resolve!: (v: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  vi.stubGlobal('fetch', vi.fn(() => promise));
  return () => resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

describe('settings-store.save()（I-3）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('保存在途期间的编辑：dirty 必须保持 true（不清脏）', async () => {
    const s1 = makeSettings('旧店名');
    useSettingsStore.setState({ settings: s1, loaded: true, dirty: true });

    const flush = deferFetch();
    const saving = useSettingsStore.getState().save();

    // 往返期间用户继续编辑（settings 引用变更）
    useSettingsStore.setState({ settings: makeSettings('新店名'), dirty: true });

    flush();
    await saving;

    expect(useSettingsStore.getState().dirty).toBe(true);
  });

  it('往返期间无编辑：保存成功后清脏（既有语义保持）', async () => {
    const s1 = makeSettings('店名');
    useSettingsStore.setState({ settings: s1, loaded: true, dirty: true });

    const flush = deferFetch();
    const saving = useSettingsStore.getState().save();
    flush();
    await saving;

    expect(useSettingsStore.getState().dirty).toBe(false);
  });
});
