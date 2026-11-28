import { toEnglishDigits } from './formatters';

/**
 * Strips whitespace, hyphens, and slashes while converting Persian/Arabic digits to ASCII.
 */
export function normalizeImei(raw: string): string {
  return toEnglishDigits(raw || '')
    .trim()
    .replace(/[\s\-_/]+/g, '');
}

/**
 * Validates a 15-digit IMEI using the standard Luhn (mod-10) check digit algorithm.
 */
export function isValidImeiLuhn(raw: string): boolean {
  const imei = normalizeImei(raw);
  if (!/^\d{15}$/.test(imei)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let digit = Number(imei[i]);
    // Double every second digit from the left (0-based odd indices: 1, 3, ..., 13)
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

export interface ParsedImeiBatch {
  valid: string[];
  invalid: string[];
  duplicates: string[];
}

/**
 * Parses a multiline or comma/semicolon-separated batch of IMEIs,
 * validating Luhn check digits and separating duplicates.
 */
export function parseImeiBatch(multilineText: string): ParsedImeiBatch {
  const tokens = (multilineText || '')
    .split(/[\r\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeImei(token);
    if (!normalized) continue;

    if (!isValidImeiLuhn(normalized)) {
      invalid.push(token);
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.push(normalized);
      continue;
    }

    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid, duplicates };
}
