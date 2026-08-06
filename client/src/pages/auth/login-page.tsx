/**
 * 登录页：用户名 + 密码。未初始化时跳 /setup，已登录跳首页。
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/page-loading';
import { AuthShell } from '@/components/auth/auth-shell';
import { useAuthStore } from '@/store/auth-store';

export function LoginPage() {
  const { status, needsSetup, loaded, ensureLoaded, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  if (!loaded || status === 'loading') return <PageLoading />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch {
      // 内联错误（不区分用户名/密码错，统一提示）
      setError('用户名或密码错误');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="闲置鱼" subtitle="机柜报价 · 登录" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="login-username">用户名</Label>
        <Input
          id="login-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="用户名"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">密码</Label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="密码"
          aria-invalid={!!error}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button type="submit" variant="accent" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? '登录中…' : '登录'}
      </Button>
    </AuthShell>
  );
}
