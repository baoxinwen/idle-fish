/**
 * I-2 回归测试：保存后的第一次编辑必须置 dirty。
 * 缺陷：保存路径悬挂 justLoaded 标志（保存不改变 source 引用，effect 不会消费它），
 * 下一次编辑被当作「刚加载」吞掉 dirty，离开守卫失效、修改无提示丢失。
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDirtyTracking } from '@/lib/use-dirty-tracking';

describe('useDirtyTracking（I-2）', () => {
  it('保存后的第一次编辑：dirty 必须为 true', () => {
    const { result, rerender } = renderHook(({ src }) => useDirtyTracking(src), {
      initialProps: { src: { a: 1 } },
    });

    // 加载：下一次变化不算 dirty
    act(() => result.current.markLoaded());
    rerender({ src: { a: 2 } });
    expect(result.current.dirty).toBe(false);

    // 保存
    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);

    // 保存后的第一次编辑 → dirty 必须为 true（悬挂 justLoaded 会使其为 false）
    rerender({ src: { a: 3 } });
    expect(result.current.dirty).toBe(true);
  });

  it('加载后的首次变化不算 dirty；普通编辑置 dirty（既有语义保持）', () => {
    const { result, rerender } = renderHook(({ src }) => useDirtyTracking(src), {
      initialProps: { src: { a: 1 } },
    });

    act(() => result.current.markLoaded());
    rerender({ src: { a: 2 } });
    expect(result.current.dirty).toBe(false);

    // 普通编辑置 dirty
    rerender({ src: { a: 3 } });
    expect(result.current.dirty).toBe(true);
  });
});
