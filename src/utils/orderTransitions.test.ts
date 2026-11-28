import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCancelOrder,
  canTransitionOrderStatus,
  getAllowedNextStatuses,
  validateOrderCancellation,
} from './orderTransitions';

test('order state transition matrix enforces legal transitions', () => {
  assert.equal(canTransitionOrderStatus('pending_payment', 'paid'), true);
  assert.equal(canTransitionOrderStatus('paid', 'preparing'), true);
  assert.equal(canTransitionOrderStatus('preparing', 'shipped'), true);
  assert.equal(canTransitionOrderStatus('delivered', 'pending_payment'), false);
  assert.equal(canTransitionOrderStatus('cancelled', 'paid'), false);
  assert.equal(canTransitionOrderStatus('expired', 'shipped'), false);

  assert.deepEqual(getAllowedNextStatuses('paid'), ['paid', 'preparing', 'shipped']);
  assert.deepEqual(getAllowedNextStatuses('cancelled'), ['cancelled']);
});

test('order cancellation validation checks cancellable state and mandatory reason', () => {
  assert.equal(canCancelOrder('pending_payment'), true);
  assert.equal(canCancelOrder('paid'), true);
  assert.equal(canCancelOrder('preparing'), true);
  assert.equal(canCancelOrder('shipped'), false);
  assert.equal(canCancelOrder('delivered'), false);

  assert.ok(validateOrderCancellation('delivered', 'درخواست مشتری'));
  assert.ok(validateOrderCancellation('paid', 'لغو'));
  assert.equal(validateOrderCancellation('paid', 'درخواست مشتری قبل از ارسال'), null);
});
