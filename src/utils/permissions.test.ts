import test from 'node:test';
import assert from 'node:assert/strict';
import type { AuthUser } from '../types/admin';
import {
  canAccessRoute,
  canViewFullSensitiveData,
  hasAnyPermission,
  hasExplicitRbacPermissions,
  hasPermission,
} from './permissions';

const makeAdmin = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'adm-1',
  email: 'admin@codenameamir.ir',
  fullName: 'مدیر آزمایشی',
  phone: '',
  nationalId: undefined,
  birthDate: undefined,
  newsletterOptIn: false,
  role: 'admin',
  emailVerified: true,
  twoFactorEnabled: true,
  hasPassword: true,
  createdAt: '2026-11-01T00:00:00Z',
  lastLoginAt: '2026-11-28T09:00:00Z',
  addresses: [],
  wishlist: [],
  ...overrides,
});

test('hasExplicitRbacPermissions detects granular permissions array', () => {
  assert.equal(hasExplicitRbacPermissions(makeAdmin()), false);
  assert.equal(hasExplicitRbacPermissions(makeAdmin({ permissions: [] })), false);
  assert.equal(
    hasExplicitRbacPermissions(makeAdmin({ permissions: ['orders.read'] })),
    true
  );
});

test('hasPermission enforces granular permissions, wildcard super_admin, and blocked accounts', () => {
  const legacyAdmin = makeAdmin();
  assert.equal(hasPermission(legacyAdmin, 'orders.cancel'), true);

  const blockedAdmin = makeAdmin({ isBlocked: true });
  assert.equal(hasPermission(blockedAdmin, 'dashboard.read'), false);

  const inactiveAdmin = makeAdmin({ isActive: false });
  assert.equal(hasPermission(inactiveAdmin, 'dashboard.read'), false);

  const customerUser = makeAdmin({ role: 'customer', permissions: ['*'] });
  assert.equal(hasPermission(customerUser, 'dashboard.read'), false);

  const warehouseManager = makeAdmin({
    roles: ['warehouse_manager'],
    permissions: ['dashboard.read', 'inventory.read', 'inventory.adjust', 'inventory.transfer'],
  });
  assert.equal(hasPermission(warehouseManager, 'inventory.transfer'), true);
  assert.equal(hasPermission(warehouseManager, 'orders.cancel'), false);
  assert.equal(hasAnyPermission(warehouseManager, ['payments.refund', 'inventory.read']), true);

  const superAdmin = makeAdmin({
    roles: ['super_admin'],
    permissions: ['dashboard.read'],
  });
  assert.equal(hasPermission(superAdmin, 'admins.manage'), true);
});

test('canViewFullSensitiveData respects sensitive_data.view_full when granular RBAC is active', () => {
  const supportAgent = makeAdmin({
    roles: ['support_agent'],
    permissions: ['dashboard.read', 'customers.read', 'support.manage'],
  });
  assert.equal(canViewFullSensitiveData(supportAgent), false);

  const complianceAdmin = makeAdmin({
    roles: ['support_agent'],
    permissions: ['dashboard.read', 'customers.read', 'sensitive_data.view_full'],
  });
  assert.equal(canViewFullSensitiveData(complianceAdmin), true);
});

test('canAccessRoute denies unauthorized granular RBAC routes', () => {
  const accountant = makeAdmin({
    roles: ['accountant'],
    permissions: ['dashboard.read', 'orders.read', 'payments.read', 'reports.read'],
  });
  assert.equal(canAccessRoute(accountant, '/'), true);
  assert.equal(canAccessRoute(accountant, '/payments'), true);
  assert.equal(canAccessRoute(accountant, '/reports'), true);
  assert.equal(canAccessRoute(accountant, '/products/new'), false);
  assert.equal(canAccessRoute(accountant, '/audit-logs'), false);
});
