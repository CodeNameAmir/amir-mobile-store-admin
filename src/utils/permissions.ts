import type { AuthUser } from '../types/admin';

export const ADMIN_PERMISSIONS = [
  'dashboard.read',
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  'catalog.manage',
  'inventory.read',
  'inventory.adjust',
  'inventory.transfer',
  'orders.read',
  'orders.update',
  'orders.cancel',
  'payments.read',
  'payments.refund',
  'customers.read',
  'customers.update',
  'sensitive_data.view_full',
  'coupons.manage',
  'support.manage',
  'reports.read',
  'settings.manage',
  'admins.manage',
  'roles.manage',
  'audit.read',
  'content.manage',
  'imei.manage',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number] | '*';

export interface PermissionMetadata {
  code: Exclude<AdminPermission, '*'>;
  labelFa: string;
  groupFa: string;
}

export const PERMISSION_CATALOG: PermissionMetadata[] = [
  { code: 'dashboard.read', labelFa: 'مشاهده داشبورد و آمار کلی', groupFa: 'داشبورد و گزارش‌ها' },
  { code: 'reports.read', labelFa: 'گزارش‌های مالی و صادرات داده', groupFa: 'داشبورد و گزارش‌ها' },
  { code: 'products.read', labelFa: 'مشاهده محصولات و قیمت‌ها', groupFa: 'محصولات و کاتالوگ' },
  { code: 'products.create', labelFa: 'ایجاد محصول جدید', groupFa: 'محصولات و کاتالوگ' },
  { code: 'products.update', labelFa: 'ویرایش محصول، تنوع و قیمت', groupFa: 'محصولات و کاتالوگ' },
  { code: 'products.delete', labelFa: 'حذف محصول', groupFa: 'محصولات و کاتالوگ' },
  { code: 'catalog.manage', labelFa: 'مدیریت دسته‌بندی، برند، گارانتی و ویژگی‌ها', groupFa: 'محصولات و کاتالوگ' },
  { code: 'inventory.read', labelFa: 'مشاهده انبارها و موجودی لحظه‌ای', groupFa: 'انبار و IMEI' },
  { code: 'inventory.adjust', labelFa: 'ثبت تراکنش ورود/خروج و تعدیل موجودی', groupFa: 'انبار و IMEI' },
  { code: 'inventory.transfer', labelFa: 'انتقال موجودی بین انبارها', groupFa: 'انبار و IMEI' },
  { code: 'imei.manage', labelFa: 'ثبت و ردیابی سریال IMEI دستگاه‌ها', groupFa: 'انبار و IMEI' },
  { code: 'orders.read', labelFa: 'مشاهده سفارش‌ها و مرسولات', groupFa: 'فروش و مالی' },
  { code: 'orders.update', labelFa: 'تغییر وضعیت ارسال و کد رهگیری', groupFa: 'فروش و مالی' },
  { code: 'orders.cancel', labelFa: 'لغو سفارش و بازگرداندن موجودی', groupFa: 'فروش و مالی' },
  { code: 'payments.read', labelFa: 'مشاهده تراکنش‌های پرداخت و شاپرک', groupFa: 'فروش و مالی' },
  { code: 'payments.refund', labelFa: 'ثبت استرداد وجه و مغایرت‌گیری', groupFa: 'فروش و مالی' },
  { code: 'coupons.manage', labelFa: 'مدیریت کدهای تخفیف و کمپین‌ها', groupFa: 'فروش و مالی' },
  { code: 'customers.read', labelFa: 'مشاهده پرونده مشتریان', groupFa: 'مشتریان و پشتیبانی' },
  { code: 'customers.update', labelFa: 'مسدودسازی یا ویرایش وضعیت مشتری', groupFa: 'مشتریان و پشتیبانی' },
  { code: 'sensitive_data.view_full', labelFa: 'نمایش کامل موبایل، کد ملی و نشانی مشتریان', groupFa: 'مشتریان و پشتیبانی' },
  { code: 'support.manage', labelFa: 'پاسخ به تیکت‌ها، پرسش‌ها، نظرات و خبرنامه', groupFa: 'مشتریان و پشتیبانی' },
  { code: 'content.manage', labelFa: 'مدیریت مقالات وبلاگ، صفحات و بنرها', groupFa: 'محتوا و سئو' },
  { code: 'settings.manage', labelFa: 'تنظیمات فروشگاه، ارسال و اعلانات', groupFa: 'سیستم و امنیت' },
  { code: 'admins.manage', labelFa: 'مدیریت مدیران و تغییر نقش کاربران', groupFa: 'سیستم و امنیت' },
  { code: 'roles.manage', labelFa: 'پیکربندی نقش‌ها و ماتریس مجوزها', groupFa: 'سیستم و امنیت' },
  { code: 'audit.read', labelFa: 'مشاهده و خروجی گزارش رویدادهای امنیتی', groupFa: 'سیستم و امنیت' },
];

export const PERMISSION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [p.code, p.labelFa])
);

export const STANDARD_ROLE_TEMPLATES: Record<
  string,
  { titleFa: string; permissions: AdminPermission[] }
> = {
  super_admin: { titleFa: 'مدیر ارشد سامانه', permissions: ['*'] },
  store_owner: { titleFa: 'مالک فروشگاه', permissions: ['*'] },
  product_manager: {
    titleFa: 'مدیر محصول و کاتالوگ',
    permissions: [
      'dashboard.read',
      'products.read',
      'products.create',
      'products.update',
      'products.delete',
      'catalog.manage',
    ],
  },
  sales_manager: {
    titleFa: 'مدیر فروش و تخفیف‌ها',
    permissions: ['dashboard.read', 'orders.read', 'orders.update', 'coupons.manage', 'reports.read'],
  },
  order_manager: {
    titleFa: 'مدیر پردازش سفارش‌ها',
    permissions: ['dashboard.read', 'orders.read', 'orders.update', 'orders.cancel', 'imei.manage'],
  },
  warehouse_manager: {
    titleFa: 'مدیر انبار و موجودی',
    permissions: ['dashboard.read', 'inventory.read', 'inventory.adjust', 'inventory.transfer', 'imei.manage'],
  },
  accountant: {
    titleFa: 'حسابدار و مالی',
    permissions: ['dashboard.read', 'orders.read', 'payments.read', 'payments.refund', 'reports.read'],
  },
  support_agent: {
    titleFa: 'کارشناس پشتیبانی',
    permissions: ['dashboard.read', 'orders.read', 'customers.read', 'support.manage'],
  },
  content_manager: {
    titleFa: 'مدیر محتوا',
    permissions: ['dashboard.read', 'content.manage'],
  },
  seo_manager: {
    titleFa: 'متخصص سئو',
    permissions: ['dashboard.read', 'products.read', 'products.update', 'content.manage'],
  },
};

export function hasExplicitRbacPermissions(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return Array.isArray(user.permissions) && user.permissions.length > 0;
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: Exclude<AdminPermission, '*'>
): boolean {
  if (!user || user.role !== 'admin') return false;
  if (user.isBlocked || user.isActive === false) return false;

  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes('super_admin') || roles.includes('store_owner')) {
    return true;
  }

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    if (user.permissions.includes('*')) return true;
    return user.permissions.includes(permission);
  }

  // Fallback for legacy single-role backend (/api/admin/me omits granular permissions[]):
  // Preserve operational admin access while sensitive PII full reveal defaults to false unless explicitly granted or legacy admin
  return true;
}

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: Array<Exclude<AdminPermission, '*'>>
): boolean {
  return permissions.some((perm) => hasPermission(user, perm));
}

export function canViewFullSensitiveData(user: AuthUser | null | undefined): boolean {
  if (!user || user.role !== 'admin') return false;
  if (user.isBlocked || user.isActive === false) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes('super_admin') || roles.includes('store_owner')) return true;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes('*') || user.permissions.includes('sensitive_data.view_full');
  }
  // When granular RBAC permissions are not returned by backend yet, default to masked-first with reveal toggle for verified admin
  return true;
}

export function getRequiredPermissionsForRoute(
  pathname: string
): Array<Exclude<AdminPermission, '*'>> {
  if (pathname === '/') return ['dashboard.read'];
  if (pathname.startsWith('/products/new')) return ['products.create'];
  if (pathname.startsWith('/products/edit') || /^\/products\/[^/]+\/edit$/.test(pathname)) {
    return ['products.update', 'products.read'];
  }
  if (pathname.startsWith('/products')) return ['products.read'];
  if (pathname.startsWith('/catalog')) return ['catalog.manage', 'products.read'];
  if (pathname.startsWith('/inventory')) return ['inventory.read', 'inventory.adjust'];
  if (pathname.startsWith('/imei')) return ['imei.manage', 'inventory.read'];
  if (pathname.startsWith('/orders')) return ['orders.read'];
  if (pathname.startsWith('/payments')) return ['payments.read'];
  if (pathname.startsWith('/returns')) return ['orders.read', 'payments.read'];
  if (pathname.startsWith('/coupons')) return ['coupons.manage'];
  if (pathname.startsWith('/customers')) return ['customers.read', 'admins.manage'];
  if (
    pathname.startsWith('/support') ||
    pathname.startsWith('/tickets') ||
    pathname.startsWith('/reviews') ||
    pathname.startsWith('/newsletter')
  ) {
    return ['support.manage'];
  }
  if (pathname.startsWith('/content')) return ['content.manage'];
  if (pathname.startsWith('/reports')) return ['reports.read'];
  if (pathname.startsWith('/audit-logs')) return ['audit.read'];
  if (pathname.startsWith('/settings')) return ['settings.manage', 'dashboard.read'];
  return ['dashboard.read'];
}

export function canAccessRoute(user: AuthUser | null | undefined, pathname: string): boolean {
  if (!user || user.role !== 'admin') return false;
  const required = getRequiredPermissionsForRoute(pathname);
  return hasAnyPermission(user, required);
}
