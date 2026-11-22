/**
 * 配件配置页 C-2 回归测试（评审 CFL-I3）：默认数量/单价逐键输入小数。
 * 缺陷复现（与 accessory-row.tsx C-2 同构、该文件注释原文「"12.5" 落库成 5」）：
 * 键入 "." 时 number 输入把内容净化为 ""，toPrice("")=0 实时回写 store，
 * react-dom 把 0 写回 DOM 擦掉输入中的内容，最终 "12.5" 落库成 5——
 * 错误默认单价静默进入之后所有新建报价/订单。
 * 修复后：中间态不提交、不回写，完整值原样可输入（桌面 + 移动端两处）。
 *
 * 注：jsdom 不复现 number 输入的净化算法（"12." 读出仍是 "12."），为可靠
 * 触发缺陷，用 fireEvent.change 直接模拟浏览器 onChange 收到的净化序列：
 * 键入 "12.5" 实际产生 ['1','2','','12.5']（"." 的读出是 ""，"5" 完成时
 * 内部缓冲 "12."+"5" 恢复有效）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessoriesConfig } from '@/pages/settings/accessories-config';
import { useSettingsStore } from '@/store/settings-store';
import { DEFAULT_SETTINGS, type Settings } from '@idle-fish/shared';

function makeSettings(unitPrice: number): Settings {
  return {
    ...DEFAULT_SETTINGS,
    defaultAccessories: [
      { name: '合页', category: 'custom', defaultQuantity: 2, defaultUnitPrice: unitPrice },
    ],
  };
}

/** 桌面（aria-label）与移动端（htmlFor label）各渲染一份输入，各取其一 */
function getDesktopPriceInput() {
  return screen.getByLabelText('默认单价') as HTMLInputElement;
}
function getMobilePriceInput() {
  return screen.getByLabelText('单价') as HTMLInputElement;
}

/** 模拟浏览器键入 "12.5" 时 onChange 实际收到的净化序列 */
function typeThroughPurification(input: HTMLInputElement) {
  for (const value of ['1', '2', '', '12.5']) {
    fireEvent.change(input, { target: { value } });
  }
}

beforeEach(() => {
  useSettingsStore.setState({ settings: makeSettings(3), loaded: true, dirty: false });
});

describe('AccessoriesConfig 默认单价净化序列（CFL-I3）', () => {
  it('桌面端键入 "12.5"：store 落库 12.5，中间态不得出现 0', () => {
    const updateSpy = vi.spyOn(useSettingsStore.getState(), 'updateAccessory');
    render(<AccessoriesConfig />);

    typeThroughPurification(getDesktopPriceInput());

    const prices = updateSpy.mock.calls
      .map(([, patch]) => (patch as { defaultUnitPrice?: number }).defaultUnitPrice)
      .filter((v) => v !== undefined);
    expect(prices.at(-1)).toBe(12.5);
    expect(prices).not.toContain(0); // 中间态不得把 0 推给 store
    expect(getDesktopPriceInput().value).toBe('12.5'); // 输入不被擦除
  });

  it('移动端键入 "12.5"：store 落库 12.5，中间态不得出现 0', () => {
    const updateSpy = vi.spyOn(useSettingsStore.getState(), 'updateAccessory');
    render(<AccessoriesConfig />);

    typeThroughPurification(getMobilePriceInput());

    const prices = updateSpy.mock.calls
      .map(([, patch]) => (patch as { defaultUnitPrice?: number }).defaultUnitPrice)
      .filter((v) => v !== undefined);
    expect(prices.at(-1)).toBe(12.5);
    expect(prices).not.toContain(0);
    expect(getMobilePriceInput().value).toBe('12.5');
  });

  it('失焦清空输入：按清空语义收口为 0', () => {
    render(<AccessoriesConfig />);

    const input = getDesktopPriceInput();
    input.focus();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(useSettingsStore.getState().settings?.defaultAccessories[0].defaultUnitPrice).toBe(0);
  });
});
