/**
 * parseNumberInput 策略纯函数测试（C-2 / I-4 的共用收敛层）。
 */

import { describe, it, expect } from 'vitest';
import { parseNumberInput } from '@/lib/number-input';

describe('parseNumberInput', () => {
  it('正常数值原样解析', () => {
    expect(parseNumberInput('12.5')).toBe(12.5);
    expect(parseNumberInput('0')).toBe(0);
    expect(parseNumberInput('-3')).toBe(-3);
    expect(parseNumberInput('1e2')).toBe(100);
  });

  it('空串/纯空白 → null（清空语义交由失焦收口，不实时提交 0）', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('  ')).toBeNull();
  });

  it('非有限值 → null（Infinity/NaN 不流入计价）', () => {
    expect(parseNumberInput('1e999')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
  });
});
