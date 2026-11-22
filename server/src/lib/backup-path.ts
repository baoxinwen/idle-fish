/**
 * 备份导出快照路径生成（评审 SRV-I2 抽为纯模块以便单测）。
 * 毫秒时间戳不足以区分并发的两个 GET /api/backup——同毫秒同名会让后发起的
 * backup() 覆写前者正在流式读取的文件，交付损坏备份。随机后缀保证并发唯一；
 * 保留 `_export-` 前缀与 `.tmp` 扩展（backup.ts 启动清扫按此匹配残留文件）。
 */

import { join } from 'node:path';
import { nanoid } from 'nanoid';

export function snapshotPathFor(dir: string): string {
  return join(dir, `_export-${Date.now()}-${nanoid(8)}.tmp`);
}
