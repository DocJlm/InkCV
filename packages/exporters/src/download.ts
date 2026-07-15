/**
 * Browser download helper.
 *
 * Node-safe at import time: no DOM globals are touched at module load, only
 * inside {@link downloadFile}. Calling it outside a browser throws.
 */

/**
 * Trigger a browser download of `data` as a file named `filename`.
 *
 * @throws if called outside a browser (no `document`).
 */
export function downloadFile(
  data: Uint8Array | string,
  filename: string,
  mime: string,
): void {
  if (typeof document === 'undefined') {
    throw new Error('downloadFile is only available in a browser environment');
  }
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
