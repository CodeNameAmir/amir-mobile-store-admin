import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCategoryTreeList,
  buildCsv,
  calculateProfitMargin,
  computeDiscountPercent,
  formatPersianNumber,
  formatToman,
  generateIdempotencyKey,
  isValidEmail,
  slugifyProductId,
  toEnglishDigits,
  toPersianDigits,
  validateAttributeInput,
  validateBrandInput,
  validateCategoryInput,
  validatePasswordStrength,
  validateProductInput,
  validateStockMovementInput,
  validateStockUpdate,
  validateVariantInput,
  validateWarehouseInput,
  validateWarrantyInput,
} from './formatters';
import type { CategoryItem, ProductInput } from '../types/admin';

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

test('calculateProfitMargin computes profit and margin percentage accurately', () => {
  assert.deepEqual(calculateProfitMargin(100_000_000, 80_000_000), {
    profitToman: 20_000_000,
    marginPercent: 20,
  });
  assert.deepEqual(calculateProfitMargin(50_000_000, 55_000_000), {
    profitToman: -5_000_000,
    marginPercent: -10,
  });
  assert.equal(calculateProfitMargin(50_000_000, null), null);
  assert.equal(calculateProfitMargin(50_000_000, 0), null);
});

test('generateIdempotencyKey generates unique UUID v4 strings', () => {
  const k1 = generateIdempotencyKey();
  const k2 = generateIdempotencyKey();
  assert.notEqual(k1, k2);
  assert.match(k1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('buildCategoryTreeList orders nested categories by sortOrder and handles exclusion safely', () => {
  const cats: CategoryItem[] = [
    {
      id: 'cat-2',
      label: 'لوازم جانبی',
      titleEn: 'Accessories',
      slug: 'accessories',
      subtitle: '',
      descriptionFa: '',
      iconName: 'Headphones',
      parentId: null,
      image: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 2,
      isActive: true,
    },
    {
      id: 'cat-1',
      label: 'گوشی موبایل',
      titleEn: 'Phones',
      slug: 'phones',
      subtitle: '',
      descriptionFa: '',
      iconName: 'Smartphone',
      parentId: null,
      image: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 'cat-1-a',
      label: 'آیفون',
      titleEn: 'iPhone',
      slug: 'iphone',
      subtitle: '',
      descriptionFa: '',
      iconName: 'Smartphone',
      parentId: 'cat-1',
      image: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 1,
      isActive: true,
    },
  ];

  const tree = buildCategoryTreeList(cats);
  assert.deepEqual(
    tree.map((n) => [n.category.id, n.depth]),
    [
      ['cat-1', 0],
      ['cat-1-a', 1],
      ['cat-2', 0],
    ]
  );

  const filtered = buildCategoryTreeList(cats, 'cat-1');
  assert.deepEqual(
    filtered.map((n) => n.category.id),
    ['cat-2', 'cat-1-a']
  );
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

test('V3 entity validators catch invalid inputs cleanly', () => {
  assert.deepEqual(
    validateCategoryInput({
      label: 'گوشی هوشمند',
      titleEn: 'Smartphones',
      slug: 'smartphones',
      subtitle: '',
      descriptionFa: '',
      iconName: 'Smartphone',
      parentId: null,
      image: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 1,
      isActive: true,
    }),
    {}
  );
  assert.ok(
    validateCategoryInput({
      label: 'گ',
      titleEn: '',
      slug: 'Bad Slug',
      subtitle: '',
      descriptionFa: '',
      iconName: 'Folder',
      parentId: null,
      image: '',
      seoTitle: '',
      seoDescription: '',
      sortOrder: 1.5,
      isActive: true,
    }).slug
  );

  assert.deepEqual(
    validateBrandInput({
      name: 'Apple',
      labelFa: 'اپل',
      slug: 'apple',
      logoUrl: '',
      websiteUrl: '',
      isFeatured: true,
      isActive: true,
    }),
    {}
  );
  assert.ok(
    validateBrandInput({
      name: 'A',
      labelFa: '',
      slug: 'Apple!',
      logoUrl: '',
      websiteUrl: '',
      isFeatured: false,
      isActive: true,
    }).name
  );

  assert.deepEqual(
    validateWarrantyInput({
      providerName: '۱۸ ماهه جامع امیر سرویس + کد همتا',
      durationMonths: 18,
      coverageFa: 'پوشش کامل',
      termsUrl: '',
      isActive: true,
    }),
    {}
  );
  assert.ok(
    validateWarrantyInput({
      providerName: 'گ',
      durationMonths: -5,
      coverageFa: '',
      termsUrl: '',
      isActive: true,
    }).durationMonths
  );

  assert.deepEqual(
    validateAttributeInput({
      code: 'screen_size',
      nameFa: 'اندازه صفحه‌نمایش',
      nameEn: 'Screen Size',
      dataType: 'number',
      unit: 'اینچ',
      isFilterable: true,
      sortOrder: 1,
      categoryIds: [],
    }),
    {}
  );
  assert.ok(
    validateAttributeInput({
      code: 'Screen-Size',
      nameFa: 'ا',
      nameEn: '',
      dataType: 'text',
      unit: '',
      isFilterable: false,
      sortOrder: 1,
      categoryIds: [],
    }).code
  );

  assert.deepEqual(
    validateVariantInput({
      sku: 'APL-16PM-256-ZAA',
      barcode: '',
      partNumber: 'ZA/A',
      colorNameFa: 'مشکی',
      colorNameEn: 'Black',
      colorHex: '#000000',
      storage: '256GB',
      ram: '8GB',
      simType: 'دو سیم‌کارت',
      warrantyId: 'war-1',
      priceToman: 90_000_000,
      originalPriceToman: 95_000_000,
      costPriceToman: 82_000_000,
      isPublished: true,
    }),
    {}
  );
  assert.ok(
    validateVariantInput({
      sku: '',
      barcode: '',
      partNumber: '',
      colorNameFa: '',
      colorNameEn: '',
      colorHex: '',
      storage: '',
      ram: '',
      simType: '',
      warrantyId: null,
      priceToman: 0,
      originalPriceToman: null,
      costPriceToman: -10,
      isPublished: true,
    }).costPriceToman
  );

  assert.deepEqual(
    validateWarehouseInput({
      code: 'WH-THR-CENTRAL',
      nameFa: 'انبار مرکزی تهران',
      city: 'تهران',
      addressFa: 'خیابان حافظ',
      isActive: true,
    }),
    {}
  );
  assert.ok(
    validateWarehouseInput({
      code: 'WH INVALID',
      nameFa: 'ا',
      city: '',
      addressFa: '',
      isActive: true,
    }).code
  );

  assert.deepEqual(
    validateStockMovementInput({
      warehouseId: 'wh-1',
      variantId: 'var-1',
      movementType: 'purchase_inflow',
      quantityChange: 5,
      idempotencyKey: 'uuid-123',
    }),
    {}
  );
  assert.ok(
    validateStockMovementInput({
      warehouseId: '',
      variantId: '',
      movementType: 'order_sale',
      quantityChange: 0,
      idempotencyKey: '',
    }).quantityChange
  );
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
