/**
 * 日志模块：基于 winston + daily-rotate-file。
 *  - app.log：运行 + 操作（所有级别），同时输出控制台（docker logs 可见）
 *  - error.log：仅 error 级，便于快速排查
 *  - 轮转：单文件超 5MB 新建，保留最近 5 份
 *  - 目录：{dataDir}/logs/
 */

import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dataDir } from '../db/index.js';

const logsDir = join(dataDir, 'logs');
mkdirSync(logsDir, { recursive: true });

/** 上下文对象 → JSON 串（空则空串） */
function ctxStr(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return '';
  try {
    return ' ' + JSON.stringify(ctx);
  } catch {
    return '';
  }
}

/** 统一格式：[ISO] [级别] [类别] 消息 {ctx} */
const lineFormat = format.printf(({ timestamp, level, category, message, ctx }) => {
  return `[${timestamp}] [${level}] [${category}] ${message}${ctx ?? ''}`;
});

const baseFormat = format.combine(
  format.timestamp({ format: () => new Date().toISOString() }),
  format((info) => {
    info.category = info.category ?? 'app';
    return info;
  })(),
  lineFormat,
);

const consoleFormat = format.combine(
  format((info) => {
    info.category = info.category ?? 'app';
    return info;
  })(),
  format.colorize(),
  lineFormat,
);

export const logger = createLogger({
  level: 'info',
  format: baseFormat,
  transports: [
    // app.log：所有级别，轮转
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '5m',
      maxFiles: '5',
    }),
    // error.log：仅 error，轮转
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '5m',
      maxFiles: '5',
      level: 'error',
    }),
    // 控制台（docker logs 可见），开发 colorize
    new transports.Console({
      format: process.env.NODE_ENV === 'production' ? baseFormat : consoleFormat,
    }),
  ],
});

/** 便捷方法：带类别 + 上下文 */
export const log = {
  info: (category: string, message: string, ctx?: Record<string, unknown>) =>
    logger.info({ category, message, ctx: ctxStr(ctx) }),
  warn: (category: string, message: string, ctx?: Record<string, unknown>) =>
    logger.warn({ category, message, ctx: ctxStr(ctx) }),
  error: (category: string, message: string, ctx?: Record<string, unknown>) =>
    logger.error({ category, message, ctx: ctxStr(ctx) }),
};
