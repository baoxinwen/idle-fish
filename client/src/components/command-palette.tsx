/**
 * 命令面板：⌘K / Ctrl+K 快速跳转（Emil Kowalski cmdk）。
 * v2：除固定命令外，打开时拉取最近的报价与订单，支持按编号/客户/尺寸模糊直达详情。
 * 仅 PC 触发（移动端无键盘），不影响触屏操作。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { FileText, Package, BarChart3, Settings, Plus, Search } from 'lucide-react';
import { quotesApi, ordersApi } from '@/lib/api';
import { modKeyLabel } from '@/lib/platform';
import { COLOR_LABEL } from '@/lib/status';

const COMMANDS = [
  { label: '新建报价', icon: Plus, to: '/quotes/new' },
  { label: '新建订单', icon: Plus, to: '/orders/new' },
  { label: '报价管理', icon: FileText, to: '/quotes' },
  { label: '订单管理', icon: Package, to: '/orders' },
  { label: '经营统计', icon: BarChart3, to: '/dashboard' },
  { label: '设置', icon: Settings, to: '/settings' },
];

interface PaletteRecord {
  id: string;
  /** 主显示文案（编号） */
  primary: string;
  /** 右侧次文案（尺寸或客户名） */
  secondary: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // 记录索引：首次打开时拉取并缓存（单用户量级，50 条足够新近命中）
  const [recentQuotes, setRecentQuotes] = useState<PaletteRecord[] | null>(null);
  const [recentOrders, setRecentOrders] = useState<PaletteRecord[] | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open || recentQuotes !== null) return;
    let cancelled = false;
    Promise.all([quotesApi.list(), ordersApi.list()])
      .then(([qs, os]) => {
        if (cancelled) return;
        setRecentQuotes(
          qs.slice(0, 30).map((q) => ({
            id: q.id,
            primary: q.quoteNo,
            secondary: `${q.input.size.width}×${q.input.size.depth}×${q.input.size.height} · ${COLOR_LABEL[q.input.color]}`,
          })),
        );
        setRecentOrders(
          os.slice(0, 30).map((o) => ({
            id: o.id,
            primary: o.orderNo,
            secondary: o.customer.name || '—',
          })),
        );
      })
      .catch(() => {
        // 拉取失败静默降级为纯命令面板
        setRecentQuotes([]);
        setRecentOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, recentQuotes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-xl"
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            placeholder="搜索命令 / 报价编号 / 订单号 / 客户…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Command.List className="max-h-[380px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">无匹配结果</Command.Empty>

          {(recentQuotes?.length ?? 0) > 0 && (
            <Command.Group heading={<span className="label-mono px-3 py-1 text-[10px] text-muted-foreground">报价</span>}>
              {recentQuotes!.map((r) => (
                <PaletteItem
                  key={r.id}
                  icon={FileText}
                  record={r}
                  onSelect={() => {
                    setOpen(false);
                    navigate(`/quotes/${r.id}`);
                  }}
                />
              ))}
            </Command.Group>
          )}

          {(recentOrders?.length ?? 0) > 0 && (
            <Command.Group heading={<span className="label-mono px-3 py-1 text-[10px] text-muted-foreground">订单</span>}>
              {recentOrders!.map((r) => (
                <PaletteItem
                  key={r.id}
                  icon={Package}
                  record={r}
                  onSelect={() => {
                    setOpen(false);
                    navigate(`/orders/${r.id}`);
                  }}
                />
              ))}
            </Command.Group>
          )}

          <Command.Group heading={<span className="label-mono px-3 py-1 text-[10px] text-muted-foreground">命令</span>}>
            {COMMANDS.map((c) => {
              const Icon = c.icon;
              return (
                <Command.Item
                  key={c.label}
                  value={`cmd-${c.label}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate(c.to);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {c.label}
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
        <div className="border-t px-3 py-2 font-mono-display text-[10px] text-muted-foreground">
          {modKeyLabel()}+K 打开/关闭 · ↑↓ 选择 · Enter 执行 · Esc 关闭
        </div>
      </Command>
    </div>
  );
}

function PaletteItem({
  icon: Icon,
  record,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  record: PaletteRecord;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      // value 参与模糊匹配：编号 + 次文案（客户/尺寸）都可命中
      value={`${record.primary} ${record.secondary}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="font-mono-display tabular">{record.primary}</span>
      <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{record.secondary}</span>
    </Command.Item>
  );
}
