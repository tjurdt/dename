// The website's only door into the shared detection engine in core/.
// Everything here is pure: text in, categorised spans out. No DOM.
import MaskOOO from '../../core/masker.js';

/** Display metadata per category. Order is the order chips and legends appear in. */
export const CATEGORIES = {
  name: { label: '姓名', color: '#d6336c' },
  id: { label: '身分證', color: '#c92a2a' },
  mrn: { label: '病歷號', color: '#0f766e' },
  date: { label: '出生日期', color: '#546274' },
  email: { label: '電子郵件', color: '#b45309' },
  phone: { label: '電話', color: '#1d4ed8' },
  custom: { label: '自訂', color: '#7c3aed' },
};

// core/masker.js tags each span with the rule that produced it.
const CATEGORY_BY_REASON = {
  id: 'id', mrn: 'mrn', date: 'date', email: 'email', phone: 'phone',
  'manual-name': 'custom',
};

export function categoryOf(reason) {
  return CATEGORY_BY_REASON[reason] || 'name';
}

// A bare surname + characters guess with no field, label, title or published given name
// behind it. These are the spans worth a second look.
export function isDoubtful(reason) {
  return reason === 'surname-heuristic';
}

/**
 * Detect sensitive spans in several texts at once. Like one web page in the extension,
 * all texts share a name index, so a full name in one file also unlocks its given-name
 * alias in another.
 * @param {string[]} texts
 * @param {object} settings  normalised settings (see settings.js)
 * @returns {{start:number,end:number,value:string,reason:string,category:string,doubt:boolean}[][]}
 */
export function detect(texts, settings) {
  const manualNames = settings.manualNames || [];
  const keepWords = settings.keepWords || [];
  const index = MaskOOO.buildNameIndex(texts.map(text => ({ text })), settings, manualNames, keepWords);
  const context = { knownNames: index.knownNames, givenNames: index.givenNames, manualNames, keepWords };
  return texts.map(text => MaskOOO.analyze(text, settings, context).spans.map(s => ({
    start: s.start,
    end: s.end,
    value: text.slice(s.start, s.end),
    reason: s.reason,
    category: categoryOf(s.reason),
    doubt: isDoubtful(s.reason),
  })));
}
