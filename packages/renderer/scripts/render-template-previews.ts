import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sampleResume } from '../../core/src/samples';
import { compileResume } from '../src/compile';
import { templates } from '../src/templates';

const tempDir = fileURLToPath(new URL('../.preview-temp/', import.meta.url));
const outputDir = fileURLToPath(
  new URL('../../ui/src/assets/template-previews/', import.meta.url),
);
const pdftoppm = process.env['INKCV_PDFTOPPM'] || 'pdftoppm';

await mkdir(tempDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

try {
  for (const template of templates) {
    for (const locale of ['zh', 'en'] as const) {
      const doc = sampleResume(locale, '2026-01-01T00:00:00.000Z');
      doc.settings.template = template.id;
      const pdfPath = `${tempDir}/${template.id}-${locale}.pdf`;
      const outputBase = `${outputDir}/${template.id}-${locale}`;
      await writeFile(pdfPath, await compileResume(doc));

      const result = spawnSync(
        pdftoppm,
        ['-f', '1', '-singlefile', '-png', '-scale-to-x', '320', '-scale-to-y', '-1', pdfPath, outputBase],
        { stdio: 'inherit', shell: process.platform === 'win32' && !process.env['INKCV_PDFTOPPM'] },
      );
      if (result.status !== 0) {
        throw new Error(`pdftoppm failed for ${template.id}-${locale}`);
      }
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
