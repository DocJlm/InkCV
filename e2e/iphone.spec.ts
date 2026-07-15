import { expect, test } from '@playwright/test';
import { openFreshApp, waitForPreview } from './helpers';

test('iPhone WebKit can edit, preview and reach every export entry', async ({ page }) => {
  await openFreshApp(page);
  await expect(page.locator('.ink-desktop-required')).toBeHidden();
  await page.getByTestId('basics-name').fill('iPhone Candidate');
  await page.getByTestId('mobile-preview').click();
  await waitForPreview(page);
  await page.getByTestId('export-menu').click();
  for (const id of ['export-pdf', 'export-md', 'export-tex', 'export-inkcv']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
