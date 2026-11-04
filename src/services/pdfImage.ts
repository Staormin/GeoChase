import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function openPdfImage(file: File): Promise<PDFDocumentProxy> {
  if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error('PDF too large');
  const task = getDocument({ data: await file.arrayBuffer() });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    throw error;
  }
}

export async function renderPdfImage(document: PDFDocumentProxy, pageNumber: number) {
  const page = await document.getPage(pageNumber);
  const canvas = window.document.createElement('canvas');
  try {
    // PDF.js applies CropBox, page rotation and UserUnit in this viewport.
    // At scale 1 its dimensions are physical PDF points (1/72 inch).
    const paper = page.getViewport({ scale: 1 });
    if (![paper.width, paper.height].every((value) => Number.isFinite(value) && value > 0))
      throw new Error('Invalid PDF dimensions');
    // Rendering quality never changes the geographic footprint. Bound memory use
    // for unusually large paper formats while retaining up to 300 DPI of detail.
    const scale = Math.min(300 / 72, 4096 / Math.max(paper.width, paper.height));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    // The default intent draws on animation frames, which never come in a background tab.
    await page.render({ canvas, viewport, background: 'white', intent: 'print' }).promise;
    const encode = (type: string) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('PDF conversion failed'))),
          type,
          0.95
        )
      );
    let blob = await encode('image/png');
    if (blob.size > 25 * 1024 * 1024) blob = await encode('image/jpeg');
    return {
      blob,
      paperWidth: (paper.width * 0.0254) / 72,
      paperHeight: (paper.height * 0.0254) / 72,
    };
  } finally {
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
}
