/**
 * 命令面板：⌘K / Ctrl+K 快速跳转（Emil Kowalski cmdk）。
 * 仅 PC 触发（移动端无键盘），不影响触屏操作。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { FileText, Package, BarChart3, Settings, Plus, Search } from 'lucide-react';

const COMMANDS = [
  { label: '新建报价', icon: Plus, action: 'nav', to: '/quotes/new' },
  { label: '新建订单', icon: Plus, action: 'nav', to: '/orders/new' },
  { label: '报价管理', icon: FileText, action: 'nav', to: '/quotes' },
  { label: '订单管理', icon: Package, action: 'nav', to: '/orders' },
  { label: '经营统计', icon: BarChart3, action: 'nav', to: '/dashboard' },
  { label: '设置', icon: Settings, action: 'nav', to: '/settings' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // ⌘K / Ctrl+K 切换
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <Command
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-xl"
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            placeholder="搜索命令…"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">无匹配命令</Command.Empty>
          {COMMANDS.map((c) => {
            const Icon = c.icon;
            return (
              <Command.Item
                key={c.label}
                value={c.label}
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
        </Command.List>
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          ⌘K 打开/关闭 · ↑↓ 选择 · Enter 执行 · Esc 关闭
        </div>
      </Command>
    </div>
  );
}
