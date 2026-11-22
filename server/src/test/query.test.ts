/**
 * singleQueryParam 查询参数收口测试（I-1）。
 * Express 4 默认 qs 扩展解析会把重复参数/嵌套参数解析成数组/对象，
 * 直达 better-sqlite3 单占位符会抛 RangeError → 500；必须在边界收口为 400。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { singleQueryParam } from '../lib/query.js';

test('未提供该参数 → undefined', () => {
  assert.equal(singleQueryParam(undefined), undefined);
});

test('单字符串原样返回', () => {
  assert.equal(singleQueryParam('quoted'), 'quoted');
});

test('空字符串是合法单值（语义由下游处理）', () => {
  assert.equal(singleQueryParam(''), '');
});

test('数组形态（?status=a&status=b）→ null', () => {
  assert.equal(singleQueryParam(['a', 'b']), null);
});

test('对象形态（?status[b]=x）→ null', () => {
  assert.equal(singleQueryParam({ b: 'x' }), null);
});

test('数字等其他类型 → null', () => {
  assert.equal(singleQueryParam(1), null);
});
