import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FileText, Package, BarChart3, Settings, LogOut, Menu, X } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { Button } from './ui/button';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/quotes', label: '报价', icon: FileText, code: 'QTE' },
  { to: '/orders', label: '订单', icon: Package, code: 'ORD' },
  { to: '/dashboard', label: '统计', icon: BarChart3, code: 'RPT' },
  { to: '/settings', label: '设置', icon: Settings, code: 'SET' },
];

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 移动端遮罩：抽屉打开时点击关闭 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 侧边导航：PC 固定显示；移动端抽屉（fixed 滑入） */}
      <aside
        className={cn(
          'flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200',
          // 移动端：fixed 定位，默认 translate 出屏幕外，打开时滑入
          'fixed inset-y-0 left-0 z-40 lg:static',
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 ring-1 ring-accent/30">
            <span className="font-mono-display text-sm font-bold text-accent">铝</span>
          </div>
          <div className="leading-tight">
            <div className="font-mono-display text-sm font-bold tracking-wide">闲鱼</div>
            <div className="label-mono text-[10px] text-sidebar-foreground/50">机柜报价</div>
          </div>
          {/* 移动端关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <div className="label-mono px-3 pb-2 pt-3 text-sidebar-foreground/40">主菜单</div>
          {navItems.map(({ to, label, icon: Icon, code }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/5 text-white'
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
                  <span
                    className={cn(
                      'font-mono-display text-[10px] tracking-wider transition-opacity',
                      isActive ? 'text-accent/80' : 'text-sidebar-foreground/30',
                    )}
                  >
                    {code}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/5 p-4">
          <div className="label-mono text-sidebar-foreground/40">铝型材机柜 · 报价工具</div>
          <div className="font-mono-display mt-1 text-[10px] text-sidebar-foreground/30">v0.1 · local</div>
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
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {/* 流程文案仅 PC 显示 */}
            <div className="label-mono hidden text-muted-foreground lg:block">
              报价 → 订单 → 生产 → 发货
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => useAuthStore.getState().logout()}
              title="登出"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background p-3 lg:p-6">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
