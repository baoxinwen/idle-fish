/**
 * 复制按钮（铁律 9/10）：复制成功图标切对勾并微弹（欠阻尼），2.5s 后自熄恢复。
 * 复制结果经 onResult 交还调用方（如 toast），按钮本身只负责视觉反馈。
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

const SELF_EXTINGUISH_MS = 2500;

interface CopyButtonProps {
  /** 点击时复制的文本 */
  getText: string;
  /** 无障碍名与初始 title */
  label: string;
  /** 初始态图标（如材料清单用 ClipboardList），默认 Copy */
  idleIcon?: LucideIcon;
  /** 复制结果回调（true = 成功） */
  onResult?: (ok: boolean) => void;
  className?: string;
}

export function CopyButton({
  getText,
  label,
  idleIcon: IdleIcon = Copy,
  onResult,
  className,
}: CopyButtonProps) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleClick() {
    const ok = await copyText(getText);
    onResult?.(ok);
    if (!ok) return;
    window.clearTimeout(timer.current);
    setDone(true);
    timer.current = window.setTimeout(() => setDone(false), SELF_EXTINGUISH_MS);
  }

  return (
    <button
      type="button"
      title={done ? '已复制' : label}
      aria-label={done ? '已复制' : label}
      onClick={handleClick}
      className={cn(
        // p-1.5 -m-1.5：视觉不变、命中区扩到 ~26px（2.5.8 基线 24px）
        'inline-flex items-center justify-center rounded p-1.5 -m-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong',
        done
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        className,
      )}
    >
      {done ? (
        <Check key="done" className="h-3.5 w-3.5 animate-check-pop" />
      ) : (
        <IdleIcon key="idle" className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
