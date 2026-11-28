import { toPersianDigits } from './formatters';

export function maskPhone(phone?: string | null): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '—';
  if (raw.length <= 4) return '****';
  const start = raw.slice(0, 4);
  const end = raw.slice(-2);
  return toPersianDigits(`${start}*****${end}`);
}

export function maskEmail(email?: string | null): string {
  const raw = (email ?? '').trim();
  if (!raw) return '—';
  const atIdx = raw.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = raw.slice(0, atIdx);
  const domain = raw.slice(atIdx);
  const visible = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
  return `${visible}***${domain}`;
}

export function maskNationalId(nationalId?: string | null): string {
  const raw = (nationalId ?? '').trim();
  if (!raw) return 'ثبت نشده';
  if (raw.length <= 4) return '****';
  return toPersianDigits(`${raw.slice(0, 3)}*****${raw.slice(-2)}`);
}

export function maskPostalCode(postalCode?: string | null): string {
  const raw = (postalCode ?? '').trim();
  if (!raw) return '—';
  if (raw.length <= 4) return '****';
  return toPersianDigits(`${raw.slice(0, 3)}****${raw.slice(-2)}`);
}

export function maskAddress(address?: string | null, city?: string | null): string {
  const cleanCity = (city ?? '').trim();
  if (!address || !address.trim()) {
    return cleanCity || '—';
  }
  return cleanCity ? `${cleanCity} (نشانی کامل پنهان)` : 'نشانی کامل پنهان';
}

export function maskImei(imei?: string | null): string {
  const raw = (imei ?? '').trim();
  if (!raw) return '—';
  if (raw.length <= 6) return '******';
  return `${raw.slice(0, 4)}${'*'.repeat(Math.max(4, raw.length - 8))}${raw.slice(-4)}`;
}

export function maskDeliveryPin(pin?: string | null): string {
  const raw = (pin ?? '').trim();
  if (!raw) return '—';
  return '••••';
}
