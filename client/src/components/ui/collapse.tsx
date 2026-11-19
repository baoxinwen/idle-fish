/**
 * 折叠容器（铁律7）：Grid 0fr→1fr 过渡实现丝滑折叠，免 JS 算高。
 * 收起态 visibility:hidden，隐藏内容不占焦点、不进读屏；展开时 visibility 立即恢复，
 * 收起时等过渡走完再隐藏，与高度动画自然衔接。
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function Collapse({ open, children, className }: CollapseProps) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,visibility] duration-300 ease-[cubic-bezier(0.215,0.61,0.355,1)]',
        open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
