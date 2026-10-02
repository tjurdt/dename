// Reading uploaded files into plain text. Uses the pdf.js build inlined into the page
// (window.pdfjsLib) and runs its worker from the inlined #pdfjsWorker script, so nothing
// is ever fetched from the network.

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

/** Text of every page; items on one baseline join into a line, pages are blank-line separated. */
export async function extractPdfText(file) {
  const pdf = await pdfjs().getDocument({ data: await file.arrayBuffer() }).promise;
  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let lastY = null, line = '';
    const lines = [];
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; lastY = null; } else lastY = y;
    }
    if (line) lines.push(line);
    full += lines.join('\n');
    if (p < pdf.numPages) full += '\n\n';
  }
  return full;
}

/** @returns {Promise<{text?:string, error?:string}>} */
export async function readFileText(file) {
  const kind = fileKind(file);
  try {
    if (kind === 'txt') return { text: await file.text() };
    const text = await extractPdfText(file);
    if (!text.trim()) return { error: '此 PDF 沒有可擷取的文字層（可能是掃描影像，需先 OCR）。' };
    return { text };
  } catch {
    return { error: '讀取失敗（檔案可能損毀或受密碼保護）。' };
  }
}
