/**
 * 系统「减弱动态效果」订阅。CSS 侧动效由 globals.css 的 @media 块统一关闭；
 * JS 侧动效（spring 数字、图表入场、3D 自转）用本 hook 判断。
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// matchMedia 并非处处可用（jsdom 未实现）：环境不支持时按「未开启减弱动态」处理
function queryReduced(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(queryReduced);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
