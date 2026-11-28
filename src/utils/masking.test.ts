import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskAddress,
  maskDeliveryPin,
  maskEmail,
  maskImei,
  maskNationalId,
  maskPhone,
  maskPostalCode,
} from './masking';

test('maskPhone and maskEmail preserve partial prefix/domain while hiding sensitive digits', () => {
  assert.equal(maskPhone('09123456789'), '۰۹۱۲*****۸۹');
  assert.equal(maskPhone(''), '—');
  assert.equal(maskEmail('amir.salimi@codenameamir.ir'), 'am***@codenameamir.ir');
  assert.equal(maskEmail('a@b.ir'), 'a***@b.ir');
});

test('maskNationalId, maskPostalCode, maskAddress, maskImei, and maskDeliveryPin mask sensitive fields safely', () => {
  assert.equal(maskNationalId('0012345678'), '۰۰۱*****۷۸');
  assert.equal(maskNationalId(null), 'ثبت نشده');
  assert.equal(maskPostalCode('1484616553'), '۱۴۸****۵۳');
  assert.equal(maskAddress('خیابان ولیعصر پلاک ۱۲', 'تهران'), 'تهران (نشانی کامل پنهان)');
  assert.equal(maskAddress('', 'تهران'), 'تهران');
  assert.equal(maskImei('356789012345678'), '3567*******5678');
  assert.equal(maskDeliveryPin('4829'), '••••');
  assert.equal(maskDeliveryPin(''), '—');
});
