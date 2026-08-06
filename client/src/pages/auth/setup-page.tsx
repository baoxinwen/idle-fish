/**
 * 首次设置页：创建唯一管理员账户（用户名 + 密码）。
 * 仅当尚无账户时可访问；已存在账户跳 /login。
 * 设置成功后自动登录并进首页。
 */

import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/page-loading';
import { AuthShell } from '@/components/auth/auth-shell';
import { useAuthStore } from '@/store/auth-store';
import { setupSchema } from '@idlefish/shared';

export function SetupPage() {
  const { needsSetup, loaded, ensureLoaded, setup } = useAuthStore();
  const navigate = useNavigate();
  const [setupToken, setSetupToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  if (!loaded) return <PageLoading />;
  if (!needsSetup) return <Navigate to="/login" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!setupToken.trim()) {
      setError('请填写 setup token');
      return;
    }
    const parsed = setupSchema.safeParse({ username: username.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || '参数不合法');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      await setup(username.trim(), password, setupToken.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(`设置失败：${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="初始化账户" subtitle="首次使用 · 创建管理员" onSubmit={handleSubmit}>
      <p className="text-xs text-muted-foreground">
        创建唯一管理员账户用于登录。设置完成后不再开放注册，请妥善保管密码。
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="setup-token">Setup Token</Label>
        <Input
          id="setup-token"
          value={setupToken}
          onChange={(e) => setSetupToken(e.target.value)}
          placeholder="容器首次启动时随机生成"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-username">用户名</Label>
        <Input
          id="setup-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="至少 2 个字符"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-password">密码</Label>
        <Input
          id="setup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="至少 8 位"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-confirm">确认密码</Label>
        <Input
          id="setup-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="再次输入密码"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" variant="accent" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? '创建中…' : '创建账户并登录'}
      </Button>
    </AuthShell>
  );
}
