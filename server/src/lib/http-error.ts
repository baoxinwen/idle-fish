/**
 * 路由层通用错误设施（第八轮 S-1/S-2）：
 *  - HttpError：带 HTTP 状态码的业务错误，事务内抛出、对外返回 message
 *  - asyncHandler：Express 4 不把 async handler 的 rejection 转发给错误中间件，
 *    未捕获的 promise rejection 会成为 unhandledRejection（Node ≥15 默认退出进程）。
 *    所有含 await 的路由 handler 必须用它包装。
 *  - sendTxError：事务错误统一响应——HttpError 按状态码回传 message，
 *    其余（SQL 约束等基础设施错误）一律 500 泛化文案，不向客户端泄露内部细节。
 */

import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 包装 async 路由处理器：rejection → next(err)，交给全局 errorHandler */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** 事务/业务错误统一响应（L4）：对外只暴露 HttpError 的 message，其余泛化 */
export function sendTxError(res: Response, e: unknown, fallback: string): void {
  if (e instanceof HttpError) {
    res.status(e.status).json({ error: e.message });
    return;
  }
  res.status(500).json({ error: fallback });
}
