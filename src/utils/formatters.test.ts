import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsv,
  computeDiscountPercent,
  formatPersianNumber,
  formatToman,
  isValidEmail,
  slugifyProductId,
  toEnglishDigits,
  toPersianDigits,
  validatePasswordStrength,
  validateProductInput,
  validateStockUpdate,
} from './formatters';
import type { ProductInput } from '../types/admin';

test('digit conversion handles Persian and Arabic digits cleanly', () => {
  assert.equal(toPersianDigits('123450'), '۱۲۳۴۵۰');
  assert.equal(toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(toEnglishDigits('١٢٣٤'), '1234');
});

test('formatToman and formatPersianNumber use Persian numerals and separators', () => {
  assert.equal(formatToman(94200000), '۹۴٬۲۰۰٬۰۰۰ تومان');
  assert.equal(formatToman(0, false), '۰');
  assert.equal(formatPersianNumber(-1250), '-۱٬۲۵۰');
});

test('slugifyProductId and computeDiscountPercent calculate accurately', () => {
  assert.equal(slugifyProductId('Apple iPhone 16 Pro Max!'), 'apple-iphone-16-pro-max');
  assert.equal(computeDiscountPercent(94_200_000, 98_000_000), 4);
  assert.equal(computeDiscountPercent(50_000_000, null), 0);
  assert.equal(computeDiscountPercent(50_000_000, 40_000_000), 0);
});

test('isValidEmail normalizes Persian digits and validates email format', () => {
  assert.equal(isValidEmail('admin@codenameamir.ir'), true);
  assert.equal(isValidEmail('user۱۲@gmail.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});

test('validateProductInput enforces required fields and price/stock constraints', () => {
  const validInput: ProductInput = {
    id: 'iphone-16-pro',
    slug: 'iphone-16-pro',
    nameFa: 'آیفون ۱۶ پرو',
    nameEn: 'Apple iPhone 16 Pro',
    brand: 'Apple',
    category: 'phones',
    price: 85_000_000,
    originalPrice: 89_000_000,
    discountPercent: 4,
    inStock: true,
    stockCount: 5,
    expressDelivery: true,
    warranty: '۱۸ ماهه امیر سرویس',
    badgeText: null,
    image: 'https://example.com/iphone.jpg',
    colorLabel: 'تیتانیوم طبیعی',
    colors: [],
    storageOptions: [],
    specs: {
      display: '',
      displayDetails: '',
      chipset: '',
      chipsetDetails: '',
      camera: '',
      cameraDetails: '',
      battery: '',
      batteryDetails: '',
      storageDefault: '۲۵۶ گیگابایت',
      ram: '۸ گیگ',
      os: 'iOS 18',
    },
    isFeaturedDeal: false,
    isPopular: true,
  };

  assert.deepEqual(validateProductInput(validInput), {});

  const invalidErrors = validateProductInput({
    ...validInput,
    id: 'Invalid ID!',
    price: 0,
    originalPrice: 500,
    stockCount: -1,
    nameFa: 'آ',
  });

  assert.ok(invalidErrors.id);
  assert.ok(invalidErrors.price);
  assert.ok(invalidErrors.stockCount);
  assert.ok(invalidErrors.nameFa);
});

test('validateStockUpdate and validatePasswordStrength catch bad inputs', () => {
  assert.equal(validateStockUpdate(12), null);
  assert.ok(validateStockUpdate(-3));
  assert.ok(validateStockUpdate(2.5));

  assert.equal(validatePasswordStrength('Admin1234'), null);
  assert.ok(validatePasswordStrength('short1'));
  assert.ok(validatePasswordStrength('NoDigitsHere'));
});

test('buildCsv prepends UTF-8 BOM and escapes commas, quotes, and formula prefixes', () => {
  const csv = buildCsv(['کد', 'نام'], [['=1+1', 'گوشی "پرچمدار", اپل']]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.match(csv, /'=1\+1/);
  assert.match(csv, /"گوشی ""پرچمدار"", اپل"/);
});
