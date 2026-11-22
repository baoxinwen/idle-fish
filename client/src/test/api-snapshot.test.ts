/**
 * api 层快照标记接线测试（评审 PWA-I3）：响应头含 x-idle-fish-snapshot →
 * 弱网快照状态置真；实时响应恢复 false。OfflineBanner 据此显示弱网提示。
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { statsApi } from '@/lib/api';
import {
  isWeakSnapshot,
  resetSnapshotState,
} from '@/lib/snapshot-state';

function stubFetchWithHeader(header: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (header) headers.set('x-idle-fish-snapshot', header);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 200, headers }),
    ),
  );
}

beforeEach(() => {
  resetSnapshotState();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request() 快照标记接线（PWA-I3）', () => {
  it('快照回退响应（带标记头）→ 弱网状态置真', async () => {
    stubFetchWithHeader('1');
    await statsApi.get('7d');
    expect(isWeakSnapshot()).toBe(true);
  });

  it('实时响应（无标记头）→ 弱网状态恢复 false', async () => {
    stubFetchWithHeader('1');
    await statsApi.get('7d');
    expect(isWeakSnapshot()).toBe(true);

    stubFetchWithHeader(null);
    await statsApi.get('7d');
    expect(isWeakSnapshot()).toBe(false);
  });
});
