/**
 * 命令面板聚焦契约（评审 INF-C1）：⌘K 打开面板后搜索框必须自动持有焦点。
 * 缺陷：cmdk 不内置聚焦、组件也没加 autoFocus——焦点留在背景元素上，
 * 键入会直接写进背景表单（报价页按 ⌘K 后输数字会改掉报价），方向键/
 * Enter/Esc 全部失效，键盘用户无法使用面板。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, findByRole, queryByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  quotesApi: { list: vi.fn().mockResolvedValue([]) },
  ordersApi: { list: vi.fn().mockResolvedValue([]) },
}));

import { quotesApi } from '@/lib/api';
import { CommandPalette } from '@/components/command-palette';

// jsdom 未实现 ResizeObserver，cmdk 的 Command.List 依赖它
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
// jsdom 未实现 scrollIntoView，cmdk 选中项滚动依赖它
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function renderPalette() {
  return render(
    <MemoryRouter>
      {/* 背景表单输入：验证键入不再串扰 */}
      <input aria-label="背景输入" data-testid="bg-input" />
      <CommandPalette />
    </MemoryRouter>,
  );
}

function pressModK() {
  fireEvent.keyDown(window, { ctrlKey: true, key: 'k' });
}

async function findSearchInput() {
  // 注意：cmdk Input 同时有 aria-label 与自加的 aria-labelledby（指向空 label），
  // accname 规范下后者优先，按 name 查询会失败——用 role 查询（面板内唯一 combobox）
  return await findByRole(document.body, 'combobox');
}

beforeEach(() => {
  vi.mocked(quotesApi.list).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

describe('CommandPalette 聚焦（INF-C1）', () => {
  it('⌘K/Ctrl+K 打开后搜索框自动持有焦点', async () => {
    renderPalette();
    pressModK();

    const input = await findSearchInput();
    expect(document.activeElement).toBe(input);
  });

  it('背景输入持有焦点时 ⌘K 打开并夺焦：键入进入搜索框，不写入背景表单', async () => {
    const user = userEvent.setup();
    const { getByTestId } = renderPalette();

    const bg = getByTestId('bg-input') as HTMLInputElement;
    bg.focus();
    pressModK();

    const input = (await findSearchInput()) as HTMLInputElement;
    await user.keyboard('600x400');

    expect(input.value).toBe('600x400');
    expect(bg.value).toBe('');
  });

  it('Esc 关闭面板（焦点在搜索框内时）', async () => {
    const user = userEvent.setup();
    renderPalette();
    pressModK();

    await findSearchInput();
    await user.keyboard('{Escape}');
    expect(queryByRole(document.body, 'combobox')).toBeNull();
  });
});
