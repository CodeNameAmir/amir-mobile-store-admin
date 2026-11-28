import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInventoryValuation,
  validateCouponInput,
  validatePurchaseOrderInput,
  validateShippingMethodInput,
  validateSupplierInput,
} from './formatters';
import type { WarehouseStockItem } from '../types/admin';

test('validateCouponInput checks date ranges and usage limits', () => {
  const valid = validateCouponInput({
    code: 'SPRING1406',
    discountType: 'percent',
    discountValue: 15,
    maxDiscount: 500000,
    minOrderAmount: 2000000,
    isActive: true,
    startsAt: '2026-11-01T00:00:00Z',
    expiresAt: '2026-12-01T00:00:00Z',
    usageLimit: 100,
    perUserLimit: 1,
  });
  assert.deepEqual(valid, {});

  const invalidWindow = validateCouponInput({
    code: 'BADDATE',
    discountType: 'fixed',
    discountValue: 100000,
    minOrderAmount: 0,
    isActive: true,
    startsAt: '2026-12-10T00:00:00Z',
    expiresAt: '2026-12-01T00:00:00Z',
    usageLimit: 0,
    perUserLimit: -2,
  });
  assert.ok(invalidWindow.expiresAt);
  assert.ok(invalidWindow.usageLimit);
  assert.ok(invalidWindow.perUserLimit);
});

test('validateShippingMethodInput validates code, name, costs, and sort order', () => {
  assert.deepEqual(
    validateShippingMethodInput({
      code: 'express_tehran',
      nameFa: 'ارسال اکسپرس تهران',
      carrier: 'amir_courier',
      baseCostToman: 120000,
      freeAboveToman: 10000000,
      isExpress: true,
      isActive: true,
      sortOrder: 1,
    }),
    {}
  );

  const errs = validateShippingMethodInput({
    code: 'a',
    nameFa: 'ا',
    carrier: '',
    baseCostToman: -5000,
    freeAboveToman: -1,
    isExpress: false,
    isActive: true,
    sortOrder: 1.5,
  });
  assert.ok(errs.code);
  assert.ok(errs.nameFa);
  assert.ok(errs.baseCostToman);
  assert.ok(errs.freeAboveToman);
  assert.ok(errs.sortOrder);
});

test('validateSupplierInput and validatePurchaseOrderInput enforce required fields and line items', () => {
  assert.deepEqual(
    validateSupplierInput({
      nameFa: 'تامین موبایل پارس',
      phone: '02188776655',
      isActive: true,
    }),
    {}
  );

  const supErr = validateSupplierInput({
    nameFa: 'ا',
    phone: 'invalid-phone!!',
    isActive: true,
  });
  assert.ok(supErr.nameFa);
  assert.ok(supErr.phone);

  assert.deepEqual(
    validatePurchaseOrderInput({
      poNumber: 'PO-20261128-101',
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      items: [{ variantId: 'var-1', sku: 'APL-16-256', quantity: 5, unitCostToman: 80000000 }],
    }),
    {}
  );

  const poErr = validatePurchaseOrderInput({
    poNumber: 'P',
    supplierId: '',
    warehouseId: '',
    items: [],
  });
  assert.ok(poErr.poNumber);
  assert.ok(poErr.supplierId);
  assert.ok(poErr.warehouseId);
  assert.ok(poErr.items);
});

test('calculateInventoryValuation aggregates physical units and cost value accurately', () => {
  const stock: WarehouseStockItem[] = [
    {
      warehouseId: 'wh-1',
      warehouseCode: 'WH-THR',
      warehouseNameFa: 'انبار تهران',
      variantId: 'v-1',
      sku: 'SKU-1',
      productId: 'p-1',
      quantityOnHand: 4,
      reservedQty: 1,
      availableQty: 3,
      minStockAlert: 2,
      isLowStock: false,
    },
    {
      warehouseId: 'wh-1',
      warehouseCode: 'WH-THR',
      warehouseNameFa: 'انبار تهران',
      variantId: 'v-2',
      sku: 'SKU-2',
      productId: 'p-2',
      quantityOnHand: 2,
      reservedQty: 0,
      availableQty: 2,
      minStockAlert: 1,
      isLowStock: false,
    },
  ];

  const summary = calculateInventoryValuation(stock, {
    'v-1': 50000000,
    'v-2': null,
  });

  assert.equal(summary.totalOnHandUnits, 6);
  assert.equal(summary.totalReservedUnits, 1);
  assert.equal(summary.totalAvailableUnits, 5);
  assert.equal(summary.valuedRowsCount, 1);
  assert.equal(summary.missingCostRowsCount, 1);
  assert.equal(summary.totalInventoryCostToman, 200000000);
});
