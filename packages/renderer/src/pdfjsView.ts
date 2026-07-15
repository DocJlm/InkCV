/**
 * Render PDF bytes into a container element using pdfjs-dist.
 *
 * pdfjs is imported dynamically (inside the function) so this module is safe to
 * import from Node without pulling in browser-only worker code at load time.
 */

let workerConfigured = false;

export interface RenderPdfOptions {
  /** Base render scale before device-pixel-ratio sharpening. Default 1.5. */
  scale?: number;
  /** Cancels loading and any active page render when a newer frame supersedes it. */
  signal?: AbortSignal;
}

export async function renderPdfToCanvas(
  bytes: Uint8Array,
  container: HTMLElement,
  opts?: RenderPdfOptions,
): Promise<void> {
  const pdfjs = await import('pdfjs-dist');

  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  const scale = opts?.scale ?? 1.5;
  const signal = opts?.signal;
  const dpr = Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  // pdfjs takes ownership of the buffer it is given; hand it a private copy so
  // the caller's bytes stay usable (e.g. for re-render or download).
  const data = bytes.slice();
  const loadingTask = pdfjs.getDocument({ data });
  const cancelLoading = () => void loadingTask.destroy();
  signal?.addEventListener('abort', cancelLoading, { once: true });
  if (signal?.aborted) cancelLoading();
  const doc = await loadingTask.promise;

  // Build the new canvases off-DOM, then swap them in atomically to avoid a
  // flash of empty/partial content between frames.
  const fragment = document.createDocumentFragment();

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      signal?.throwIfAborted();
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';

      const base = { canvas, viewport };
      const renderParams =
        dpr !== 1 ? { ...base, transform: [dpr, 0, 0, dpr, 0, 0] } : base;

      const renderTask = page.render(renderParams);
      const cancelRender = () => renderTask.cancel();
      signal?.addEventListener('abort', cancelRender, { once: true });
      try {
        await renderTask.promise;
      } finally {
        signal?.removeEventListener('abort', cancelRender);
      }
      fragment.appendChild(canvas);
    }

    container.replaceChildren(fragment);
  } finally {
    signal?.removeEventListener('abort', cancelLoading);
    // Release the worker-side document and its buffers.
    void loadingTask.destroy();
  }
}
