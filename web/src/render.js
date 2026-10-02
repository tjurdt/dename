// HTML string builders for the result view. Pure; every piece of user text is escaped here.
import { CATEGORIES } from './engine.js';

export const PREVIEW_LIMIT = 60000;

export const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function tip(span) {
  const label = CATEGORIES[span.category].label;
  return span.doubt ? `${label}（疑義，請人工確認）` : label;
}

/** De-identified view: replaced pieces become tokens. Stops after `limit` characters. */
export function redactedHtml(segments, limit = PREVIEW_LIMIT) {
  let html = '', used = 0, truncated = false;
  for (const seg of segments) {
    if (used >= limit) { truncated = true; break; }
    const text = seg.text.slice(0, limit - used);
    if (text.length < seg.text.length) truncated = true;
    used += text.length;
    html += seg.span
      ? `<span class="tok cat-${seg.span.category}${seg.span.doubt ? ' doubt' : ''}" title="${escapeHtml(tip(seg.span))}">${escapeHtml(text)}</span>`
      : escapeHtml(text);
  }
  return { html, truncated };
}

/** Original text with every detected span highlighted in its category colour. */
export function highlightHtml(text, spans, limit = PREVIEW_LIMIT) {
  let html = '', cursor = 0;
  for (const span of spans) {
    if (span.start >= limit) break;
    html += escapeHtml(text.slice(cursor, span.start));
    html += `<mark class="cat-${span.category}${span.doubt ? ' doubt' : ''}" title="${escapeHtml(tip(span))}">${escapeHtml(text.slice(span.start, Math.min(span.end, limit)))}</mark>`;
    cursor = Math.min(span.end, limit);
  }
  html += escapeHtml(text.slice(cursor, limit));
  return { html, truncated: text.length > limit };
}

/** Per-category colour rules, generated so CATEGORIES stays the single source. */
export function categoryCss() {
  return Object.entries(CATEGORIES).map(([key, { color }]) =>
    `.cat-${key}{--cat:${color}}`).join('\n');
}
