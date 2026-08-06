/** 统一的加载与空态组件。 */

import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LoadingState({ text = '加载中…', className }: { text?: string; className?: string }) {
  return (
    <div className={cn('flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground', className)}>
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-accent" />
      {text}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  text,
  hint,
  actionLabel,
  onAction,
  variant = 'accent',
  className,
}: {
  icon?: LucideIcon;
  text: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'accent' | 'outline' | 'default';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary ring-1 ring-border">
          <Icon className="h-7 w-7 text-muted-foreground/50" />
        </div>
      )}
      <div className="text-sm font-medium text-foreground">{text}</div>
      {hint && <div className="mt-1.5 max-w-xs text-xs text-muted-foreground">{hint}</div>}
      {actionLabel && onAction && (
        <Button variant={variant} size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
