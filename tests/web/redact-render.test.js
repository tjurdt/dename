import test from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../../web/src/engine.js';
import { createNumberer, joinSegments, redactSegments, tally } from '../../web/src/redact.js';
import { highlightHtml, redactedHtml, escapeHtml } from '../../web/src/render.js';
import { normalizeWeb } from '../../web/src/settings.js';

const run = (texts, o) => {
  const settings = normalizeWeb(o);
  const numberer = createNumberer();
  return detect(texts, settings).map((spans, i) => ({
    spans, segments: redactSegments(texts[i], spans, settings, numberer),
  }));
};
const out = (texts, o) => run(texts, o).map(r => joinSegments(r.segments));

test('three output modes', () => {
  const text = '姓名：王小明 證號 A123456789';
  assert.equal(out([text], { outputMode: 'replace' })[0], '姓名：OOO 證號 OOO');
  assert.equal(out([text], { outputMode: 'label' })[0], '姓名：[姓名] 證號 [身分證]');
  assert.equal(out([text], { outputMode: 'number' })[0], '姓名：[姓名_01] 證號 [身分證_01]');
});

test('numbered codes are stable per value across documents', () => {
  const [a, b] = out(['姓名：王小明、陳美華', '陳美華與王小明'], { outputMode: 'number' });
  assert.equal(a, '姓名：[姓名_01]、[姓名_02]');
  assert.equal(b, '[姓名_02]與[姓名_01]');
});

test('doubt marks only when asked and only outside replace mode', () => {
  const text = '王龘齉';
  assert.equal(out([text], { outputMode: 'label' })[0], '[姓名]');
  assert.equal(out([text], { outputMode: 'label', markDoubt: true })[0], '[姓名?]');
  assert.equal(out([text], { outputMode: 'replace', markDoubt: true })[0], 'OOO');
});

test('replacement text is literal even with $ patterns', () => {
  assert.equal(out(['王小明'], { replacement: '$&' })[0], '$&');
});

test('tally counts per category', () => {
  const [{ spans }] = run(['王小明 陳美華 A123456789']);
  const t = tally(spans);
  assert.equal(t.total, 3);
  assert.equal(t.counts.name, 2);
  assert.equal(t.counts.id, 1);
});

test('views escape document text', () => {
  const text = '<img src=x onerror=alert(1)> 姓名：王小明 & "q"';
  const [{ spans, segments }] = run([text]);
  for (const { html } of [redactedHtml(segments), highlightHtml(text, spans)]) {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
  }
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('views truncate long documents and say so', () => {
  const text = '姓名：王小明\n' + 'x'.repeat(200);
  const [{ spans, segments }] = run([text]);
  const r = redactedHtml(segments, 50), h = highlightHtml(text, spans, 50);
  assert.equal(r.truncated, true);
  assert.equal(h.truncated, true);
  assert.equal(highlightHtml(text, spans, 1e6).truncated, false);
});
