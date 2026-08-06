/**
 * 鉴权页通用骨架：logo + 标题 + 副标题 + 表单容器。
 * login / setup 共用，避免重复。
 */

import type { ReactNode } from 'react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  onSubmit?: (e: React.FormEvent) => void;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, onSubmit, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <span className="font-mono-display text-lg font-bold text-accent">铝</span>
          </div>
          <h1 className="font-mono-display text-xl font-bold tracking-wide">{title}</h1>
          <p className="label-mono mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">{children}</form>
      </div>
    </div>
  );
}
