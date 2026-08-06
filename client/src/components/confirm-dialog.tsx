/**
 * 确认对话框：基于 Modal，替代原生 confirm()。
 */

import { useState, useCallback, useEffect } from 'react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

let confirmResolver: ((ok: boolean) => void) | null = null;
let confirmStateSetter: ((opts: ConfirmOptions | null) => void) | null = null;

/** 全局确认对话框，返回 Promise<boolean>。替代 window.confirm */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // 快速二次调用时，先 settle 上一个未决 Promise（默认取消），避免泄漏永不 resolve 的 Promise
    if (confirmResolver) confirmResolver(false);
    confirmResolver = resolve;
    confirmStateSetter?.(opts);
  });
}

export function ConfirmHost() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  const setOptsStable = useCallback((o: ConfirmOptions | null) => setOpts(o), []);

  // 挂载时注册 setter，卸载时注销：模块变量只在 effect 内修改，不在渲染期写
  useEffect(() => {
    confirmStateSetter = setOptsStable;
    return () => {
      confirmStateSetter = null;
    };
  }, [setOptsStable]);

  const handle = (ok: boolean) => {
    setOpts(null);
    confirmResolver?.(ok);
    confirmResolver = null;
  };

  return (
    <Modal open={!!opts} onClose={() => handle(false)} title={opts?.title ?? '确认'}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{opts?.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handle(false)}>
            {opts?.cancelLabel ?? '取消'}
          </Button>
          <Button
            variant={opts?.variant === 'destructive' ? 'destructive' : 'accent'}
            onClick={() => handle(true)}
          >
            {opts?.confirmLabel ?? '确认'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
