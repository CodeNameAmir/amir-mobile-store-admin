import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidImeiLuhn, normalizeImei, parseImeiBatch } from './imei.ts';

describe('IMEI normalization and Luhn validation', () => {
  it('normalizes Persian/Arabic numerals, hyphens, and whitespace', () => {
    assert.equal(normalizeImei(' ۳۵۶۹۳۸-۰۳۵۶-۴۳۸۰۹ '), '356938035643809');
    assert.equal(normalizeImei('٣٥٦٩٣٨٠٣٥٦٤٣٨٠٩'), '356938035643809');
  });

  it('validates genuine 15-digit Luhn IMEIs', () => {
    // 356938035643809 -> valid Luhn IMEI
    assert.equal(isValidImeiLuhn('356938035643809'), true);
    // 490154203237518 -> valid Luhn IMEI
    assert.equal(isValidImeiLuhn('490154203237518'), true);
    // With Persian digits and spaces
    assert.equal(isValidImeiLuhn('۳۵۶۹۳۸ ۰۳۵۶۴۳ ۸۰۹'), true);
  });

  it('rejects wrong length, non-numeric, or bad Luhn check digits', () => {
    assert.equal(isValidImeiLuhn('356938035643808'), false); // bad check digit
    assert.equal(isValidImeiLuhn('35693803564380'), false); // 14 digits
    assert.equal(isValidImeiLuhn('3569380356438091'), false); // 16 digits
    assert.equal(isValidImeiLuhn('35693803564380A'), false); // non-digit
    assert.equal(isValidImeiLuhn(''), false);
  });

  it('parses multiline batch into valid, invalid, and duplicate buckets', () => {
    const input = [
      '356938035643809',
      '۴۹۰۱۵۴۲۰۳۲۳۷۵۱۸',
      '356938-035643-809', // duplicate of first
      '123456789012345', // invalid check digit
      'abc-123', // invalid format
    ].join('\n');

    const result = parseImeiBatch(input);
    assert.deepEqual(result.valid, ['356938035643809', '490154203237518']);
    assert.deepEqual(result.duplicates, ['356938035643809']);
    assert.deepEqual(result.invalid, ['123456789012345', 'abc-123']);
  });
});
