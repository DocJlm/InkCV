import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const root = process.cwd();
const baseURL = 'http://127.0.0.1:5173';
const outputDir = path.join(root, 'docs', 'images');
const serverCommand = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
const serverArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'pnpm --filter @inkcv/web dev --host 127.0.0.1']
  : ['--filter', '@inkcv/web', 'dev', '--host', '127.0.0.1'];
const server = spawn(serverCommand, serverArgs, {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for the InkCV dev server.');
}

const demos = {
  en: {
    locale: 'en-US',
    input: 'Alex Chen, product engineer. Built a TypeScript workflow used by 20 teams and reduced release time by 60 percent.',
    draft: {
      basics: { name: 'Alex Chen', headline: 'Product Engineer', contacts: [{ type: 'email', value: 'alex@example.com' }] },
      sections: [{ kind: 'experience', title: 'Experience', entries: [{ primary: 'Example Labs', secondary: 'Product Engineer', start: '2023-03', end: 'present', bullets: ['Built a TypeScript workflow used by 20 teams', 'Reduced release time by 60%'] }] }],
    },
  },
  zh: {
    locale: 'zh-CN',
    input: '李明，前端工程师。主导 React 与 TypeScript 工程化，将 LCP 从 3.2 秒降低到 1.4 秒。',
    draft: {
      basics: { name: '李明', headline: '前端工程师', contacts: [{ type: 'email', value: 'liming@example.com' }] },
      sections: [{ kind: 'experience', title: '工作经历', entries: [{ primary: '示例科技', secondary: '前端工程师', start: '2022-07', end: 'present', bullets: ['主导 React 与 TypeScript 工程化', '将 LCP 从 3.2 秒降低到 1.4 秒'] }] }],
    },
  },
};

function resizeRgba(source, sourceWidth, sourceHeight, targetWidth) {
  const targetHeight = Math.round(sourceHeight * targetWidth / sourceWidth);
  const output = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor(y * sourceHeight / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(x * sourceWidth / targetWidth));
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
      const targetOffset = (y * targetWidth + x) * 4;
      output.set(source.subarray(sourceOffset, sourceOffset + 4), targetOffset);
    }
  }
  return { data: output, width: targetWidth, height: targetHeight };
}

async function captureLanguage(browser, language) {
  const demo = demos[language];
  const frames = [];
  const context = await browser.newContext({ locale: demo.locale, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.route('**/api/ai/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify({ text: JSON.stringify(demo.draft) }),
    });
  });
  await page.goto(baseURL);
  await page.getByTestId('basics-name').waitFor();
  await page.getByTestId('ai-settings').click();
  await page.getByTestId('ai-provider').selectOption('deepseek');
  await page.getByTestId('ai-api-key').fill('sk-demo-not-a-real-key');
  await page.getByTestId('ai-settings-save').click();

  const snap = async (hold = 2) => {
    const bytes = await page.screenshot();
    const decoded = PNG.sync.read(bytes);
    const resized = resizeRgba(decoded.data, decoded.width, decoded.height, 960);
    for (let index = 0; index < hold; index += 1) {
      frames.push(resized);
    }
  };

  await snap(4);
  await page.getByTestId('ai-import').click();
  await page.getByTestId('ai-import-text').fill(demo.input);
  await snap(4);
  await page.getByTestId('ai-import-convert').click();
  await page.getByTestId('ai-import-replace').waitFor();
  await snap(4);
  await page.getByTestId('ai-import-replace').click();
  await page.getByTestId('basics-name').waitFor();
  await snap(5);
  await page.getByTestId('template-picker').click();
  await page.getByTestId('template-lapis').click();
  await page.getByTestId('style-toggle').click();
  await page.getByTestId('color-blue').click();
  await page.waitForTimeout(1_500);
  await snap(5);
  await page.getByTestId('export-menu').click();
  await snap(5);
  await page.screenshot({ path: path.join(outputDir, `screenshot-${language}.png`) });

  await context.close();
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const indexed = applyPalette(frame.data, palette);
    gif.writeFrame(indexed, frame.width, frame.height, { palette, delay: 250 });
  }
  gif.finish();
  await writeFile(path.join(outputDir, `demo-${language}.gif`), gif.bytes());

  const mobile = await browser.newContext({ ...devices['Pixel 5'], locale: demo.locale });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseURL);
  await mobilePage.getByTestId('basics-name').waitFor();
  await mobilePage.getByTestId('mobile-preview').click();
  await mobilePage.getByTestId('preview').locator('canvas').first().waitFor({ timeout: 45_000 });
  await mobilePage.screenshot({ path: path.join(outputDir, `mobile-${language}.png`), fullPage: true });
  await mobile.close();
}

await mkdir(outputDir, { recursive: true });
try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    await captureLanguage(browser, 'zh');
    await captureLanguage(browser, 'en');
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}

console.log('Generated bilingual GIFs and desktop/mobile screenshots in docs/images.');
