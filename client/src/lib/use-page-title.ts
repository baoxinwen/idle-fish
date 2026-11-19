import { useEffect } from 'react';

/**
 * 每页设置 document.title。SPA 路由切换不会自动更新标题，
 * 标签页与读屏的「当前位置」都依赖它（better-accessibility 路由反馈）。
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · idle-fish`;
  }, [title]);
}
