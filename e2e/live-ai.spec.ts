import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

const liveKey = process.env.INKCV_LIVE_AI_KEY;

test('production DeepSeek import, polish, auth error and secret lifecycle', async ({ page, request, baseURL }) => {
  test.setTimeout(300_000);
  test.skip(!liveKey, 'INKCV_LIVE_AI_KEY is required for the production live-AI gate');
  expect(new URL(baseURL!).hostname).toBe('inkcv.vercel.app');
  await openFreshApp(page);

  await page.getByTestId('ai-settings').click();
  await page.getByTestId('ai-provider').selectOption('deepseek');
  await page.getByTestId('ai-api-key').fill(liveKey!);
  await page.getByTestId('ai-settings-save').click();

  await page.getByTestId('ai-import').click();
  await page.getByTestId('ai-import-text').fill(
    '李明，前端工程师。2022年7月至今在示例科技负责 React 和 TypeScript，主导性能优化，将 LCP 从 3.2 秒降低到 1.4 秒。',
  );
  await page.getByTestId('ai-import-convert').click();
  await expect(page.getByTestId('ai-import-replace')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('ai-import-replace').click();
  await expect(page.getByTestId('basics-name')).toHaveValue(/李明/);

  await page.getByTestId('ai-import').click();
  await page.getByTestId('ai-import-text').fill(
    'Alex Chen, product engineer. Since March 2023 at Example Labs, built a TypeScript workflow used by 20 teams and reduced release time by 60 percent.',
  );
  await page.getByTestId('ai-import-convert').click();
  await expect(page.getByTestId('ai-import-replace')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('ai-import-replace').click();
  await expect(page.getByTestId('basics-name')).toHaveValue(/Alex Chen/i);

  const polish = page.getByTestId('ai-polish-open').first();
  await expect(polish).toBeVisible();
  await polish.click();
  await page.getByTestId('ai-polish-run').click();
  await expect(page.getByTestId('ai-polish-apply')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('ai-polish-apply').click();

  const leaked = await page.evaluate((key) => {
    const storage = `${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`;
    return storage.includes(key);
  }, liveKey!);
  expect(leaked).toBe(false);

  await page.getByTestId('ai-settings').click();
  await page.getByTestId('ai-provider').selectOption('deepseek');
  await page.getByTestId('ai-api-key').fill('sk-invalid-inkcv-release-check');
  await page.getByTestId('ai-settings-save').click();
  await page.getByTestId('ai-import').click();
  await page.getByTestId('ai-import-text').fill('Invalid key check');
  await page.getByTestId('ai-import-convert').click();
  await expect(page.getByText('Invalid API key or no permission. Check the key in AI settings.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'close' }).click();

  await page.getByTestId('ai-settings').click();
  await page.getByRole('button', { name: 'Clear config' }).click();

  const response = await request.post('/api/ai/chat', {
    headers: { origin: new URL(baseURL!).origin, 'content-type': 'application/json' },
    data: {},
  });
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
});
