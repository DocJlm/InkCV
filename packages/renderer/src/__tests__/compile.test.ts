import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { RESUME_COLOR_PRESETS, cloneDoc, newId } from '../../../core/src/schema';
import { sampleResume } from '../../../core/src/samples';
import { compileResume } from '../compile';
import { templates } from '../templates';
import { resolveTheme } from '../tokens';

const rendererRoot = fileURLToPath(new URL('../../', import.meta.url));
const regularFont = fileURLToPath(new URL('../../assets/fonts/NotoSansSC-Regular.otf', import.meta.url));

function pdfHeader(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes.slice(0, 5));
}

beforeAll(() => {
  if (!existsSync(regularFont)) {
    // Network is available in CI/dev; download the CJK faces the renderer needs.
    execSync('node scripts/fetch-fonts.mjs', { cwd: rendererRoot, stdio: 'inherit' });
  }
}, 120_000);

describe('compileResume', () => {
  it('compiles the zh sample into an embedded-font PDF', async () => {
    const doc = sampleResume('zh');
    const bytes = await compileResume(doc);

    expect(pdfHeader(bytes)).toBe('%PDF-');
    // Embedding a CJK (Noto SC) glyph subset makes the zh PDF ~6x the size of an
    // equivalent Latin-only PDF (measured: zh ≈ 138KB vs en ≈ 21KB). The
    // threshold sits well above the Latin baseline so it genuinely asserts that
    // CJK font data is embedded, while leaving headroom for subset variance.
    expect(bytes.byteLength).toBeGreaterThan(100_000);
  });

  it('compiles the en sample', async () => {
    const doc = sampleResume('en');
    const bytes = await compileResume(doc);

    expect(pdfHeader(bytes)).toBe('%PDF-');
    // eslint-disable-next-line no-console
    console.log(`[size] en sample PDF = ${bytes.byteLength} bytes`);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('falls back to onyx for an unknown template id', async () => {
    const doc = cloneDoc(sampleResume('zh'));
    doc.settings.template = 'this-template-does-not-exist';
    const bytes = await compileResume(doc);
    expect(pdfHeader(bytes)).toBe('%PDF-');
  });

  it('renders a bold CJK bullet without throwing', async () => {
    const doc = cloneDoc(sampleResume('zh'));
    // `.find` narrows to StructuredSection via inferred type predicate (TS 5.5+).
    const firstStructured = doc.sections.find((s) => s.kind !== 'freeform');
    expect(firstStructured).toBeDefined();
    firstStructured!.entries[0]!.bullets.push(
      '**加粗**中文 with `code` and [link](https://example.com)',
    );
    const bytes = await compileResume(doc);
    expect(pdfHeader(bytes)).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  for (const template of templates) {
    for (const locale of ['zh', 'en'] as const) {
      it(`compiles ${template.id} with ${locale} content`, async () => {
        const doc = cloneDoc(sampleResume(locale));
        doc.settings.template = template.id;
        const bytes = await compileResume(doc);
        expect(pdfHeader(bytes)).toBe('%PDF-');
        expect(bytes.byteLength).toBeGreaterThan(0);
      });
    }

    it(`compiles ${template.id} with the blue preset and a photo`, async () => {
      const doc = cloneDoc(sampleResume('zh'));
      doc.settings.template = template.id;
      doc.settings.tokens = { ...doc.settings.tokens, ...RESUME_COLOR_PRESETS.blue };
      doc.basics.photo = {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        visible: true,
      };
      const bytes = await compileResume(doc);
      expect(pdfHeader(bytes)).toBe('%PDF-');
    });

    it(`lets ${template.id} flow long and freeform content across pages`, async () => {
      const doc = cloneDoc(sampleResume('en'));
      doc.settings.template = template.id;
      const experience = doc.sections.find((section) => section.kind === 'experience');
      expect(experience?.kind).toBe('experience');
      if (experience?.kind === 'experience') {
        experience.entries[0]!.bullets = Array.from(
          { length: 24 },
          (_, index) => `Long-form accomplishment ${index + 1} with enough detail to exercise wrapping and page flow.`,
        );
      }
      doc.sections.push({
        id: newId(),
        kind: 'freeform',
        title: 'Additional information',
        visible: true,
        markdown: '**Open source** contributor\n- Available for remote collaboration',
      });
      const bytes = await compileResume(doc);
      expect(pdfHeader(bytes)).toBe('%PDF-');
      expect(bytes.byteLength).toBeGreaterThan(0);
    });
  }

  it('resolves distinct semantic metrics for every template profile', () => {
    const settings = sampleResume('zh').settings;
    const resolved = templates.map((template) => resolveTheme(settings, template.profile));
    expect(new Set(resolved.map((theme) => theme.profile)).size).toBe(4);
    expect(new Set(resolved.map((theme) => theme.size.name)).size).toBe(4);
    expect(resolved.every((theme) => theme.color.accent === RESUME_COLOR_PRESETS.black.accentColor)).toBe(true);
  });
});
