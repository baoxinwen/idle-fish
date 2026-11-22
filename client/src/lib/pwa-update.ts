/**
 * PWA 更新策略（registerType: 'prompt'）：检测到新版本 → toast 常驻提示，
 * 用户点击「立即刷新」才让新 Service Worker 接管并重载页面。
 * 不用 autoUpdate 的原因：路由懒加载下自动接管后，旧页面请求已清理的旧
 * chunk 会白屏；手动刷新保证新旧代码不混跑。
 *
 * 三时机更新检查：PWA 装手机后页面长期驻留，仅靠加载时检查会漏掉发版
 * （回前台/定时都发现不了）。故注册后立即查 + visibilitychange 回前台查
 * + 每小时查；只在页面可见且在线时触发（后台标签页查了也白查，省电）。
 * 返回清理函数（SPA 常驻用不到，测试隔离用）。
 */

import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function setupPwaUpdate(): () => void {
  let cleanupTiming: (() => void) | undefined;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast('新版本已就绪', {
        description: '刷新后生效',
        action: { label: '立即刷新', onClick: () => updateSW(true) },
        duration: Infinity,
        id: 'pwa-update',
      });
    },
    onRegisteredSW(_url, registration) {
      const check = () => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) return;
        registration?.update().catch(() => {}); // 更新检查失败静默，不影响主应用
      };
      document.addEventListener('visibilitychange', check);
      const timer = window.setInterval(check, CHECK_INTERVAL_MS);
      check();
      cleanupTiming = () => {
        document.removeEventListener('visibilitychange', check);
        window.clearInterval(timer);
      };
    },
  });
  return () => cleanupTiming?.();
}
