/**
 * 人民币大写金额转换测试（报价单「大写」行）。
 * 覆盖常规报价区间：角分零规则、跨节补零、整、纯角分。
 */

import { describe, it, expect } from 'vitest';
import { toCnyUppercase } from '@/lib/utils';

describe('toCnyUppercase', () => {
  it.each([
    [304.26, '叁佰零肆圆贰角陆分'],
    [100, '壹佰圆整'],
    [12000, '壹万贰仟圆整'],
    [1002.5, '壹仟零贰圆伍角'],
    [1002.05, '壹仟零贰圆零伍分'],
    [0.5, '伍角'],
    [0.06, '陆分'],
    [374.26, '叁佰柒拾肆圆贰角陆分'],
    [10300.6, '壹万零叁佰圆陆角'],
    [100000000, '壹亿圆整'],
    [100010300, '壹亿零壹万零叁佰圆整'],
  ])('%p → %p', (amount, expected) => {
    expect(toCnyUppercase(amount as number)).toBe(expected as string);
  });

  it('浮点脏值四舍五入到分（30.004 → 叁拾圆整）', () => {
    expect(toCnyUppercase(30.004)).toBe('叁拾圆整');
  });

  it('非有限值返回空串', () => {
    expect(toCnyUppercase(Number.NaN)).toBe('');
    expect(toCnyUppercase(Number.POSITIVE_INFINITY)).toBe('');
  });
});
