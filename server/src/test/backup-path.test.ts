/**
 * 备份导出快照路径测试（评审 SRV-I2）。
 * 缺陷：`_export-${Date.now()}.tmp` 毫秒分辨率不足——两个并发 GET /api/backup
 * 同毫秒拿到同一路径，后者的 backup() 从头覆写前者正在流式读取的文件，
 * 下载到新旧交错的损坏备份（备份是数据安全的最后防线）。
 * 修复后：文件名带随机后缀，同毫秒并发不冲突。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPathFor } from '../lib/backup-path.js';
import { basename } from 'node:path';

describe('snapshotPathFor（SRV-I2）', () => {
  it('同一毫秒内两次生成不冲突（随机后缀）', () => {
    const a = snapshotPathFor('/data');
    const b = snapshotPathFor('/data');
    assert.notEqual(a, b);
  });

  it('命名保持 _export-<ts>-<random>.tmp 形态（启动清扫按前缀匹配依赖它）', () => {
    const name = basename(snapshotPathFor('/data'));
    assert.match(name, /^_export-\d+-[A-Za-z0-9_-]+\.tmp$/);
  });

  it('路径落在指定目录下', () => {
    const p = snapshotPathFor('/data');
    assert.ok(p.startsWith('/data') || p.startsWith('\\data') || p.includes('data'));
  });
});
