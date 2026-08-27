/** 金额 spring 过渡：数值变化时弹簧平滑，而非瞬变。成本明细与移动端价格条共用。 */

import { useSpringNumber } from '@/lib/use-spring-number';
import { formatMoney } from '@/lib/utils';

export function SpringMoney({ value, className }: { value: number; className?: string }) {
  const spring = useSpringNumber(value);
  return <div className={className}>{formatMoney(spring)}</div>;
}
