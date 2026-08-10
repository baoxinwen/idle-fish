/**
 * Toast 封装：底层用 sonner（Emil Kowalski），spring 动画 + 堆叠 + 滑动消除。
 * useToast 保持原有 selector 签名，调用点零改动。
 */

import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner';
import { useTheme } from 'next-themes';

interface ToastStoreLike {
  show: (message: string) => void;
}

/** 兼容原 useToast((s) => s.show) 调用方式，返回 sonner toast */
export function useToast<T>(selector?: (s: ToastStoreLike) => T): T {
  const store: ToastStoreLike = { show: (message: string) => sonnerToast(message) };
  return selector ? selector(store) : (store as unknown as T);
}

/** 全局 Toaster：跟随主题，移动端底部、PC 右上 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="top-center"
      richColors
      closeButton
    />
  );
}
