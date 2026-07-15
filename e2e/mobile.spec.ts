import { expect, test } from '@playwright/test';
import { downloadBytes, expectMagic, exportDownload, openFreshApp, waitForPreview } from './helpers';

test('Android editing, Markdown, preview, drawer and PDF export work', async ({ page }) => {
  await openFreshApp(page);
  await expect(page.locator('.ink-desktop-required')).toBeHidden();
  await page.getByTestId('basics-name').fill('Android Candidate');

  await page.getByTestId('mode-markdown').click();
  await expect(page.getByTestId('markdown-editor')).toContainText('Android Candidate');
  await page.getByTestId('mode-form').click();
  await expect(page.getByTestId('basics-name')).toHaveValue('Android Candidate');

  await page.getByTestId('mobile-preview').click();
  await waitForPreview(page);
  const pdf = await exportDownload(page, 'export-pdf');
  expectMagic(await downloadBytes(pdf), '%PDF-');

  await page.getByTestId('mobile-edit').click();
  await page.getByTestId('open-resumes').click();
  await expect(page.getByTestId('ai-settings')).toBeVisible();
  await expect(page.getByTestId('backup-import')).toBeVisible();
});
