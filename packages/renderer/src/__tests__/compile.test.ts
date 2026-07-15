import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { RESUME_COLOR_PRESETS, cloneDoc, newId } from '../../../core/src/schema';
import { sampleResume } from '../../../core/src/samples';
import { compileResume } from '../compile';
import { getTemplate, templates } from '../templates';
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
  it('registers only the four supported templates', () => {
    expect(templates.map((template) => template.id)).toEqual([
      'onyx',
      'lapis',
      'minimal-ats',
      'compact-tech',
    ]);
  });

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

  it('falls back to onyx for removed template ids', () => {
    for (const id of ['classic', 'section-rail', 'timeline', 'profile']) {
      expect(getTemplate(id).id).toBe('onyx');
    }
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
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loading = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
      const pdf = await loading.promise;
      try {
        expect(pdf.numPages).toBeGreaterThan(1);
      } finally {
        await loading.destroy();
      }
    });
  }

  it('resolves distinct semantic metrics for every template profile', () => {
    const settings = sampleResume('zh').settings;
    const resolved = templates.map((template) => resolveTheme(settings, template.profile));
    expect(new Set(resolved.map((theme) => theme.profile)).size).toBe(templates.length);
    const layoutSignatures = resolved.map((theme) => JSON.stringify({
      header: theme.layout.headerVariant,
      section: theme.layout.sectionVariant,
      align: theme.layout.headerAlign,
      rule: theme.layout.sectionRule,
      name: theme.size.name,
      sectionSize: theme.size.sectionTitle,
    }));
    expect(new Set(layoutSignatures).size).toBe(templates.length);
    expect(resolved.every((theme) => theme.color.accent === RESUME_COLOR_PRESETS.black.accentColor)).toBe(true);
  });

  it('produces distinct name, section and date coordinates for all four layouts', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const signatures: string[] = [];
    for (const template of templates) {
      const source = cloneDoc(sampleResume('en'));
      source.settings.template = template.id;
      const loading = pdfjs.getDocument({ data: (await compileResume(source)).slice(), useSystemFonts: true });
      const pdf = await loading.promise;
      try {
        const page = await pdf.getPage(1);
        const content = await page.getTextContent();
        const items = content.items.filter((item): item is typeof item & { str: string; transform: number[] } =>
          'str' in item && 'transform' in item,
        );
        const position = (text: string) => {
          const item = items.find((candidate) => candidate.str.toLocaleLowerCase().includes(text.toLocaleLowerCase()));
          expect(item, `${template.id} should render ${text}`).toBeDefined();
          return `${Math.round(item!.transform[4] ?? 0)},${Math.round(item!.transform[5] ?? 0)}`;
        };
        signatures.push([position(source.basics.name), position(source.sections[0]!.title), position('2018-09')].join('|'));
      } finally {
        await loading.destroy();
      }
    }
    expect(new Set(signatures).size).toBe(templates.length);
  });

});
