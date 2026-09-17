/**
 * I-4 组件级回归测试：NumberField 非法中间态不得把 emptyValue(0) 实时提交，
 * 带尾小数点失焦不得用 0 覆盖原值。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from '@/components/number-field';

describe('NumberField（I-4）', () => {
  it('逐键输入 "12.5"：onChange 收到 12.5，过程中不得出现 0', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="运费" value={35.5} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('12.5');

    expect(onChange).toHaveBeenCalledWith(12.5);
    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it('清空后失焦：按 emptyValue(0) 收口（既有语义保持）', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="运费" value={35.5} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('{SelectAll}{Delete}');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('停在 "12."（非法中间态）失焦：不得提交 0，显示还原受控原值', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="运费" value={35.5} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('12.');

    onChange.mockClear();
    // jsdom 不实现 badInput（浏览器在 "12." 时为 true），手动模拟浏览器行为
    Object.defineProperty(input.validity, 'badInput', { get: () => true, configurable: true });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalledWith(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('35.5');
  });
});
