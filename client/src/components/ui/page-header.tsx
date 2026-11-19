import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  /** 标题下一行的说明文案；移动端隐藏与现状一致 */
  description?: React.ReactNode;
  /** 右侧操作区 */
  actions?: React.ReactNode;
  className?: string;
}

/** 页面头部统一组件：标题 + 描述 + 右侧动作区，替代各页手写的同名结构。 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-bold tracking-tight text-xl lg:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 hidden truncate text-sm text-muted-foreground sm:block">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
