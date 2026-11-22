/**
 * 请求日志中间件：记录每个 /api/* 请求的方法/路径/状态码/耗时/IP。
 * 跳过 /api/health（健康检查噪音）。不记录请求体（可能含密码）。
 */

import type { Request, Response, NextFunction } from 'express';
import { log } from './logger.js';

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  // 跳过健康检查
  if (req.path === '/api/health') {
    next();
    return;
  }
  const start = Date.now();
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.originalUrl || req.path;
    const ctx = { method: req.method, path, status: res.statusCode, ms: duration, ip };
    if (res.statusCode >= 500) {
      log.error('http', `${req.method} ${path} ${res.statusCode}`, ctx);
    } else if (res.statusCode >= 400) {
      log.warn('http', `${req.method} ${path} ${res.statusCode}`, ctx);
    } else {
      log.info('http', `${req.method} ${path} ${res.statusCode}`, ctx);
    }
  });

  next();
}
