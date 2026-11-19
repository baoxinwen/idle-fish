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
  // 校验错误落在对应字段旁（toast 够不着出错位置）：new 挂新密码、confirm 挂确认框
  const [fieldErrors, setFieldErrors] = useState<{ new?: string; confirm?: string }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: { new?: string; confirm?: string } = {};
    if (newPassword.length < 8) {
      errors.new = '请使用至少 8 个字符';
    }
    if (newPassword !== confirm) {
      errors.confirm = '两次输入的新密码不一致，请重新输入';
    } else if (newPassword.length >= 8 && newPassword === oldPassword) {
      errors.new = '新密码不能与旧密码相同';
    }
    if (errors.new || errors.confirm) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
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
              <Label htmlFor="pw-old">旧密码</Label>
              <Input
                id="pw-old"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">新密码</Label>
              <Input
                id="pw-new"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.new) setFieldErrors((x) => ({ ...x, new: undefined }));
                }}
                autoComplete="new-password"
                placeholder="至少 8 位"
                aria-invalid={fieldErrors.new ? true : undefined}
                aria-describedby={fieldErrors.new ? 'pw-new-error' : undefined}
              />
              {fieldErrors.new && (
                <p id="pw-new-error" className="text-xs text-destructive">
                  {fieldErrors.new}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">确认新密码</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (fieldErrors.confirm) setFieldErrors((x) => ({ ...x, confirm: undefined }));
                }}
                autoComplete="new-password"
                aria-invalid={fieldErrors.confirm ? true : undefined}
                aria-describedby={fieldErrors.confirm ? 'pw-confirm-error' : undefined}
              />
              {fieldErrors.confirm && (
                <p id="pw-confirm-error" className="text-xs text-destructive">
                  {fieldErrors.confirm}
                </p>
              )}
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
