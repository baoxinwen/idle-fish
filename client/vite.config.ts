import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json') as { version: string };

// 弱网快照防御：条目上限防无界、一周兜底过期、错误响应绝不进缓存。
// 注意 expiration 必须是 options 的子对象（workbox-build schema：平铺的
// maxEntries/maxAgeSeconds 会被 ajv 拒绝，build 静默失败不产 sw.js）
const SNAPSHOT_EXPIRATION = {
  expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 3600 },
};
const SNAPSHOT_CACHEABLE = { cacheableResponse: { statuses: [200] } };

export default defineConfig({
  plugins: [
    react(),
    // PWA：手机「安装到主屏幕」= manifest + Service Worker（需 HTTPS 访问，
    // 局域网 http 直访装不了是浏览器限制）。prompt：新版本就绪后 toast 提示
      // 手动刷新——本项目路由懒加载，自动接管会让旧页面请求已被清理的旧
      // chunk 而白屏；核心读接口走弱网快照（见下），写操作永远实时。
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '闲鱼机柜报价',
        short_name: '闲鱼',
        description: '铝型材机柜报价工具：报价、订单、生产、发货与经营统计',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0b0a',
        theme_color: '#0b0b0a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // navigateFallback：SPA 非资源路径全部回退 index.html（深度链接刷新不 404）；
        // denylist 排除 API——地址栏直开 /api/* 应得 JSON/404 而非 HTML
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true, // 发版自动清旧预缓存（显式，不赌默认值）
        clientsClaim: true, // 首次安装后立即接管当前页面，不等下次刷新
        // 弱网快照（国外中转，国内访问慢）：核心读接口失败/超时回退到上次
        // 成功响应。缓存范围（准确表述）：三条 GET 读接口——/api/auth/status、
        // /api/settings、/api/(quotes|orders|stats)；写操作与其余 /api/auth/*
        // （login/setup/logout/password）不在 pattern 内，永远走实时。
        // workbox 路由语义（源码证实）：字符串 pattern = 相对 SW 地址解析后
        // 的 URL 完全相等匹配（'*' 不是通配符，永不匹配）；RegExp = 对完整
        // href 执行正则（同源时任意位置命中）。故必须用不带 ^ 锚的 RegExp。
        runtimeCaching: [
          {
            // 登录态探测：离线时回上次在线的 authenticated=true，否则
            // RequireAuth 会把离线用户弹去登录页，快照页根本进不去。
            // 真权威是 cookie——session 被删后写操作仍会失败并诚实报错。
            // 独立缓存名：单 URL，不与业务快照共享 30 条 LRU 名额（重度
            // 浏览用户离线冷启动时登录态快照不会被挤出，评审 PWA-M4）。
            // 过期登录态由页面侧在登出/401/登录成功时删除整缓存兜底
            // （lib/snapshot-cache.ts，评审 PWA-C1/PWA-I1）。
            urlPattern: /\/api\/auth\/status$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'idle-fish-auth',
              expiration: { maxEntries: 1, maxAgeSeconds: 7 * 24 * 3600 },
              ...SNAPSHOT_CACHEABLE,
            },
          },
          {
            // 计价参数几乎不变：秒回缓存 + 后台静默更新
            urlPattern: /\/api\/settings$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'idle-fish-snapshot', ...SNAPSHOT_EXPIRATION, ...SNAPSHOT_CACHEABLE },
          },
          {
            // 报价/订单（列表+详情，含 ?status=/?q= 查询参数）与统计：
            // 实时优先，3 秒超时回快照。
            // 快照标记（评审 PWA-I3）：cacheWillUpdate 在响应写缓存前执行，
            // 返回改写后的 Response 进缓存（与 CacheableResponsePlugin 链式
            // 兼容）——网络成功透传给页面的响应不带标记，超时回退读到的缓存
            // 响应带 x-idle-fish-snapshot，api.ts 据此驱动弱网提示条。
            // 注：generateSW 的 plugin 白名单不含 cacheWillPutResponse（ajv
            // 直接拒绝 build），cacheWillUpdate 是唯一可用钩子；产物由
            // check-pwa.cjs 断言兜底。SWR 两路（auth/status、settings）秒回
            // 缓存是设计行为，不标记不提示。
            urlPattern: /\/api\/(quotes|orders|stats)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'idle-fish-snapshot',
              networkTimeoutSeconds: 3,
              ...SNAPSHOT_EXPIRATION,
              ...SNAPSHOT_CACHEABLE,
              plugins: [
                {
                  cacheWillUpdate: async ({ response }) => {
                    if (!response || response.status !== 200) return response;
                    // clone 读数据、原流留给页面透传；重建带标记的 Response 进缓存
                    const data = await response.clone().arrayBuffer();
                    const headers = new Headers(response.headers);
                    headers.set('x-idle-fish-snapshot', '1');
                    return new Response(data, {
                      status: response.status,
                      statusText: response.statusText,
                      headers,
                    });
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  // 侧栏版本号从 package.json 注入，不再硬编码（发版升版本自动跟随）
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/api': {
        // 本机 3000 可能被常驻软件占用（如京东金融占 127.0.0.1:3000），可用
        // VITE_PROXY_TARGET 覆盖（配合 server 的 PORT），不影响默认值
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
