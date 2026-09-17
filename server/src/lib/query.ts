/**
 * 查询参数取单值（I-1）。
 * Express 4 默认 qs 扩展解析：`?status=a&status=b` 得到 string[]、`?status[b]=x` 得到对象，
 * 这类聚合形态直达 better-sqlite3 单占位符会抛 RangeError → 500。此处统一在边界收口。
 */

/** undefined = 未提供；string = 合法单值；null = 非法形态（调用方应回 400） */
export function singleQueryParam(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : null;
}
