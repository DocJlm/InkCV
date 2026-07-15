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

  await page.getByTestId('template-picker').click();
  await expect(page.locator('.ink-template-grid').getByRole('option')).toHaveCount(4);
  await page.keyboard.press('Escape');

  for (const template of ['onyx', 'lapis', 'minimal-ats', 'compact-tech']) {
    await page.getByTestId('template-picker').click();
    await page.getByTestId(`template-${template}`).click();
    await expect(page.getByTestId('template-picker')).toHaveAttribute('aria-expanded', 'false');
    await waitForPreview(page);
  }

  await expect(page.getByTestId('document-language')).toContainText('English');
  await page.getByTestId('interface-language-zh').click();
  await expect(page.getByTestId('basics-name')).toHaveValue('Round Trip Candidate');
  await expect(page.getByTestId('document-language')).toContainText('English');
  await page.getByTestId('style-toggle').click();
  await page.getByTestId('locale-mode').selectOption('zh');
  await expect(page.getByTestId('basics-name')).toHaveValue('Round Trip Candidate');
  await expect(page.getByTestId('document-language')).toContainText('中文');

  const zoom = page.getByTestId('preview-zoom');
  await expect(zoom).toHaveValue('fit');
  await zoom.selectOption('1');
  const previewWidth = await page.getByTestId('preview').evaluate((node) => node.getBoundingClientRect().width);
  expect(previewWidth).toBeGreaterThan(790);
  expect(previewWidth).toBeLessThan(800);
  await page.getByTestId('preview-fullscreen').click();
  await expect(page.locator('.ink-preview')).toHaveClass(/ink-preview-fullscreen/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ink-preview')).not.toHaveClass(/ink-preview-fullscreen/);

  await page.getByTestId('color-blue').click();
  await expect(page.getByTestId('color-blue')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('color-black').click();
  await expect(page.getByTestId('color-black')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('new-resume').click();
  await page.getByTestId('new-blank').click();
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

test('AI translation creates a validated copy and never overwrites the source', async ({ page }) => {
  await openFreshApp(page);
  await page.getByTestId('basics-name').fill('Source Candidate');
  await expect(page.getByTestId('document-language')).toContainText('English');

  await page.getByTestId('ai-settings').click();
  await page.getByTestId('ai-api-key').fill('test-only-key');
  await page.getByTestId('ai-settings-save').click();

  let requestBody = '';
  await page.route('**/api/ai/chat', async (route) => {
    const body = route.request().postDataJSON() as { options: { user: string } };
    requestBody = body.options.user;
    const payload = JSON.parse(body.options.user) as { basics: unknown; sections: unknown };
    const translateStrings = (value: unknown, key = ''): unknown => {
      if (typeof value === 'string') return key === 'id' ? value : '中文内容';
      if (Array.isArray(value)) return value.map((item) => translateStrings(item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, translateStrings(child, childKey)]));
      }
      return value;
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: JSON.stringify(translateStrings({ basics: payload.basics, sections: payload.sections })) }),
    });
  });

  const sourceItems = page.locator('.ink-doc-item');
  await expect(sourceItems).toHaveCount(1);
  await page.getByTestId('ai-translate-open').click();
  await page.getByTestId('ai-translate-run').click();
  await expect(sourceItems).toHaveCount(2);
  await expect(page.getByTestId('document-language')).toContainText('中文');
  await expect(page.getByTestId('basics-name')).toHaveValue('中文内容');
  expect(requestBody).not.toContain('limo@example.com');
  expect(requestBody).not.toContain('2018-09');

  await sourceItems.last().click();
  await expect(page.getByTestId('document-language')).toContainText('English');
  await expect(page.getByTestId('basics-name')).toHaveValue('Source Candidate');
});

test('workspace splitters support pointer, keyboard, reset and responsive bands', async ({ page }) => {
  await openFreshApp(page);
  const rail = page.locator('.ink-workspace-splitter-rail');
  const editor = page.locator('.ink-workspace-splitter-editor');
  await expect(rail).toBeVisible();
  await rail.focus();
  const before = Number(await rail.getAttribute('aria-valuenow'));
  await page.keyboard.press('Shift+ArrowRight');
  await expect(rail).toHaveAttribute('aria-valuenow', String(before + 40));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('inkcv.workspaceLayout.v1'))).not.toBeNull();
  await rail.dblclick();
  await expect(rail).toHaveAttribute('aria-valuenow', '224');

  const box = await editor.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 3, box!.y + 30);
  await page.mouse.down();
  await page.mouse.move(box!.x + 43, box!.y + 30);
  await page.mouse.up();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(rail).toBeHidden();
  await expect(editor).toBeVisible();
  await page.setViewportSize({ width: 899, height: 900 });
  await expect(editor).toBeHidden();
});
