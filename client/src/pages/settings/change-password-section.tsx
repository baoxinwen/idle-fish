/**
 * 修改密码：需当前会话 + 旧密码校验。公网部署下支持密码轮换。
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/toaster';
import { authApi } from '@/lib/api';

export function ChangePasswordSection() {
  const toast = useToast((s) => s.show);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast('新密码至少 8 位');
      return;
    }
    if (newPassword !== confirm) {
      toast('两次输入的新密码不一致');
      return;
    }
    if (newPassword === oldPassword) {
      toast('新密码不能与旧密码相同');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword });
      toast('密码已修改');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      toast(`修改失败：${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">修改密码</CardTitle>
        <CardDescription>公网部署建议定期轮换管理员密码</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>旧密码</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="至少 8 位"
              />
            </div>
            <div className="space-y-1.5">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !oldPassword || !newPassword}>
              {saving ? '保存中…' : '修改密码'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
