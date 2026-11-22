/**
 * 会话状态加载失败的重试出口（INF-I2 补全）：status 探测失败后页面停在
 * 加载态，此前没有任何 UI 反馈与重试入口——瞬时失败（网络抖动、Vite 依赖
 * 重优化期间的模块 504）会让用户永久卡「加载中」直到手动刷新。
 * RequireAuth / 登录页 / 初始化页三处共用。
 */

import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/states';
import { useAuthStore } from '@/store/auth-store';

export function AuthLoadRetry() {
  const loadError = useAuthStore((s) => s.loadError);
  const retryLoad = useAuthStore((s) => s.retryLoad);
  return (
    <EmptyState
      icon={AlertTriangle}
      text="加载失败"
      hint={`登录状态查询失败：${loadError ?? '未知错误'}`}
      actionLabel="重试"
      onAction={() => void retryLoad()}
      className="mt-10"
    />
  );
}
