// Reading uploaded files. Uses the pdf.js build inlined into the page (window.pdfjsLib)
// and runs its worker from the inlined #pdfjsWorker script, so nothing is ever fetched
// from the network. Turning the result into text lives in pdf-text.js / sourceText().
import { itemsToLines, normalizeCjk, pagesToText } from './pdf-text.js';

export function fileKind(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) return 'txt';
  return null;
}

let workerReady = false;
function pdfjs() {
  const lib = globalThis.pdfjsLib;
  if (!workerReady) {
    const code = document.getElementById('pdfjsWorker').textContent;
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    workerReady = true;
  }
  return lib;
}

/** @returns {Promise<ReturnType<typeof itemsToLines>[]>} the lines of every page */
async function extractPdfPages(file) {
  const pdf = await pdfjs().getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    pages.push(itemsToLines(content.items));
  }
  return pages;
}

/**
 * What a file holds, before any text options are applied:
 * {pages} for a PDF (kept as lines so line-joining can be toggled without re-reading),
 * {text} for a TXT, or {error}.
 */
export async function readFileSource(file) {
  try {
    if (fileKind(file) === 'txt') return { text: await file.text() };
    const pages = await extractPdfPages(file);
    if (!pages.some(lines => lines.length)) return { error: '此 PDF 沒有可擷取的文字層（可能是掃描影像，需先 OCR）。' };
    return { pages };
  } catch {
    return { error: '讀取失敗（檔案可能損毀或受密碼保護）。' };
  }
}

/** The text to analyse for a source, under the current settings. */
export function sourceText(source, { pdfJoinLines = true } = {}) {
  const raw = source.pages ? pagesToText(source.pages, { joinWraps: pdfJoinLines }) : source.text;
  return normalizeCjk(raw);
}
