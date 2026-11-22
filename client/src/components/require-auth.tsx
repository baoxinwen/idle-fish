/**
 * 路由守卫：包裹 AppLayout，未登录跳 /login，需首次设置跳 /setup。
 * loading 期间渲染 PageLoading，不跳转（避免闪 /login）。
 */

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { PageLoading } from './page-loading';
import { AuthLoadRetry } from './auth/auth-load-retry';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, needsSetup, loaded, loadError, ensureLoaded } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!loaded) ensureLoaded().catch(() => {});
  }, [loaded, ensureLoaded]);

  if (!loaded || status === 'loading') {
    // 失败态给出口（INF-I2 补全）：有 loadError 时渲染重试，不再无声卡加载
    return loadError ? <AuthLoadRetry /> : <PageLoading />;
  }
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
