import test from 'node:test';
import assert from 'node:assert/strict';
import { itemsToLines, linesToText, normalizeCjk, pagesToText } from '../../web/src/pdf-text.js';

// Real pdf.js 3.11.174 output for a Chromium-printed A4 page (JhengHei, 520px column):
// [str, hasEOL, x, y, width, height]. Note the empty EOL markers sitting on the next
// line's y, and the radical look-alikes (⾃ ⽣ ⻄ ⾼ ⼀ ⼯ ⼩ ⼿ ⽤ ⼼ ⼦).
const RAW = [
  ['⾃', false, 30, 797.9, 14, 14], ['我介紹', false, 44, 797.9, 42.1, 14], ['', true, 30, 767.1, 0, 0],
  ['您好，我是醫學系六年級學', false, 30, 767.1, 144, 12], ['⽣', false, 174, 767.1, 12, 12],
  ['，現任實習醫師，持有', false, 186, 767.1, 120, 12], ['⻄', false, 306, 767.1, 12, 12],
  ['餐丙級與 ACLS', false, 318, 767.1, 80.1, 12], [' ', false, 398.1, 767.1, 4, 0], ['⾼', false, 401.1, 767.1, 12, 12],
  ['', true, 30, 751.4, 0, 0],
  ['級急救證照，並已通過', false, 30, 751.4, 120, 12], ['⼀', false, 150, 751.4, 12, 12],
  ['階醫師國考。除了能在旅客突發狀況時提供專業', true, 162, 751.4, 252, 12],
  ['急救與基本處置，我也樂於協助房務與櫃檯', false, 30, 735.6, 228, 12], ['⼯', false, 258, 735.6, 12, 12],
  ['作。', true, 270, 735.6, 24, 12],
  ['許多過往', false, 30, 707.9, 48, 12], ['⼩', false, 78, 707.9, 12, 12], ['幫', false, 90, 707.9, 12, 12],
  ['⼿', false, 102, 707.9, 12, 12], ['在文章中分享，您們對旅客與', false, 114, 707.9, 156, 12],
  ['⼩', false, 270, 707.9, 12, 12], ['幫', false, 282, 707.9, 12, 12], ['⼿', false, 294, 707.9, 12, 12],
  ['的', false, 306, 707.9, 12, 12], ['⽤', false, 318, 707.9, 12, 12], ['⼼', false, 330, 707.9, 12, 12],
  ['照顧，讓我非', true, 342, 707.9, 72, 12],
  ['常感動，非常希望有機會成為團隊的', false, 30, 692.1, 192, 12], ['⼀', false, 222, 692.1, 12, 12],
  ['份', false, 234, 692.1, 12, 12], ['⼦', false, 246, 692.1, 12, 12], ['。', true, 258, 692.1, 12, 12],
  ['經歷：實習醫師', false, 30, 664.4, 84, 12],
].map(([str, hasEOL, x, y, width, height]) => ({ str, hasEOL, transform: [1, 0, 0, 1, x, y], width, height }));

test('no spurious blank lines from end-of-line markers', () => {
  const text = linesToText(itemsToLines(RAW), { joinWraps: false });
  assert.doesNotMatch(text, /\n\n/);
  assert.equal(text.split('\n').length, 7);
});

test('soft wraps join into paragraphs; real breaks and paragraph gaps stay', () => {
  const text = normalizeCjk(linesToText(itemsToLines(RAW)));
  assert.equal(text, [
    '自我介紹',
    '',
    '您好，我是醫學系六年級學生，現任實習醫師，持有西餐丙級與 ACLS 高級急救證照，並已通過一階醫師國考。除了能在旅客突發狀況時提供專業急救與基本處置，我也樂於協助房務與櫃檯工作。',
    '',
    '許多過往小幫手在文章中分享，您們對旅客與小幫手的用心照顧，讓我非常感動，非常希望有機會成為團隊的一份子。',
    '',
    '經歷：實習醫師',
  ].join('\n'));
});

test('Latin text joins with a space, CJK without', () => {
  const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 10 });
  const lines = itemsToLines([item('the quick brown', 0, 100, 200), item('fox jumps', 0, 88, 90), item('end', 0, 76, 30)]);
  assert.equal(linesToText(lines), 'the quick brown fox jumps\nend');
});

test('indented next line starts a new paragraph even at normal spacing', () => {
  const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 10 });
  const lines = itemsToLines([item('一二三四五六七八九十', 0, 100, 100), item('二十', 20, 88, 20), item('三十一二三四五六七八', 0, 76, 100)]);
  assert.equal(linesToText(lines), '一二三四五六七八九十\n二十\n三十一二三四五六七八');
});

test('a Latin word pushed to the next line still counts as a wrap', () => {
  const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 12 });
  // Column edge 400. "ACLS" (≈4×12 wide estimate) did not fit after x=372, so it wrapped.
  const lines = itemsToLines([
    item('持有西餐丙級與高級心肺復甦術與', 0, 100, 372), item('ACLS 證照，並通過考試，也會一些別的技能，以及很多其他的。', 0, 84, 400),
    item('結尾。', 0, 68, 36),
  ]);
  assert.equal(linesToText(lines), '持有西餐丙級與高級心肺復甦術與ACLS 證照，並通過考試，也會一些別的技能，以及很多其他的。結尾。');
});

test('a lone header further right does not move the text edge', () => {
  const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 10 });
  const lines = itemsToLines([
    item('第 1 頁', 500, 140, 60),
    item('一二三四五六七八九十', 0, 100, 100), item('一二三四五六七八九十', 0, 88, 100), item('完。', 0, 76, 20),
  ]);
  assert.equal(linesToText(lines), '第 1 頁\n\n一二三四五六七八九十一二三四五六七八九十完。');
});

test('pages are separated by a blank line', () => {
  const page = [{ text: 'A', left: 0, right: 10, y: 10, height: 10 }];
  assert.equal(pagesToText([page, page]), 'A\n\nA');
});

test('radical look-alikes become the ordinary characters', () => {
  assert.equal(normalizeCjk('⾼⽂⽣⻄⻑⻘⼀⼈'), '高文生西長青一人');
  assert.equal(normalizeCjk('王小明，１２３：ＡＢ'), '王小明，１２３：ＡＢ', 'full-width text is left alone');
  assert.equal(normalizeCjk('金'), '金', 'compatibility ideograph');
});
