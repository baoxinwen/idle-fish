import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FileText, Package, BarChart3, Settings, LogOut, Menu, X, Search } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette } from './command-palette';
import { Button } from './ui/button';
import { Kbd } from './ui/kbd';
import { useAuthStore } from '@/store/auth-store';
import { modKeyLabel } from '@/lib/platform';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/quotes', label: '报价', icon: FileText },
  { to: '/orders', label: '订单', icon: Package },
  { to: '/dashboard', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
];

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  // Escape 关闭移动抽屉（APG：Escape 关闭浮层）
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* 移动端遮罩：抽屉打开时点击关闭（装饰层，关闭有 X 按钮与 Escape 两条键盘路径） */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-sidebar/45 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 侧边导航：PC 固定显示；移动端抽屉（fixed 滑入）。
          关闭态 visibility:hidden 逐出 Tab 序与读屏树——仅 translate 会让焦点丢失到屏幕外；
          visibility 走 transition 离散插值，收起动画走完才隐藏（与 Collapse 同一手法） */}
      <aside
        className={cn(
          'flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-[transform,visibility] duration-200',
          // 移动端：fixed 定位，默认 translate 出屏幕外，打开时滑入
          'fixed inset-y-0 left-0 z-40 lg:static lg:visible',
          drawerOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 ring-1 ring-accent/30">
            <span className="font-mono-display text-sm font-bold text-accent">铝</span>
          </div>
          <div className="leading-tight">
            <div className="font-mono-display text-sm font-bold tracking-wide">闲鱼</div>
            <div className="label-mono text-[10px] text-sidebar-foreground/60">机柜报价</div>
          </div>
          {/* 移动端关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground lg:hidden"
            aria-label="关闭菜单"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <div className="label-mono px-3 pb-2 pt-3 text-sidebar-foreground/60">主菜单</div>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/5 text-sidebar-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* 暖金竖条选中标记 */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                  )}
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/5 p-4">
          <div className="label-mono text-sidebar-foreground/60">铝型材机柜 · 报价工具</div>
          <div className="font-mono-display mt-1 text-[10px] text-sidebar-foreground/60">
            v0.1 · local
          </div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* 移动端 hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="打开菜单"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* ⌘K 命令面板触发（PC） */}
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 text-muted-foreground lg:flex"
              onClick={() =>
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
              }
            >
              <Search className="h-3.5 w-3.5" />
              搜索
              <Kbd>{modKeyLabel()} K</Kbd>
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => useAuthStore.getState().logout()}
              aria-label="登出"
              title="登出"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background p-3 [scroll-padding-top:5rem] lg:p-6">
          <div key={pathname} className="page-enter mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ⌘K 命令面板（PC 效率） */}
      <CommandPalette />
    </div>
  );
}
