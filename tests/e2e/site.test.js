// Real-browser smoke test of the BUILT site (root index.html), not the sources:
// pdf.js worker inlining, CSP, layout and hit-testing only show up here.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT } from '../../scripts/build.mjs';

const URL_ = pathToFileURL(path.join(ROOT, 'index.html')).href;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) problems.push('network: ' + r.url()); });
  await page.goto(URL_);
  return { page, problems, context };
}
const docText = page => page.locator('#docView').innerText();
// run() is async (file reads); wait until the result view has rendered something.
async function runAndWait(page) {
  await page.click('#runBtn');
  await page.waitForFunction(() => document.getElementById('docView').innerText.trim().length > 0);
}

/** A one-page PDF with Latin text in Helvetica, with a correct xref table. */
function tinyPdf(line) {
  const stream = `BT /F1 12 Tf 20 100 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

test('paste → run → OOO output, highlight view, live setting changes', async () => {
  const { page, problems, context } = await open();
  await page.fill('#pasteBox', '姓名：王小明 病歷號 1234567\n證號 A123456789');
  await runAndWait(page);
  assert.equal(await docText(page), '姓名：OOO 病歷號 OOO\n證號 OOO');
  assert.match(await page.locator('#tally').textContent(), /共遮蔽\s*3\s*項/);

  await page.click('#viewHighlight');
  assert.equal(await page.locator('#docView mark').count(), 3);
  assert.equal(await docText(page), '姓名：王小明 病歷號 1234567\n證號 A123456789');
  await page.click('#viewRedacted');

  // Changing a setting re-renders immediately and survives a reload.
  await page.locator('input[name=outputMode][value=label]').check();
  assert.equal(await docText(page), '姓名：[姓名] 病歷號 [病歷號]\n證號 [身分證]');
  await page.reload();
  assert.equal(await page.locator('input[name=outputMode][value=label]').isChecked(), true);
  assert.deepEqual(problems, []);
  await context.close();
});

test('custom checkboxes toggle by clicking the visible box (hit-testing)', async () => {
  const { page, context } = await open();
  const box = page.locator('label:has(#ruleNames) .box');
  const before = await page.locator('#ruleNames').isChecked();
  await box.click();
  assert.equal(await page.locator('#ruleNames').isChecked(), !before);
  await context.close();
});

test('TXT and PDF uploads are read locally, PDF through the inlined pdf.js worker', async () => {
  const { page, problems, context } = await open();
  await page.setInputFiles('#fileInput', [
    { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('病人陳淑芬今日回診', 'utf8') },
    { name: 'scan.pdf', mimeType: 'application/pdf', buffer: tinyPdf('ID A123456789 MRN 1234567') },
  ]);
  assert.equal(await page.locator('#fileList li').count(), 2);
  await runAndWait(page);
  assert.equal(await docText(page), '病人OOO今日回診');
  await page.click('#fileTabs button:nth-child(2)');
  await page.waitForFunction(() => document.getElementById('docView').innerText.includes('OOO'));
  assert.equal(await docText(page), 'ID OOO MRN OOO');
  assert.deepEqual(problems, []);
  await context.close();
});

test('phone width: no horizontal page scroll', async () => {
  const { page, context } = await open({ width: 375, height: 800 });
  await page.fill('#pasteBox', '姓名：王小明 ' + 'x'.repeat(400));
  await runAndWait(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page is ${overflow}px wider than the viewport`);
  // Toolbar labels must stay on one line, not get squeezed into vertical text.
  const heights = await page.locator('.toolbar button').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().height));
  for (const h of heights) assert.ok(h < 44, `a toolbar button is ${h}px tall (label wrapped)`);
  await context.close();
});
