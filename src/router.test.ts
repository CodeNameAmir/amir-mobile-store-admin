import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRouteTarget } from './router';

test('normalizeRouteTarget normalizes hash paths, trailing slashes, and query strings', () => {
  assert.equal(normalizeRouteTarget(''), '/');
  assert.equal(normalizeRouteTarget('/'), '/');
  assert.equal(normalizeRouteTarget('#/products'), '/products');
  assert.equal(normalizeRouteTarget('/products/'), '/products');
  assert.equal(normalizeRouteTarget('products/new/'), '/products/new');
  assert.equal(
    normalizeRouteTarget('#/products/edit/?id=iphone-16-pro'),
    '/products/edit?id=iphone-16-pro'
  );
});
