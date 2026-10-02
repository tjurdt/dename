// Builds both deliverables from source:
//   - the website: one self-contained HTML file. web/src/index.html is the template;
//     web/src/main.js and everything it imports (including core/) is bundled by esbuild
//     and inlined, as are the CSS and the vendored pdf.js. Written to dist/web/index.html
//     and to ./index.html — GitHub Pages serves the repository root, so the committed
//     root index.html IS the live site;
//   - the Chrome extension: extension/ + the shared core/ engine, written to
//     dist/extension/ (load this folder unpacked) and zipped for the Web Store.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { zipSync } from 'fflate';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(ROOT, ...p);
const read = p => fs.readFileSync(p, 'utf8');

/**
 * Template markers, each resolved relative to the template:
 *   <!--@inline:path-->   the file's text
 *   <!--@base64:path-->   the file's bytes as base64 (for data: URIs)
 *   <!--@inline:@name-->  generated text passed in `generated` (e.g. the JS bundle)
 * Inlined content is never re-scanned for markers.
 */
export function inlineTemplate(templatePath, generated = {}) {
  const dir = path.dirname(templatePath);
  // A replacement *function*, never a string: inlined code contains `$&`, `$$` etc.
  return read(templatePath).replace(/<!--@(inline|base64):([^>]+?)-->/g, (_, kind, ref) => {
    ref = ref.trim();
    if (ref.startsWith('@')) {
      if (!(ref.slice(1) in generated)) throw new Error(`no generated content named ${ref}`);
      return generated[ref.slice(1)];
    }
    const file = path.resolve(dir, ref);
    if (!fs.existsSync(file)) throw new Error(`@${kind} target missing: ${ref}`);
    return kind === 'base64' ? fs.readFileSync(file).toString('base64') : read(file);
  });
}

export async function bundleWebApp() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ['web/src/main.js'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'error',
    // core/masker.js lists `isBirthLabel` twice in its export object (harmless, same
    // value). Tracked in CLAUDE.md; remove this once core/ is fixed in an extension release.
    logOverride: { 'duplicate-object-key': 'silent' },
  });
  const code = result.outputFiles[0].text;
  // The bundle is inlined into a <script>; this sequence would end it early.
  if (/<\/script/i.test(code)) throw new Error('bundle contains "</script" and cannot be inlined');
  return code;
}

export async function buildWebHtml() {
  return inlineTemplate(r('web/src/index.html'), { bundle: await bundleWebApp() });
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

export async function build() {
  const html = await buildWebHtml();
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
  const { html, zipName } = await build();
  console.log(`web: index.html ${(html.length / 1024).toFixed(0)} KB (dist/web + repo root)`);
  console.log(`extension: dist/extension/ + dist/${zipName}`);
}
