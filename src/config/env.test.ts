import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApiUrl,
  DEFAULT_PRODUCTION_API_URL,
  DEFAULT_STOREFRONT_URL,
  PRODUCTION_ADMIN_HOSTNAME,
  resolveApiBaseUrl,
  resolveStorefrontUrl,
} from './env';

test('resolveApiBaseUrl prefers VITE_API_BASE_URL and strips trailing slashes', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.codenameamir.ir///', undefined, 'localhost'),
    'https://api.codenameamir.ir'
  );
});

test('resolveApiBaseUrl falls back to legacy VITE_API_URL when primary is empty', () => {
  assert.equal(
    resolveApiBaseUrl('', 'https://staging-api.codenameamir.ir/', 'localhost'),
    'https://staging-api.codenameamir.ir'
  );
});

test('resolveApiBaseUrl uses production API URL on production admin hostname', () => {
  assert.equal(
    resolveApiBaseUrl('', '', PRODUCTION_ADMIN_HOSTNAME),
    DEFAULT_PRODUCTION_API_URL
  );
});

test('resolveApiBaseUrl returns empty string for local proxy when unset', () => {
  assert.equal(resolveApiBaseUrl(undefined, undefined, 'localhost'), '');
});

test('buildApiUrl joins base URL and path cleanly', () => {
  assert.equal(
    buildApiUrl('api/admin/orders', 'https://api.codenameamir.ir'),
    'https://api.codenameamir.ir/api/admin/orders'
  );
  assert.equal(buildApiUrl('/api/auth/me', ''), '/api/auth/me');
});

test('resolveStorefrontUrl returns configured URL or default storefront URL', () => {
  assert.equal(resolveStorefrontUrl('https://store.example.com/'), 'https://store.example.com');
  assert.equal(resolveStorefrontUrl(''), DEFAULT_STOREFRONT_URL);
  assert.equal(resolveStorefrontUrl('sb_publishable_12345'), DEFAULT_STOREFRONT_URL);
});

test('resolveApiBaseUrl rejects direct Supabase hosts and non-HTTP URLs', () => {
  assert.equal(
    resolveApiBaseUrl('https://example.supabase.co', undefined, 'localhost'),
    ''
  );
  assert.equal(
    resolveApiBaseUrl('https://example.supabase.co', undefined, PRODUCTION_ADMIN_HOSTNAME),
    DEFAULT_PRODUCTION_API_URL
  );
  assert.equal(
    resolveApiBaseUrl('not-a-valid-url', 'https://api.codenameamir.ir/', 'localhost'),
    'https://api.codenameamir.ir'
  );
});
