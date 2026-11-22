import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom 未实现 Pointer Capture API，vaul Drawer 的 onPointerDown 会调
// setPointerCapture——缺它抛 uncaught TypeError 计入 vitest Errors 使进程退出码 1
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

afterEach(() => {
  cleanup();
});
