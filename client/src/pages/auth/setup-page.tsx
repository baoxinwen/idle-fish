/**
 * 首次设置页：创建唯一管理员账户（用户名 + 密码）。
 * 仅当尚无账户时可访问；已存在账户跳 /login。
 * 设置成功后自动登录并进首页。
 */

import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/page-loading';
import { useToast } from '@/components/toaster';
import { useAuthStore } from '@/store/auth-store';
import { setupSchema } from '@idlefish/shared';

export function SetupPage() {
  const { needsSetup, loaded, ensureLoaded, setup } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const [setupToken, setSetupToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  if (!loaded) return <PageLoading />;
  if (!needsSetup) return <Navigate to="/login" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setupToken.trim()) {
      toast('请填写 setup token');
      return;
    }
    // 客户端校验：用户名/密码长度 + 两次密码一致
    const parsed = setupSchema.safeParse({ username: username.trim(), password });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message || '参数不合法');
      return;
    }
    if (password !== confirm) {
      toast('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      await setup(username.trim(), password, setupToken.trim());
      navigate('/', { replace: true });
    } catch (err) {
      toast(`设置失败：${err}`);
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
          <h1 className="font-mono-display text-xl font-bold tracking-wide">初始化账户</h1>
          <p className="label-mono mt-1 text-xs text-muted-foreground">首次使用 · 创建管理员</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-xs text-muted-foreground">
            创建唯一管理员账户用于登录。设置完成后不再开放注册，请妥善保管密码。
          </p>
          <div className="space-y-1.5">
            <Label>Setup Token</Label>
            <Input
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="容器首次启动时随机生成"
            />
          </div>
          <div className="space-y-1.5">
            <Label>用户名</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="至少 2 个字符"
            />
          </div>
          <div className="space-y-1.5">
            <Label>密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="至少 8 位"
            />
          </div>
          <div className="space-y-1.5">
            <Label>确认密码</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="再次输入密码"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? '创建中…' : '创建账户并登录'}
          </Button>
        </form>
      </div>
    </div>
  );
}
