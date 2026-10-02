// Page controller: wires the form, the files and the result view together.
// Detection lives in engine.js (→ core/), output in redact.js, markup in render.js.
import { detect, CATEGORIES } from './engine.js';
import { createNumberer, joinSegments, redactSegments, tally } from './redact.js';
import { loadSettings, normalizeWeb, parseList, saveSettings } from './settings.js';
import { categoryCss, escapeHtml, highlightHtml, PREVIEW_LIMIT, redactedHtml } from './render.js';
import { fileKind, readFileText } from './read-file.js';

const $ = id => document.getElementById(id);

let settings = loadSettings();
const state = {
  files: [],        // File objects waiting to be processed
  docs: [],         // [{name, text, error, spans, segments, output, tally}] from the last run
  active: 0,
  view: 'redacted', // 'redacted' | 'highlight'
};
const textCache = new WeakMap(); // File → {text|error}; re-analysis never re-reads a PDF

/* ---------- settings form ---------- */

// Checkbox id → path inside the settings object. Ids match extension/popup.html.
const CHECKS = {
  ruleNames: ['rules', 'names'], ruleMrn: ['rules', 'medicalRecordNumber'],
  ruleBirthDate: ['rules', 'birthDate'], ruleNationalId: ['rules', 'nationalId'],
  ruleEmail: ['rules', 'email'], rulePhone: ['rules', 'phone'],
  givenNames: ['givenNames'], mrnKeepDefault: ['mrnKeepDefault'], mrnExcludeDates: ['mrnExcludeDates'],
  markDoubt: ['markDoubt'],
};
const SELECTS = ['surnameLimit', 'dateMode', 'mrnMode'];
const LISTS = ['manualNames', 'keepWords'];

function paintSettings() {
  for (const [id, [a, b]] of Object.entries(CHECKS)) $(id).checked = !!(b ? settings[a][b] : settings[a]);
  for (const id of SELECTS) $(id).value = String(settings[id]);
  for (const id of LISTS) $(id).value = settings[id].join('\n');
  $('mrnPatterns').value = settings.mrnPatterns.join('\n');
  $('replacement').value = settings.replacement;
  for (const r of document.querySelectorAll('input[name=outputMode]')) r.checked = r.value === settings.outputMode;
  $('mrnCustom').classList.toggle('hidden', settings.mrnMode !== 'custom');
  $('replacementRow').classList.toggle('hidden', settings.outputMode !== 'replace');
}

function readSettingsForm() {
  const next = structuredClone(settings);
  for (const [id, [a, b]] of Object.entries(CHECKS)) {
    if (b) next[a][b] = $(id).checked; else next[a] = $(id).checked;
  }
  for (const id of SELECTS) next[id] = id === 'surnameLimit' ? Number($(id).value) : $(id).value;
  for (const id of LISTS) next[id] = parseList($(id).value);
  next.mrnPatterns = $('mrnPatterns').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  next.replacement = $('replacement').value.trim() || 'OOO';
  next.outputMode = document.querySelector('input[name=outputMode]:checked')?.value;
  return normalizeWeb(next);
}

$('settings').addEventListener('change', () => {
  settings = readSettingsForm();
  saveSettings(settings);
  paintSettings();
  if (state.docs.length) { analyze(); renderResults(); }
});

/* ---------- inputs ---------- */

const drop = $('drop'), fileInput = $('fileInput');
drop.addEventListener('click', () => fileInput.click());
for (const type of ['dragover', 'dragenter']) drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('hot'); });
for (const type of ['dragleave', 'drop']) drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('hot'); });
drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
fileInput.addEventListener('change', e => { addFiles(e.target.files); fileInput.value = ''; });
$('pasteBox').addEventListener('input', updateRunButton);

function addFiles(list) {
  for (const f of list) {
    if (fileKind(f) && !state.files.some(x => x.name === f.name && x.size === f.size)) state.files.push(f);
  }
  renderFileList();
  updateRunButton();
}

function renderFileList() {
  $('fileList').innerHTML = state.files.map((f, i) =>
    `<li><span class="tag">${fileKind(f).toUpperCase()}</span><span class="fn" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>` +
    `<span class="st">${Math.max(1, Math.round(f.size / 1024))} KB</span><button type="button" class="rm" data-i="${i}" title="移除" aria-label="移除 ${escapeHtml(f.name)}">×</button></li>`).join('');
}
$('fileList').addEventListener('click', e => {
  const btn = e.target.closest('.rm');
  if (!btn) return;
  state.files.splice(Number(btn.dataset.i), 1);
  renderFileList();
  updateRunButton();
});

function updateRunButton() {
  const count = state.files.length + ($('pasteBox').value.trim() ? 1 : 0);
  $('runBtn').disabled = !count;
  $('runBtn').textContent = count ? `開始去識別化（${count} 個項目）` : '請先選擇檔案或貼上文字';
}

/* ---------- run ---------- */

$('runBtn').addEventListener('click', run);

async function run() {
  const btn = $('runBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>處理中…';
  const docs = [];
  for (const file of state.files) {
    if (!textCache.has(file)) textCache.set(file, await readFileText(file));
    docs.push({ name: file.name, ...textCache.get(file) });
  }
  const pasted = $('pasteBox').value;
  if (pasted.trim()) docs.push({ name: '貼上文字', text: pasted });
  state.docs = docs;
  state.active = 0;
  analyze();
  renderResults();
  updateRunButton();
}

// All documents of one run share a name index and a numbering, like one page in the extension.
function analyze() {
  const readable = state.docs.filter(d => !d.error);
  const spans = detect(readable.map(d => d.text), settings);
  const numberer = createNumberer();
  readable.forEach((doc, i) => {
    // With doubt marking off, nothing anywhere (tokens, highlight, tally) is shown as doubtful.
    doc.spans = settings.markDoubt ? spans[i] : spans[i].map(s => ({ ...s, doubt: false }));
    doc.segments = redactSegments(doc.text, doc.spans, settings, numberer);
    doc.output = joinSegments(doc.segments);
    doc.tally = tally(doc.spans);
  });
}

/* ---------- results ---------- */

function renderResults() {
  $('emptyState').classList.add('hidden');
  $('resultBody').classList.remove('hidden');
  const tabs = $('fileTabs');
  tabs.classList.toggle('hidden', state.docs.length < 2);
  tabs.innerHTML = state.docs.map((d, i) =>
    `<button type="button" role="tab" data-i="${i}" class="${i === state.active ? 'on' : ''}" aria-selected="${i === state.active}" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</button>`).join('');
  renderActive();
}
$('fileTabs').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.active = Number(btn.dataset.i);
  renderResults();
});

function renderActive() {
  const doc = state.docs[state.active];
  const view = $('docView'), trunc = $('truncNote');
  trunc.classList.add('hidden');
  if (doc.error) {
    $('tally').innerHTML = `<span class="chip err">⚠ ${escapeHtml(doc.error)}</span>`;
    view.innerHTML = '';
    return;
  }
  const { counts, total, doubt } = doc.tally;
  const chips = Object.entries(counts).filter(([, n]) => n).map(([key, n]) =>
    `<span class="chip cat-${key}"><span class="dot"></span>${CATEGORIES[key].label}<span class="n">${n}</span></span>`);
  $('tally').innerHTML = `<span class="chip total">共遮蔽 <span class="n">${total}</span> 項</span>` +
    (chips.length ? chips.join('') : '<span class="chip">沒有偵測到符合規則的個資</span>') +
    (doubt ? `<span class="chip doubt">疑義 <span class="n">${doubt}</span></span>` : '');
  const { html, truncated } = state.view === 'redacted'
    ? redactedHtml(doc.segments)
    : highlightHtml(doc.text, doc.spans);
  view.innerHTML = html;
  view.scrollTop = 0;
  if (truncated) {
    trunc.classList.remove('hidden');
    trunc.textContent = `預覽只顯示前 ${PREVIEW_LIMIT.toLocaleString()} 字（全文 ${doc.text.length.toLocaleString()} 字）。複製與下載的是完整內容。`;
  }
}

function setView(view) {
  state.view = view;
  $('viewRedacted').classList.toggle('on', view === 'redacted');
  $('viewHighlight').classList.toggle('on', view === 'highlight');
  renderActive();
}
function setWrap(on) {
  $('wrapOn').classList.toggle('on', on);
  $('wrapOff').classList.toggle('on', !on);
  $('docView').classList.toggle('nowrap', !on);
}
$('viewRedacted').addEventListener('click', () => setView('redacted'));
$('viewHighlight').addEventListener('click', () => setView('highlight'));
$('wrapOn').addEventListener('click', () => setWrap(true));
$('wrapOff').addEventListener('click', () => setWrap(false));

/* ---------- export ---------- */

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, 1400);
}

$('copyBtn').addEventListener('click', async () => {
  const doc = state.docs[state.active];
  if (!doc || doc.error) return;
  try {
    await navigator.clipboard.writeText(doc.output);
    flash($('copyBtn'), '已複製 ✓');
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: doc.output });
    Object.assign(ta.style, { position: 'fixed', left: '-9999px' });
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* reported below */ }
    ta.remove();
    flash($('copyBtn'), ok ? '已複製 ✓' : '請手動複製');
  }
});

function download(name, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('dlOne').addEventListener('click', () => {
  const doc = state.docs[state.active];
  if (doc && !doc.error) download(doc.name.replace(/\.(pdf|txt)$/i, '') + '_deid.txt', doc.output);
});
$('dlAll').addEventListener('click', () => {
  if (!state.docs.length) return;
  download('deidentified_all.txt', state.docs.map(d =>
    `===== ${d.name} =====\n${d.error ? `[${d.error}]` : d.output}`).join('\n\n\n'));
});

/* ---------- start ---------- */

const style = document.createElement('style');
style.textContent = categoryCss();
document.head.append(style);
paintSettings();
updateRunButton();
