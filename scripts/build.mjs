// Builds both deliverables from source:
//   - the website: web/src/index.html with every <!--@inline:path--> replaced by that
//     file's contents, written to dist/web/index.html and to ./index.html (GitHub Pages
//     serves the repository root, so the committed root index.html IS the live site);
//   - the Chrome extension: extension/ + the shared core/ engine, written to
//     dist/extension/ (load this folder unpacked) and zipped for the Web Store.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(ROOT, ...p);
const read = p => fs.readFileSync(p, 'utf8');

/** Replace <!--@inline:relative/path--> markers. Inlined content is never re-scanned. */
export function inlineTemplate(templatePath) {
  const dir = path.dirname(templatePath);
  // A replacement *function*, never a string: inlined code contains `$&`, `$$` etc.
  return read(templatePath).replace(/<!--@inline:([^>]+?)-->/g, (_, rel) => {
    const file = path.resolve(dir, rel.trim());
    if (!fs.existsSync(file)) throw new Error(`@inline target missing: ${rel}`);
    return read(file);
  });
}

export function buildWebHtml() {
  return inlineTemplate(r('web/src/index.html'));
}

// Files that make up the extension package, in the order the Web Store zip lists them.
// Shared engine files come from core/; everything else from extension/.
export const EXTENSION_FILES = [
  ['manifest.json', 'extension/manifest.json'],
  ['settings.js', 'core/settings.js'],
  ['surnames.js', 'core/surnames.js'],
  ['namedata.js', 'core/namedata.js'],
  ['masker.js', 'core/masker.js'],
  ['content.js', 'extension/content.js'],
  ['popup.html', 'extension/popup.html'],
  ['popup.css', 'extension/popup.css'],
  ['popup.js', 'extension/popup.js'],
  ['README.md', 'extension/README.md'],
  ['icons/icon16.png', 'extension/icons/icon16.png'],
  ['icons/icon32.png', 'extension/icons/icon32.png'],
  ['icons/icon48.png', 'extension/icons/icon48.png'],
  ['icons/icon128.png', 'extension/icons/icon128.png'],
];

export function extensionVersion() {
  return JSON.parse(read(r('extension/manifest.json'))).version;
}

/** @returns {Map<string, Uint8Array>} published path → bytes */
export function extensionFiles() {
  return new Map(EXTENSION_FILES.map(([to, from]) => [to, new Uint8Array(fs.readFileSync(r(from)))]));
}

export function build() {
  const html = buildWebHtml();
  fs.mkdirSync(r('dist/web'), { recursive: true });
  fs.writeFileSync(r('dist/web/index.html'), html);
  fs.writeFileSync(r('index.html'), html);

  const files = extensionFiles();
  const out = r('dist/extension');
  fs.rmSync(out, { recursive: true, force: true });
  for (const [name, bytes] of files) {
    fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
    fs.writeFileSync(path.join(out, name), bytes);
  }
  // Fixed timestamp keeps the zip byte-identical across rebuilds of the same sources.
  const mtime = new Date('2026-01-01T00:00:00Z');
  const zip = zipSync(Object.fromEntries([...files].map(([n, b]) => [n, [b, { mtime }]])), { level: 9 });
  const zipName = `ooo-sensitive-mask-v${extensionVersion()}-store.zip`;
  fs.writeFileSync(r('dist', zipName), zip);
  return { html, zipName };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { html, zipName } = build();
  console.log(`web: index.html ${(html.length / 1024).toFixed(0)} KB (dist/web + repo root)`);
  console.log(`extension: dist/extension/ + dist/${zipName}`);
}
