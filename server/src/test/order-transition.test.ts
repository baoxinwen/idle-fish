/**
 * 订单状态机守卫测试（评审 SRV-I1）。
 * 缺陷：statusTransition 允许 ready→shipped 经 PATCH 直达——绕过 /ship 端点
 * 强制的快递单号/实付运费必填校验，订单进入 shipped 且 shipping 为 NULL，
 * 统计端读不到实付运费、静默回退估算利润。
 * 修复后：shipped 只能由 /ship 端点进入（先核对后发货），PATCH 状态机拒绝它。
 * UI 侧确认：order-detail-page 的 shipped 按钮走 ship 弹窗，不经 PATCH。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertOrderTransition, statusTransition } from '../lib/order-transition.js';
import { HttpError } from '../lib/http-error.js';

describe('assertOrderTransition（SRV-I1）', () => {
  it('ready → shipped 必须拒绝（发货核对必须走 /ship 端点）', () => {
    assert.throws(() => assertOrderTransition('ready', 'shipped'), HttpError);
  });

  it('shipped 只能由 /ship 进入：任何状态经 PATCH 到 shipped 都拒绝', () => {
    for (const from of ['pending', 'producing', 'ready', 'done', 'cancelled'] as const) {
      assert.throws(() => assertOrderTransition(from, 'shipped'), HttpError);
    }
  });

  it('合法正向流转与取消仍然放行', () => {
    assert.doesNotThrow(() => assertOrderTransition('pending', 'producing'));
    assert.doesNotThrow(() => assertOrderTransition('producing', 'ready'));
    assert.doesNotThrow(() => assertOrderTransition('ready', 'cancelled'));
    assert.doesNotThrow(() => assertOrderTransition('pending', 'cancelled'));
    assert.doesNotThrow(() => assertOrderTransition('producing', 'cancelled'));
    assert.doesNotThrow(() => assertOrderTransition('shipped', 'done'));
  });

  it('终态与非法回退拒绝', () => {
    assert.throws(() => assertOrderTransition('done', 'pending'), HttpError);
    assert.throws(() => assertOrderTransition('cancelled', 'producing'), HttpError);
    assert.throws(() => assertOrderTransition('pending', 'done'), HttpError);
    assert.throws(() => assertOrderTransition('shipped', 'cancelled'), HttpError);
  });

  it('statusTransition 表与 ship 端点语义对齐：ready 的合法后继不再含 shipped', () => {
    assert.equal(statusTransition.ready.includes('shipped' as never), false);
    assert.deepEqual(statusTransition.ready, ['cancelled']);
  });
});
