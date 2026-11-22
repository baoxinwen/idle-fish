/**
 * 未保存修改提示：dirty 时拦截路由导航 + 浏览器刷新/关闭。
 * 用于报价/订单编辑页，防止误离开丢失输入。
 */

import { useEffect, useRef, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChanges(dirty: boolean, message = '有未保存的修改，确认离开？') {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // beforeunload 拦截：用 ref 而非 state，保存后 clearDirty 同步移除
  useEffect(() => {
    if (!dirtyRef.current) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, message]);

  // SPA 路由拦截（读 ref）
  const blocker = useBlocker(() => dirtyRef.current);

  // 保存后调用：同步清 dirty，使后续 navigate/beforeunload 不拦截
  const clearDirty = useCallback(() => {
    dirtyRef.current = false;
  }, []);

  return { blocker, clearDirty };
}
