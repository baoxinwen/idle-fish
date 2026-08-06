/** 统一的加载与空态组件。 */

import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingState({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
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
}: {
  icon?: LucideIcon;
  text: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary ring-1 ring-border">
          <Icon className="h-7 w-7 text-muted-foreground/50" />
        </div>
      )}
      <div className="text-sm font-medium text-foreground">{text}</div>
      {hint && <div className="mt-1.5 max-w-xs text-xs text-muted-foreground">{hint}</div>}
      {actionLabel && onAction && (
        <Button variant="accent" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
