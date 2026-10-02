import test from 'node:test';
import assert from 'node:assert/strict';
import MaskOOO from '../../core/masker.js';
import { detect, categoryOf, CATEGORIES } from '../../web/src/engine.js';
import { createNumberer, joinSegments, redactSegments } from '../../web/src/redact.js';
import { normalizeWeb } from '../../web/src/settings.js';

const S = (o = {}) => normalizeWeb(o);
const NOW = Date.parse('2026-09-08T00:00:00Z');
const redact = (texts, settings) => {
  const numberer = createNumberer();
  return detect(texts, settings).map((spans, i) => joinSegments(redactSegments(texts[i], spans, settings, numberer)));
};

// The link between the two products: the website in OOO mode must give exactly what
// the extension gives when the same text is pasted into a page (content.js paste path).
test('website OOO output equals the extension paste result for the same settings', () => {
  const samples = [
    '姓名：王小明 病歷號 123456 證號 A123456789',
    '病人陳淑芬今日回診，生日 1986/03/02，聯絡 0912-345-678，a.b@example.com',
    '周宥安、黃宜蓁\n宥安表示，請宜蓁協助整理。',
    '檢驗日 2026/08/01 入院日期：2026-08-01 1959-12-27',
    '生策會會長楊泮池表示；林口長庚、高血壓、白血球',
    'D @龘罕名 H I 歐陽雅婷 𡍼志明',
  ];
  for (const options of [{}, { rules: { email: false, phone: false } }, { dateMode: 'all', surnameLimit: 100 },
    { keepWords: ['林口長庚', '宥安表示'], manualNames: ['某某診所', '王宏'] }, { givenNames: false, replacement: '＊' }]) {
    const settings = S({ ...options, now: NOW });
    for (const text of samples) {
      const local = MaskOOO.buildNameIndex([{ text }], settings, settings.manualNames, settings.keepWords);
      const extension = MaskOOO.maskText(text, settings, {
        knownNames: local.knownNames, givenNames: local.givenNames,
        manualNames: settings.manualNames, keepWords: settings.keepWords,
      });
      assert.equal(redact([text], settings)[0], extension, JSON.stringify(options) + ' ' + text);
    }
  }
});

test('every engine reason maps to a known category', () => {
  for (const reason of ['id', 'mrn', 'date', 'email', 'phone', 'manual-name', 'field', 'label',
    'person-context', 'common-given-name', 'surname-heuristic', 'known-name', 'given-name'])
    assert.ok(CATEGORIES[categoryOf(reason)], reason);
  assert.equal(categoryOf('surname-heuristic'), 'name');
  assert.equal(categoryOf('manual-name'), 'custom');
});

test('spans carry category, value and doubt', () => {
  const [spans] = detect(['姓名：王小明 A123456789 王龘齉'], S());
  assert.deepEqual(spans.map(s => [s.category, s.value, s.doubt]),
    [['name', '王小明', false], ['id', 'A123456789', false], ['name', '王龘齉', true]]);
});

test('documents in one run share a name index', () => {
  const [, second] = redact(['周宥安', '宥安表示'], S());
  assert.equal(second, 'OOO表示');
  // Processed alone, the given name has nothing to anchor to.
  assert.equal(redact(['宥安表示'], S())[0], '宥安表示');
});

test('website defaults mask e-mail and phone; turning them off restores the extension default', () => {
  const text = 'a.b@example.com 0912-345-678';
  assert.equal(redact([text], S())[0], 'OOO OOO');
  assert.equal(redact([text], S({ rules: { email: false, phone: false } }))[0], text);
});
