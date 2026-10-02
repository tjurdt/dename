// Turns detected spans into output text. Pure; no DOM.
import { CATEGORIES } from './engine.js';

/** Output styles offered on the site. The extension only ever uses 'replace'. */
export const OUTPUT_MODES = ['replace', 'label', 'number'];

/**
 * Hands out stable codes such as [姓名_01]. One numberer is shared by every document in a
 * run, so the same value gets the same code across files.
 */
export function createNumberer() {
  const codes = new Map(), counters = new Map();
  return (category, value) => {
    const key = category + '\u0000' + value;
    if (!codes.has(key)) {
      const n = (counters.get(category) || 0) + 1;
      counters.set(category, n);
      codes.set(key, `${CATEGORIES[category].label}_${String(n).padStart(2, '0')}`);
    }
    return codes.get(key);
  };
}

export function tokenFor(span, { outputMode, replacement, markDoubt }, numberer) {
  if (outputMode === 'replace') return replacement;
  const q = markDoubt && span.doubt ? '?' : '';
  if (outputMode === 'number') return `[${numberer(span.category, span.value)}${q}]`;
  return `[${CATEGORIES[span.category].label}${q}]`;
}

/**
 * @returns {{text:string, span?:object}[]} plain pieces and replaced pieces, in order.
 * Joining every piece's text gives the de-identified document.
 */
export function redactSegments(text, spans, options, numberer = createNumberer()) {
  const out = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) out.push({ text: text.slice(cursor, span.start) });
    out.push({ text: tokenFor(span, options, numberer), span });
    cursor = span.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

export const joinSegments = segments => segments.map(s => s.text).join('');

/** Count spans per category, in CATEGORIES order. */
export function tally(spans) {
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, 0]));
  for (const s of spans) counts[s.category]++;
  return { counts, total: spans.length, doubt: spans.filter(s => s.doubt).length };
}
