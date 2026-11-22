/**
 * 恢复失败的回滚（从 backup.ts 抽出，真实文件操作，可独立测试）。
 *
 * 背景（C-1）：恢复流程第 5 步 copyFileSync 制作「恢复前自动备份」，第 6 步用上传文件
 * 顶替 dbPath。回滚必须区分失败发生在哪一步——复制中途失败（磁盘满/IO 错误）时
 * dbPath 仍是完好原库、副本只是半截文件，绝不可删除原库、用残缺副本顶替。
 */

import { existsSync, renameSync, unlinkSync } from 'node:fs';

export interface RollbackInput {
  dbPath: string;
  /** 恢复前自动备份的目标路径；原库不存在时为 null */
  autoBackupPath: string | null;
  /** copyFileSync 是否成功完成。false = 复制中途失败，副本可能只是半截文件 */
  autoBackupReady: boolean;
}

export function rollbackRestore({ dbPath, autoBackupPath, autoBackupReady }: RollbackInput): void {
  // 备份不完整（复制中途失败）：失败发生在任何替换之前，dbPath 仍是完好原库——
  // 绝不可删除或顶替，只清理残缺副本（C-1 根因修复）。
  if (!autoBackupReady) {
    if (autoBackupPath) {
      try {
        unlinkSync(autoBackupPath);
      } catch {
        // 清理失败不影响回滚结果
      }
    }
    return;
  }
  // 备份完整：此刻 dbPath 才可能是被破坏/替换中断的目标，用副本顶替是安全的
  if (autoBackupPath && existsSync(autoBackupPath)) {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    renameSync(autoBackupPath, dbPath);
  }
}
