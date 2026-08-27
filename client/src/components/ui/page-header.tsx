import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** 顶部分类标签（label-mono 小字，如 QUOTES · 报价） */
  eyebrow?: string;
  title: React.ReactNode;
  /** 标题下一行的说明文案；移动端隐藏与现状一致 */
  description?: React.ReactNode;
  /** 右侧操作区 */
  actions?: React.ReactNode;
  className?: string;
}

/** 页面头部统一组件：eyebrow + 标题 + 描述 + 右侧动作区，替代各页手写的同名结构。 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="label-mono text-accent">{eyebrow}</div>}
        <h1 className={cn('font-bold tracking-tight text-xl lg:text-2xl', eyebrow && 'mt-1')}>{title}</h1>
        {description && (
          <p className="mt-1 hidden truncate text-sm text-muted-foreground sm:block">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
