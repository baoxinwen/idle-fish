/**
 * 数字 spring 过渡 hook（Emil 风格物理感）。
 * 数值变化时用弹簧物理平滑过渡，而非瞬变。
 * 用 requestAnimationFrame 实现，无额外依赖。
 */

import { useEffect, useRef, useState } from 'react';

/** spring 参数：刚度/阻尼/质量，调出柔和回弹 */
const STIFFNESS = 170;
const DAMPING = 26;
const MASS = 1;

export function useSpringNumber(target: number): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const velocity = useRef(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;

    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.064); // 限步长防抖
      last = now;
      // spring 物理：F = -k*x - c*v
      const x = current.current - target;
      const accel = (-STIFFNESS * x - DAMPING * velocity.current) / MASS;
      velocity.current += accel * dt;
      current.current += velocity.current * dt;
      // 收敛判定
      if (Math.abs(current.current - target) < 0.01 && Math.abs(velocity.current) < 0.01) {
        current.current = target;
        setValue(target);
        return;
      }
      setValue(current.current);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return value;
}
