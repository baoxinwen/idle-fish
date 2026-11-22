/**
 * PWA 产物断言（build 后置，见 package.json scripts.build）：
 * runtimeCaching 配置非法时 generateSW 会静默丢失路由甚至不产 sw.js，
 * 界面完全无感——只有对产物断言才能锁住（build 即拦截，不等测试）。
 */
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'dist', 'sw.js');
if (!fs.existsSync(swPath)) {
  console.error('[check-pwa] FAIL: dist/sw.js 未生成——generateSW 静默失败');
  process.exit(1);
}
const sw = fs.readFileSync(swPath, 'utf8');
const checks = {
  '快照缓存名（runtimeCaching 真正进了产物）': sw.includes('idle-fish-snapshot'),
  // sw.js 里正则被序列化为 \/api\/auth\/status$（斜杠带转义），不能按原样匹配
  '登录态探测快照（否则离线被弹去登录页）': sw.includes('/api\\/auth') && sw.includes('idle-fish-auth'),
  'NetworkFirst 策略': sw.includes('NetworkFirst'),
  'StaleWhileRevalidate 策略': sw.includes('StaleWhileRevalidate'),
  '3 秒弱网超时': /networkTimeoutSeconds:\s*3/.test(sw),
  '条目上限': /maxEntries:\s*30/.test(sw),
  '仅缓存 200': /statuses:\s*\[\s*200\s*\]/.test(sw),
  '导航回退 denylist /api/': sw.includes('denylist') && sw.includes('/api'),
  '过期参数嵌套（RegExp pattern 未被静默丢弃）': sw.includes('ExpirationPlugin'),
  // 弱网快照标记（PWA-I3）：内联 plugin 未被静默丢弃，页面侧才能区分实时/快照
  '快照响应标记头': sw.includes('x-idle-fish-snapshot'),
};
let fail = 0;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`[check-pwa] ${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
