/**
 * C-2 组件级回归测试：配件行「数量/单价」逐键输入小数。
 * 缺陷复现：键入 "12.5"——键入 "." 时 number 输入净化为 ""，受控组件 Number("")=0
 * 实时回写，react-dom 把 0 写回 DOM 擦掉输入中的内容，最终落库 5 而非 12.5。
 * 修复后：中间态不提交、不回写，完整值原样可输入。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessoryRow } from '@/components/quote-form/accessory-row';
import type { AccessoryItem } from '@idle-fish/shared';

const item: AccessoryItem = { name: '合页', category: 'custom', quantity: 2, unitPrice: 3 };

/** 桌面网格与移动端各渲染一份输入，取桌面区（aria-label 版） */
function getPriceInput() {
  return screen.getByLabelText('单价');
}
function getQuantityInput() {
  return screen.getByLabelText('数量');
}

describe('AccessoryRow NumCell（C-2）', () => {
  it('单价逐键输入 "12.5"：onChange 收到 12.5，输入框显示 12.5', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <AccessoryRow item={item} index={0} onUpdate={onUpdate} nameEditable showRemove={false} />,
    );
    const input = getPriceInput() as HTMLInputElement;
    await user.click(input);
    await user.keyboard('12.5');

    const unitPriceCalls = onUpdate.mock.calls
      .map(([, patch]) => (patch as Partial<AccessoryItem>).unitPrice)
      .filter((v) => v !== undefined);
    expect(unitPriceCalls.at(-1)).toBe(12.5);
    expect(unitPriceCalls).not.toContain(0); // 中间态不得把 0 推给计价
    expect(input.value).toBe('12.5');
  });

  it('数量逐键输入 "12.5"：经 toCount 整数语义收口为 12，且中间态不得出现 0', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <AccessoryRow item={item} index={0} onUpdate={onUpdate} nameEditable showRemove={false} />,
    );
    const input = getQuantityInput() as HTMLInputElement;
    await user.click(input);
    await user.keyboard('12.5');

    const quantityCalls = onUpdate.mock.calls
      .map(([, patch]) => (patch as Partial<AccessoryItem>).quantity)
      .filter((v) => v !== undefined);
    // 数量是整数语义（toCount 向下取整，schema 亦约束 int）：12.5 收口为 12，
    // 缺陷场景是中间态 0 回写擦除输入——此处只断言不出现 0 且终值正确
    expect(quantityCalls.at(-1)).toBe(12);
    expect(quantityCalls).not.toContain(0);
  });
});
