/**
 * Modal 封装：底层用 vaul（Emil Kowalski）。
 * 移动端：底部抽屉 + 拖拽关闭 + 橡皮筋物理。
 * PC：居中卡片 + spring 缩放进出。
 * 保持原 Modal props 接口，调用点零改动。
 */

import * as React from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            // 移动端：底部抽屉，圆角顶部
            // [&_::after]:hidden 去掉 vaul 内置的 ::after 伪元素（PC 居中时会产生白块）
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col overflow-hidden rounded-t-xl border bg-card shadow-xl outline-none [&_::after]:hidden',
            // PC：inset-0 + margin auto 居中（不用 transform，避免与 vaul 动画的 inline transform 冲突）
            'sm:inset-0 sm:m-auto sm:h-fit sm:w-full sm:max-w-md sm:rounded-xl',
            className,
          )}
        >
          {/* 移动端拖拽把手 */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted sm:hidden" />
          <div className="mb-4 flex items-center justify-between px-5 pt-4">
            <Drawer.Title className="text-base font-semibold">{title}</Drawer.Title>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-5">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
