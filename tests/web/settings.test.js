import test from 'node:test';
import assert from 'node:assert/strict';
import OOOSettings from '../../core/settings.js';
import { loadSettings, normalizeWeb, parseList, saveSettings, STORAGE_KEY } from '../../web/src/settings.js';

const memoryStore = (init = {}) => {
  const data = { ...init };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

test('website settings are the extension settings plus output options', () => {
  const web = normalizeWeb();
  for (const key of Object.keys(OOOSettings.defaults)) assert.ok(key in web, key);
  assert.equal(web.outputMode, 'replace');
  assert.equal(web.markDoubt, false);
  assert.equal(web.replacement, 'OOO');
  assert.equal(web.rules.email, true);
  assert.equal(web.rules.phone, true);
  assert.equal(normalizeWeb({ outputMode: 'nonsense' }).outputMode, 'replace');
  assert.equal(normalizeWeb({ rules: { email: false } }).rules.email, false);
});

test('manual names are never written to browser storage', () => {
  const store = memoryStore();
  saveSettings(normalizeWeb({ manualNames: ['王小明'], keepWords: ['海研社'] }), store);
  assert.doesNotMatch(store.data[STORAGE_KEY], /王小明/);
  const loaded = loadSettings(store);
  assert.deepEqual(loaded.manualNames, []);
  assert.deepEqual(loaded.keepWords, ['海研社']);
});

test('broken or unavailable storage falls back to defaults', () => {
  assert.deepEqual(loadSettings(memoryStore({ [STORAGE_KEY]: '{not json' })), normalizeWeb());
  assert.deepEqual(loadSettings(null), normalizeWeb());
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(throwing), normalizeWeb());
  assert.doesNotThrow(() => saveSettings(normalizeWeb(), throwing));
});

test('lists split on lines and commas', () => {
  assert.deepEqual(parseList(' 王小明 \n\n陳美華，林雅婷,  '), ['王小明', '陳美華', '林雅婷']);
});
