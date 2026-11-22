/**
 * 弱网快照状态机测试（评审 PWA-I3）：页面侧区分「实时响应」与「快照回退」。
 * 机制：SW 对回退快照响应加 x-idle-fish-snapshot 头（vite.config plugin），
 * api.ts 依响应头驱动本状态机；OfflineBanner 订阅显示弱网提示。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  markSnapshotServed,
  markLiveServed,
  resetSnapshotState,
  isWeakSnapshot,
  subscribeWeakSnapshot,
} from '@/lib/snapshot-state';

beforeEach(() => {
  resetSnapshotState();
});

describe('snapshot-state（PWA-I3）', () => {
  it('初始非弱网', () => {
    expect(isWeakSnapshot()).toBe(false);
  });

  it('快照响应置弱网 true；实时响应恢复 false', () => {
    markSnapshotServed();
    expect(isWeakSnapshot()).toBe(true);
    markLiveServed();
    expect(isWeakSnapshot()).toBe(false);
  });

  it('重复标记不重复通知订阅者（状态翻转才 emit）', () => {
    let calls = 0;
    subscribeWeakSnapshot(() => {
      calls += 1;
    });
    markSnapshotServed();
    markSnapshotServed();
    expect(calls).toBe(1);
    markLiveServed();
    markLiveServed();
    expect(calls).toBe(2);
  });

  it('订阅返回取消函数', () => {
    let calls = 0;
    const unsub = subscribeWeakSnapshot(() => {
      calls += 1;
    });
    unsub();
    markSnapshotServed();
    expect(calls).toBe(0);
  });
});
