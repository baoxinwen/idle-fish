/**
 * 平台判断：快捷键文案按平台显示（⌘K / Ctrl K）。
 * 仅用于展示层，不参与任何业务分支。
 */

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  // navigator.platform 已废弃但仍最稳；UA-CH 的 platform 只在 Secure Context 可靠
  const p = navigator.platform || '';
  return /Mac|iPhone|iPad|iPod/i.test(p);
}

/** 快捷键主修饰键符号：mac 显示 ⌘，其余平台显示 Ctrl */
export function modKeyLabel(): string {
  return isMac() ? '⌘' : 'Ctrl';
}
