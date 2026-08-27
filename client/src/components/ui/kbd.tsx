import { cn } from '@/lib/utils';

/** 快捷键徽标：等宽小号 + 边框底色，工程软件风格。 */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono-display text-[10px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
