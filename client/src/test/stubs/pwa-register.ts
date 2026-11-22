/**
 * virtual:pwa-register 的测试替身（vitest.config alias 指向本文件）。
 * 生产实现由 VitePWA 插件在 build 时生成，vitest 环境没有该插件，
 * 虚拟模块无法解析。__* 函数供测试驱动回调与捕获 updateSW 调用。
 */

type PwaHooks = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onRegisteredSW?: (url: string, registration?: ServiceWorkerRegistration) => void;
  onRegisterError?: (error: unknown) => void;
};

const state: {
  hooks?: PwaHooks;
  updateSW: (reloadPage?: boolean) => Promise<void>;
} = {
  updateSW: async () => {},
};

export function registerSW(cfg: PwaHooks = {}) {
  state.hooks = cfg;
  return (reloadPage?: boolean) => state.updateSW(reloadPage);
}

/** 测试驱动：模拟插件发现新版本 */
export function __triggerNeedRefresh() {
  state.hooks?.onNeedRefresh?.();
}

/** 测试驱动：模拟 SW 注册成功（三时机检查挂在这里） */
export function __triggerRegistered(registration?: ServiceWorkerRegistration) {
  state.hooks?.onRegisteredSW?.('/sw.js', registration);
}

/** 测试读取：断言传给 registerSW 的配置（如 immediate） */
export function __getHooks(): PwaHooks | undefined {
  return state.hooks;
}

/** 测试捕获：接管 updateSW 调用（断言「立即刷新」是否以 reload 语义调用） */
export function __setUpdateSW(fn: (reloadPage?: boolean) => Promise<void>) {
  state.updateSW = fn;
}

/** 测试隔离：清空 hooks 与 updateSW 捕获 */
export function __reset() {
  state.hooks = undefined;
  state.updateSW = async () => {};
}
