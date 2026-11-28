import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomersCsv,
  classifyCustomerSegment,
  isTicketSlaOverdue,
  summarizeOrderStatuses,
} from './crmAndSla';
import type { AdminCustomerSummary } from '../types/admin';

test('classifyCustomerSegment categorizes VIP, returning, new, and blocked customers accurately', () => {
  assert.equal(classifyCustomerSegment({ ordersCount: 10, totalSpent: 500_000_000, isBlocked: true }).key, 'blocked');
  assert.equal(classifyCustomerSegment({ ordersCount: 1, totalSpent: 120_000_000 }).key, 'vip');
  assert.equal(classifyCustomerSegment({ ordersCount: 5, totalSpent: 25_000_000 }).key, 'vip');
  assert.equal(classifyCustomerSegment({ ordersCount: 2, totalSpent: 30_000_000 }).key, 'returning');
  assert.equal(classifyCustomerSegment({ ordersCount: 1, totalSpent: 10_000_000 }).key, 'new');
});

test('isTicketSlaOverdue flags unresolved tickets past due timestamp and ignores resolved tickets', () => {
  const now = Date.UTC(2026, 10, 28, 12, 0, 0);
  const past = new Date(now - 60_000).toISOString();
  const future = new Date(now + 60_000).toISOString();

  assert.equal(isTicketSlaOverdue({ status: 'open', slaDueAt: past }, now), true);
  assert.equal(isTicketSlaOverdue({ status: 'in_progress', slaDueAt: past }, now), true);
  assert.equal(isTicketSlaOverdue({ status: 'resolved', slaDueAt: past }, now), false);
  assert.equal(isTicketSlaOverdue({ status: 'open', slaDueAt: future }, now), false);
  assert.equal(isTicketSlaOverdue({ status: 'open', slaDueAt: null }, now), false);
});

test('buildCustomersCsv masks PII when includeFullPii is false and keeps full PII when true', () => {
  const sample: AdminCustomerSummary[] = [
    {
      id: 'u1',
      email: 'ali.rezaei@example.com',
      fullName: 'علی رضایی',
      phone: '09123456789',
      role: 'customer',
      emailVerified: true,
      twoFactorEnabled: false,
      newsletterOptIn: true,
      ordersCount: 6,
      totalSpent: 150_000_000,
      createdAt: '2026-01-01',
      lastLoginAt: '2026-11-28',
    },
  ];

  const maskedCsv = buildCustomersCsv(sample, false);
  assert.ok(!maskedCsv.includes('09123456789'));
  assert.ok(!maskedCsv.includes('ali.rezaei@example.com'));
  assert.ok(maskedCsv.includes('مشتری VIP'));

  const fullCsv = buildCustomersCsv(sample, true);
  assert.ok(fullCsv.includes('09123456789'));
  assert.ok(fullCsv.includes('ali.rezaei@example.com'));
});

test('summarizeOrderStatuses aggregates counts and revenue cleanly', () => {
  const summary = summarizeOrderStatuses([
    { status: 'delivered', totalAmount: 50_000_000 },
    { status: 'delivered', totalAmount: 30_000_000 },
    { status: 'cancelled', totalAmount: 10_000_000 },
  ]);
  assert.equal(summary[0].status, 'delivered');
  assert.equal(summary[0].count, 2);
  assert.equal(summary[0].revenue, 80_000_000);
});
