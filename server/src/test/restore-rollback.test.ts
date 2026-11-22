/**
 * rollbackRestore 回滚决策测试（C-1）。
 * 用真实临时文件验证：复制中途失败时完好原库不得被残缺副本顶替。
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollbackRestore } from '../lib/restore-rollback.js';

let dir: string;
let dbPath: string;
let autoBackupPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'if-rollback-'));
  dbPath = join(dir, 'idle-fish.db');
  autoBackupPath = join(dir, 'idle-fish-before-restore-1.db');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('复制中途失败（autoBackupReady=false）：完好原库必须保留，残缺副本被清理', () => {
  writeFileSync(dbPath, 'ORIGINAL-INTACT');
  writeFileSync(autoBackupPath, 'PARTIAL'); // 模拟写了一半的副本

  rollbackRestore({ dbPath, autoBackupPath, autoBackupReady: false });

  assert.equal(readFileSync(dbPath, 'utf8'), 'ORIGINAL-INTACT', '原库内容不得被改动');
  assert.equal(existsSync(autoBackupPath), false, '残缺副本应被清理');
});

test('复制成功后替换失败（autoBackupReady=true）：用完整副本顶替 dbPath', () => {
  writeFileSync(dbPath, 'BROKEN-OR-REPLACED');
  writeFileSync(autoBackupPath, 'COMPLETE-BACKUP');

  rollbackRestore({ dbPath, autoBackupPath, autoBackupReady: true });

  assert.equal(readFileSync(dbPath, 'utf8'), 'COMPLETE-BACKUP');
  assert.equal(existsSync(autoBackupPath), false, '副本应被改名移走');
});

test('复制成功且原库已缺失（unlink+rename 降级中断）：副本回位为 dbPath', () => {
  writeFileSync(autoBackupPath, 'COMPLETE-BACKUP');

  rollbackRestore({ dbPath, autoBackupPath, autoBackupReady: true });

  assert.equal(existsSync(dbPath), true, 'dbPath 必须恢复存在');
  assert.equal(readFileSync(dbPath, 'utf8'), 'COMPLETE-BACKUP');
});

test('无自动备份（原库本不存在）：不抛错、不产生文件', () => {
  rollbackRestore({ dbPath, autoBackupPath: null, autoBackupReady: false });
  assert.equal(existsSync(dbPath), false);
});
