/**
 * 轻量 toast：自管理，避免引入额外依赖。
 */

import { create } from 'zustand';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function Toaster() {
  const { toasts } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
