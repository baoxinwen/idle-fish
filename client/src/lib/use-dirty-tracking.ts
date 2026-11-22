/**
 * 未保存修改跟踪（I-2：从报价/订单编辑器抽出的共用逻辑）。
 * baseline 是上次加载/保存的 source 快照，source 变化与之比较得出 dirty。
 *
 * 根因注记：保存路径必须用 markSaved()，不得 markLoaded()——保存不改变 source 引用，
 * [source] effect 不会执行，悬挂的 justLoaded 标志会把「保存后的第一次编辑」
 * 当作基线重置吞掉 dirty 标记，令离开守卫在每次保存后的第一次编辑上失效。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useDirtyTracking(source: unknown) {
  const baselineRef = useRef('');
  const justLoaded = useRef(false);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (justLoaded.current) {
      // 加载/重置后的首次 source 变化：更新 baseline，不算 dirty
      baselineRef.current = JSON.stringify(source);
      setDirty(false);
      justLoaded.current = false;
      return;
    }
    setDirty(JSON.stringify(source) !== baselineRef.current);
  }, [source]);

  /** 加载/重置后调用：下一次 source 变化视为新基线（不置 dirty） */
  const markLoaded = useCallback(() => {
    justLoaded.current = true;
  }, []);

  /** 保存后调用：当前 source 即新基线并清 dirty。
   *  不得在此置 justLoaded——保存不改变 source 引用，effect 不会执行来消费它，
   *  悬挂的标志会把保存后的第一次编辑吞成基线（I-2 缺陷）。 */
  const markSaved = useCallback(() => {
    baselineRef.current = JSON.stringify(sourceRef.current);
    setDirty(false);
  }, []);

  return { dirty, setDirty, markLoaded, markSaved };
}
