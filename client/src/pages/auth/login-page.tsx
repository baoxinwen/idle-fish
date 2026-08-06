/**
 * 登录页：用户名 + 密码。未初始化时跳 /setup，已登录跳首页。
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/page-loading';
import { useToast } from '@/components/toaster';
import { useAuthStore } from '@/store/auth-store';

export function LoginPage() {
  const { status, needsSetup, loaded, ensureLoaded, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast((s) => s.show);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  if (!loaded || status === 'loading') return <PageLoading />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      toast(`登录失败：${err}`);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <span className="font-mono-display text-lg font-bold text-accent">铝</span>
          </div>
          <h1 className="font-mono-display text-xl font-bold tracking-wide">闲置鱼</h1>
          <p className="label-mono mt-1 text-xs text-muted-foreground">机柜报价 · 登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label>用户名</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="用户名"
            />
          </div>
          <div className="space-y-1.5">
            <Label>密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="密码"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? '登录中…' : '登录'}
          </Button>
        </form>
      </div>
    </div>
  );
}
