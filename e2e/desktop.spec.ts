import path from 'node:path';
import { expect, test } from '@playwright/test';
import { downloadBytes, expectLastBlobMime, expectMagic, exportDownload, openFreshApp, waitForPreview } from './helpers';

test('form, Markdown, persistence, templates and color presets stay in sync', async ({ page }) => {
  await openFreshApp(page);
  await waitForPreview(page);

  const name = page.getByTestId('basics-name');
  await name.fill('E2E Candidate');
  await page.waitForTimeout(900);
  await page.reload();
  await expect(name).toHaveValue('E2E Candidate');

  await page.getByTestId('mode-markdown').click();
  const editor = page.getByTestId('markdown-editor').locator('.cm-content');
  await expect(editor).toContainText('E2E Candidate');
  const markdown = await editor.evaluate((node) => (node as HTMLElement).innerText);
  await editor.fill(markdown.replace('E2E Candidate', 'Round Trip Candidate'));
  await page.waitForTimeout(1_000);
  await page.getByTestId('mode-form').click();
  await expect(page.getByTestId('basics-name')).toHaveValue('Round Trip Candidate');

  for (const template of ['onyx', 'lapis', 'classic', 'minimal-ats']) {
    await page.getByTestId('template-picker').click();
    await page.getByTestId(`template-${template}`).click();
    await expect(page.getByTestId('template-picker')).toHaveAttribute('aria-expanded', 'false');
    await waitForPreview(page);
  }

  await page.getByTestId('style-toggle').click();
  await page.getByTestId('color-blue').click();
  await expect(page.getByTestId('color-blue')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('color-black').click();
  await expect(page.getByTestId('color-black')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('new-resume').click();
  await page.getByRole('menuitem', { name: 'Blank résumé' }).click();
  await expect(page.getByTestId('basics-name')).toHaveValue('');
});

test('photo crop, all exports and atomic backup conflict flow work', async ({ page }, testInfo) => {
  await openFreshApp(page);
  const photoPath = path.resolve('docs/images/screenshot-en.png');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('photo-upload').click();
  await (await chooserPromise).setFiles(photoPath);
  const crop = page.getByRole('dialog', { name: 'Crop photo' });
  await expect(crop).toBeVisible();
  await crop.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('photo-url')).toHaveValue(/^data:image\/jpeg;base64,/);
  await waitForPreview(page);

  const pdf = await exportDownload(page, 'export-pdf');
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await expectLastBlobMime(page, 'application/pdf');
  const pdfBytes = await downloadBytes(pdf);
  expectMagic(pdfBytes, '%PDF-');
  expect(pdfBytes.length).toBeGreaterThan(10_000);

  const markdown = await exportDownload(page, 'export-md');
  await expectLastBlobMime(page, 'text/markdown');
  const markdownBytes = await downloadBytes(markdown);
  expect(markdown.suggestedFilename()).toMatch(/\.md$/);
  expect(markdownBytes.toString('utf8')).toContain('template:');

  const latex = await exportDownload(page, 'export-tex');
  expect(latex.suggestedFilename()).toMatch(/\.zip$/);
  await expectLastBlobMime(page, 'application/zip');
  expectMagic(await downloadBytes(latex), 'PK');

  const backup = await exportDownload(page, 'export-inkcv');
  expect(backup.suggestedFilename()).toMatch(/\.inkcv$/);
  await expectLastBlobMime(page, 'application/json');
  const backupBytes = await downloadBytes(backup);
  const parsed = JSON.parse(backupBytes.toString('utf8')) as { format?: unknown; formatVersion?: unknown };
  expect(parsed).toMatchObject({ format: 'inkcv', formatVersion: 1 });

  const backupPath = testInfo.outputPath('roundtrip.inkcv');
  await backup.saveAs(backupPath);
  const backupChooser = page.waitForEvent('filechooser');
  await page.getByTestId('backup-import').click();
  await (await backupChooser).setFiles(backupPath);
  const conflict = page.getByRole('dialog', { name: 'This résumé already exists' });
  await expect(conflict).toBeVisible();
  await conflict.getByRole('button', { name: 'Import copy' }).click();
  await expect(page.getByTestId('basics-name')).toHaveValue(/copy/);
});

test('the local AI proxy rejects missing credentials without caching', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const response = await request.post('/api/ai/chat', {
    headers: { origin, 'content-type': 'application/json' },
    data: {},
  });
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
  await expect(response.json()).resolves.toEqual({ error: 'missing_api_key' });
});
