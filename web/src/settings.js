// Website settings = the extension's settings shape (core/settings.js) plus a few
// website-only options (outputMode, markDoubt, pdfJoinLines). Sharing the shape keeps the two products interchangeable.
import OOOSettings from '../../core/settings.js';
import { OUTPUT_MODES } from './redact.js';

export const STORAGE_KEY = 'ooo-web-settings-v1';

// Documents for de-identification usually carry contact details, so the website masks
// e-mail and phone numbers by default; the extension leaves them off.
const WEB_RULE_DEFAULTS = { email: true, phone: true };

export function normalizeWeb(value) {
  value = value || {};
  const core = OOOSettings.normalize({ ...value, rules: { ...WEB_RULE_DEFAULTS, ...value.rules } });
  return {
    ...core,
    outputMode: OUTPUT_MODES.includes(value.outputMode) ? value.outputMode : 'replace',
    markDoubt: typeof value.markDoubt === 'boolean' ? value.markDoubt : false,
    pdfJoinLines: typeof value.pdfJoinLines === 'boolean' ? value.pdfJoinLines : true,
  };
}

// Manual names are real people's names. They live only in this tab's memory and are
// never written to browser storage, which may be shared on a workstation.
const NOT_PERSISTED = ['manualNames'];

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function loadSettings(store = storage()) {
  try {
    const raw = store && store.getItem(STORAGE_KEY);
    return normalizeWeb(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeWeb({});
  }
}

export function saveSettings(settings, store = storage()) {
  const kept = { ...settings };
  for (const key of NOT_PERSISTED) delete kept[key];
  try { store && store.setItem(STORAGE_KEY, JSON.stringify(kept)); } catch { /* private mode etc. */ }
}

/** One entry per line (or comma), trimmed, blanks dropped. */
export const parseList = text => String(text || '').split(/[\r\n,，]+/).map(s => s.trim()).filter(Boolean);
