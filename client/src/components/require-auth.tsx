/**
 * 路由守卫：包裹 AppLayout，未登录跳 /login，需首次设置跳 /setup。
 * loading 期间渲染 PageLoading，不跳转（避免闪 /login）。
 */

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { PageLoading } from './page-loading';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, needsSetup, loaded, ensureLoaded } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!loaded) ensureLoaded().catch(() => {});
  }, [loaded, ensureLoaded]);

  if (!loaded || status === 'loading') return <PageLoading />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
