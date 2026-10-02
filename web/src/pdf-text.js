// Turning pdf.js text items into readable text. Pure; no DOM, no pdf.js.
//
// A PDF has no paragraphs, only positioned runs of text. Lines are rebuilt from the
// runs' baselines. A line followed, at normal spacing and without indent, by a line whose
// first word could not have fitted on it was wrapped by layout, so the two are joined.
// Joining matters for detection too: a wrap such as 非｜常感動 leaves 常感動 alone at
// the start of a line, where it looks exactly like a name.

/**
 * @param {{str:string, transform:number[], width:number, height:number}[]} items  one page
 * @returns {{text:string, left:number, right:number, y:number, height:number}[]}
 */
export function itemsToLines(items) {
  const lines = [];
  let line = null;
  for (const item of items) {
    // pdf.js emits empty end-of-line markers positioned on the NEXT line; they carry no
    // text and would otherwise produce a spurious blank line.
    if (!item.str) continue;
    const x = item.transform[4], y = item.transform[5], h = item.height || 0;
    if (!line || Math.abs(y - line.y) > Math.max(2, 0.4 * Math.max(h, line.height))) {
      line = { text: '', left: x, right: x, y, height: 0 };
      lines.push(line);
    }
    line.text += item.str;
    line.left = Math.min(line.left, x);
    line.right = Math.max(line.right, x + (item.width || 0));
    line.height = Math.max(line.height, h);
  }
  return lines.filter(l => l.text.trim());
}

const WIDE = /[\p{Script=Han}　-〿＀-￯⺀-⿟]/u;

function lowerQuartile(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 4)];
}

// The right edge of the text block: the furthest right position that at least two lines
// reach. A lone header or page number further right does not count.
function textBlockRight(lines, tolerance) {
  const rights = lines.map(l => l.right).sort((a, b) => b - a);
  for (const r of rights) if (rights.filter(x => Math.abs(x - r) <= tolerance).length >= 2) return r;
  return rights[0];
}

// Would the first word (Latin) or character (CJK) of `next` have fitted at the end of
// `prev`? If it would have, the line was ended on purpose.
function firstTokenWouldFit(prev, next, rightEdge, height) {
  const text = next.text.trimStart();
  const advance = (next.right - next.left) / Math.max(1, Array.from(next.text).length);
  const token = text.match(/^[A-Za-z0-9@._%+\-]+/)?.[0] || Array.from(text)[0] || '';
  const latinPair = /[A-Za-z0-9]$/.test(prev.text.trimEnd()) && /^[A-Za-z0-9]/.test(text);
  const needed = Array.from(token).length * advance + (latinPair ? advance : 0);
  return prev.right + needed < rightEdge - 0.5 * height;
}

/**
 * @param {ReturnType<typeof itemsToLines>} lines  one page
 * @param {{joinWraps?: boolean}} options
 */
export function linesToText(lines, { joinWraps = true } = {}) {
  if (!joinWraps || lines.length < 2) return lines.map(l => l.text).join('\n');
  const height = Math.max(1, ...lines.map(l => l.height));
  const rightEdge = textBlockRight(lines, height);
  const leftEdge = Math.min(...lines.map(l => l.left));
  const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter(g => g > 0);
  const lineGap = gaps.length ? lowerQuartile(gaps) : height * 1.2;
  let text = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1], next = lines[i];
    const gap = prev.y - next.y;
    const paragraphGap = gap <= 0 || gap > lineGap * 1.4; // also a column or order jump
    const indented = next.left > leftEdge + 0.8 * height;
    if (!paragraphGap && !indented && !firstTokenWouldFit(prev, next, rightEdge, height)) {
      const a = prev.text.trimEnd(), b = next.text.trimStart();
      const wide = WIDE.test(a.slice(-1)) || WIDE.test(b[0]);
      text = text.trimEnd() + (wide ? '' : ' ') + b;
    } else {
      text += (paragraphGap ? '\n\n' : '\n') + next.text;
    }
  }
  return text;
}

/** @param {ReturnType<typeof itemsToLines>[]} pages */
export function pagesToText(pages, options) {
  return pages.map(lines => linesToText(lines, options)).join('\n\n');
}

// Some PDF fonts map ordinary characters to look-alike radical code points: 生 comes out
// as ⽣ (U+2F63), 高 as ⾼, 西 as ⻄. They look right but match nothing, so surnames go
// undetected. Kangxi radicals and compatibility ideographs have NFKC mappings; the few
// CJK Radicals Supplement forms that stand for a whole character are listed by hand.
const RADICAL_SUPPLEMENT = {
  '⺝': '月', '⺟': '母', '⺠': '民', '⻄': '西', '⻆': '角', '⻑': '長',
  '⻘': '青', '⻝': '食', '⻤': '鬼', '⻩': '黄', '⻫': '斉', '⻭': '歯',
  '⻯': '竜', '⻳': '亀',
};

export function normalizeCjk(text) {
  return text
    .replace(/[⼀-⿟豈-﫿]/g, c => c.normalize('NFKC'))
    .replace(/[⺀-⻿]/g, c => RADICAL_SUPPLEMENT[c] || c);
}
