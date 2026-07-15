import { expect, type Download, type Page } from '@playwright/test';

export async function openFreshApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mimeTypes: string[] = [];
    const createObjectURL = URL.createObjectURL.bind(URL);
    Object.defineProperty(globalThis, '__inkcvBlobMimeTypes', { value: mimeTypes });
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) mimeTypes.push(object.type);
      return createObjectURL(object);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('basics-name')).toBeVisible();
}

export async function waitForPreview(page: Page): Promise<void> {
  await expect(page.getByTestId('preview').locator('canvas').first()).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.ink-preview-err')).toHaveCount(0);
}

export async function exportDownload(page: Page, testId: string): Promise<Download> {
  await page.getByTestId('export-menu').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId(testId).click();
  return await downloadPromise;
}

export async function downloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function expectMagic(bytes: Buffer, magic: string): void {
  expect(bytes.subarray(0, magic.length).toString('binary')).toBe(magic);
}

export async function expectLastBlobMime(page: Page, mime: string): Promise<void> {
  const lastMime = await page.evaluate(() => {
    const types = (globalThis as typeof globalThis & { __inkcvBlobMimeTypes?: string[] }).__inkcvBlobMimeTypes ?? [];
    return types.at(-1);
  });
  expect(lastMime).toBe(mime);
}
