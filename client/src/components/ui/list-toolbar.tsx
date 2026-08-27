import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ListFilterOption<K extends string> {
  key: K;
  label: string;
}

interface ListToolbarProps<K extends string> {
  filters: ListFilterOption<K>[];
  active: K;
  onFilterChange: (key: K) => void;
  /** 受控搜索词；不传则不渲染搜索框 */
  query?: string;
  onQueryChange?: (q: string) => void;
  searchPlaceholder?: string;
  /** 右侧结果计数文案 */
  resultLabel?: string;
}

/** 列表页工具条：筛选 pills + 搜索框 + 结果计数，报价/订单列表共用。 */
export function ListToolbar<K extends string>({
  filters,
  active,
  onFilterChange,
  query,
  onQueryChange,
  searchPlaceholder = '搜索…',
  resultLabel,
}: ListToolbarProps<K>) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      {/* 筛选条：移动端横滚 */}
      <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={active === f.key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange(f.key)}
            className="shrink-0"
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {query !== undefined && onQueryChange && (
          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn('h-8 pl-8 text-xs')}
            />
          </div>
        )}
        {resultLabel && (
          <span className="label-mono shrink-0 text-[10px] text-muted-foreground/70">{resultLabel}</span>
        )}
      </div>
    </div>
  );
}
