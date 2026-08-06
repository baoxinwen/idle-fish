import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AppLayout } from '@/components/app-layout';
import { RequireAuth } from '@/components/require-auth';
import { Toaster } from '@/components/toaster';
import { ConfirmHost } from '@/components/confirm-dialog';
import { PageLoading } from '@/components/page-loading';

// 路由级懒加载：three/recharts/xlsx 拆分到各自路由 chunk
const LoginPage = lazy(() => import('@/pages/auth/login-page').then((m) => ({ default: m.LoginPage })));
const SetupPage = lazy(() => import('@/pages/auth/setup-page').then((m) => ({ default: m.SetupPage })));
const QuoteListPage = lazy(() => import('@/pages/quote/quote-list-page').then((m) => ({ default: m.QuoteListPage })));
const QuoteEditorPage = lazy(() =>
  import('@/pages/quote/quote-editor-page').then((m) => ({ default: m.QuoteEditorPage })),
);
const OrderListPage = lazy(() => import('@/pages/order/order-list-page').then((m) => ({ default: m.OrderListPage })));
const OrderEditorPage = lazy(() =>
  import('@/pages/order/order-editor-page').then((m) => ({ default: m.OrderEditorPage })),
);
const OrderDetailPage = lazy(() =>
  import('@/pages/order/order-detail-page').then((m) => ({ default: m.OrderDetailPage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() => import('@/pages/settings/settings-page').then((m) => ({ default: m.SettingsPage })));

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoading />}>{children}</Suspense>
);

// data router：useBlocker（未保存修改提示）需要 data router
// /login、/setup 为公开路由；其余受 RequireAuth 保护
const router = createBrowserRouter([
  { path: '/login', element: <Lazy><LoginPage /></Lazy> },
  { path: '/setup', element: <Lazy><SetupPage /></Lazy> },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/quotes" replace /> },
      { path: '/quotes', element: <Lazy><QuoteListPage /></Lazy> },
      { path: '/quotes/new', element: <Lazy><QuoteEditorPage /></Lazy> },
      { path: '/quotes/:id', element: <Lazy><QuoteEditorPage /></Lazy> },
      { path: '/orders', element: <Lazy><OrderListPage /></Lazy> },
      { path: '/orders/new', element: <Lazy><OrderEditorPage /></Lazy> },
      { path: '/orders/:id', element: <Lazy><OrderDetailPage /></Lazy> },
      { path: '/orders/:id/edit', element: <Lazy><OrderEditorPage /></Lazy> },
      { path: '/dashboard', element: <Lazy><DashboardPage /></Lazy> },
      { path: '/settings', element: <Lazy><SettingsPage /></Lazy> },
      { path: '*', element: <Navigate to="/quotes" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <RouterProvider router={router} />
      <Toaster />
      <ConfirmHost />
    </ThemeProvider>
  );
}
