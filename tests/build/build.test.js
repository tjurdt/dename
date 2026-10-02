// Guards on the build itself: the live site file must match its sources, the extension
// package must be complete and self-consistent, and the shared engine must exist once.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildWebHtml, extensionFiles, extensionVersion, EXTENSION_FILES } from '../../scripts/build.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('root index.html (served by GitHub Pages) is the fresh build of web/', () => {
  assert.ok(read('index.html') === buildWebHtml(),
    'index.html is stale or was edited by hand. Edit web/ and run `npm run build`.');
});

test('the site cannot reach the network: strict CSP and no external resources', () => {
  const html = read('index.html');
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(csp, 'CSP meta tag is missing');
  assert.match(csp[1], /default-src 'none'/);
  assert.match(csp[1], /connect-src 'none'/);
  assert.doesNotMatch(html, /<(?:script|link|img|iframe)[^>]+(?:src|href)="(?:https?:)?\/\//i);
});

test('extension package contains every file the manifest and popup reference', () => {
  const files = extensionFiles();
  const manifest = JSON.parse(read('extension/manifest.json'));
  const referenced = [
    ...manifest.content_scripts.flatMap(c => c.js),
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  const popup = read('extension/popup.html');
  for (const m of popup.matchAll(/(?:src|href)="([^"]+)"/g)) referenced.push(m[1]);
  for (const name of referenced) assert.ok(files.has(name), `${name} is referenced but not packaged`);
});

test('content scripts load the engine dependencies before the engine', () => {
  const order = JSON.parse(read('extension/manifest.json')).content_scripts[0].js;
  const at = n => order.indexOf(n);
  assert.ok(at('surnames.js') < at('masker.js') && at('namedata.js') < at('masker.js'));
  assert.ok(at('settings.js') < at('content.js') && at('masker.js') < at('content.js'));
});

test('extension version is stated consistently', () => {
  const v = extensionVersion();
  assert.match(v, /^\d+\.\d+\.\d+$/);
  assert.ok(read('extension/README.md').startsWith(`# OOO 敏感資料遮罩 v${v}\n`),
    'extension/README.md title must carry the manifest version');
});

test('the shared engine lives only in core/ (no drifting copies)', () => {
  const coreFiles = EXTENSION_FILES.filter(([, from]) => from.startsWith('core/')).map(([n]) => n);
  for (const dir of ['extension', 'web/src']) for (const n of coreFiles)
    assert.equal(fs.existsSync(path.join(ROOT, dir, n)), false, `${dir}/${n} duplicates core/${n}`);
});
