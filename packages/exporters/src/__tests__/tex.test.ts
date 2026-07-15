import { describe, it, expect } from 'vitest';
import { ResumeDoc, ResumeDocSchema, SCHEMA_VERSION, PRESENT } from '../../../core/src/schema';
import { sampleResume } from '../../../core/src/samples';
import { exportTex, texTemplates } from '../tex';
import { escapeLatex, mdInlineToLatex } from '../latexEscape';
import { exportTexBundle } from '../texBundle';
import { strFromU8, unzipSync } from 'fflate';

function makeDoc(input: {
  locale?: 'zh' | 'en';
  texTemplate?: string;
  sections?: unknown[];
  name?: string;
}): ResumeDoc {
  return ResumeDocSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    meta: { id: 'test', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    basics: { name: input.name ?? 'Test User', contacts: [], customFields: [] },
    sections: input.sections ?? [],
    settings: { locale: input.locale ?? 'en', texTemplate: input.texTemplate ?? 'moderncv-like' },
  });
}

describe('escapeLatex', () => {
  it('escapes all LaTeX specials, backslash first without double-escaping', () => {
    expect(escapeLatex('50% & #1_test {x}')).toBe('50\\% \\& \\#1\\_test \\{x\\}');
    expect(escapeLatex('a\\b')).toBe('a\\textbackslash{}b');
    expect(escapeLatex('~^')).toBe('\\textasciitilde{}\\textasciicircum{}');
    expect(escapeLatex('$100')).toBe('\\$100');
  });
});

describe('mdInlineToLatex', () => {
  it('converts inline markdown and escapes surrounding text', () => {
    expect(mdInlineToLatex('**bold**')).toBe('\\textbf{bold}');
    expect(mdInlineToLatex('*italic*')).toBe('\\textit{italic}');
    expect(mdInlineToLatex('`code`')).toBe('\\texttt{code}');
    expect(mdInlineToLatex('[t](u)')).toBe('\\href{u}{t}');
  });
  it('escapes specials inside and around tokens', () => {
    expect(mdInlineToLatex('100% **a & b**')).toBe('100\\% \\textbf{a \\& b}');
  });
});

describe('exportTex sample resumes', () => {
  for (const locale of ['zh', 'en'] as const) {
    it(`produces a compilable-looking document for ${locale}`, () => {
      const out = exportTex(sampleResume(locale));
      expect(out).toContain('\\documentclass');
      expect(out).toContain('\\end{document}');
      expect(out).not.toContain('undefined');
      expect(out).not.toContain('<%');
    });
  }

  it('loads ctex for zh but not for pure-latin en', () => {
    expect(exportTex(sampleResume('zh'))).toContain('\\usepackage[UTF8]{ctex}');
    expect(exportTex(sampleResume('en'))).not.toContain('\\usepackage[UTF8]{ctex}');
  });

  it('loads ctex when an en-locale document contains CJK content', () => {
    const doc = sampleResume('en');
    doc.basics.name = '手写测试';
    expect(exportTex(doc)).toContain('\\usepackage[UTF8]{ctex}');
  });

  it('maps PRESENT to the locale-specific word', () => {
    expect(exportTex(sampleResume('zh'))).toContain('至今');
    expect(exportTex(sampleResume('en'))).toContain('Present');
  });
});

describe('exportTex escaping', () => {
  it('escapes LaTeX specials appearing in a bullet', () => {
    const doc = makeDoc({
      locale: 'en',
      sections: [
        {
          id: 's1',
          kind: 'experience',
          title: 'Experience',
          visible: true,
          entries: [
            {
              id: 'e1',
              primary: 'Co',
              tags: [],
              bullets: ['50% & #1_test {x}'],
              visible: true,
              extra: {},
            },
          ],
        },
      ],
    });
    const out = exportTex(doc);
    expect(out).toContain('50\\% \\& \\#1\\_test \\{x\\}');
    expect(out).not.toContain('50% ');
  });
});

describe('exportTex visibility filtering', () => {
  it('omits invisible sections and entries', () => {
    const doc = makeDoc({
      locale: 'en',
      sections: [
        {
          id: 's1',
          kind: 'experience',
          title: 'Experience',
          visible: true,
          entries: [
            { id: 'e1', primary: 'VisibleCo', tags: [], bullets: [], visible: true, extra: {} },
            { id: 'e2', primary: 'HiddenCo', tags: [], bullets: [], visible: false, extra: {} },
          ],
        },
        {
          id: 's2',
          kind: 'awards',
          title: 'SecretSectionTitle',
          visible: false,
          entries: [
            { id: 'e3', primary: 'SecretEntry', tags: [], bullets: [], visible: true, extra: {} },
          ],
        },
      ],
    });
    const out = exportTex(doc);
    expect(out).toContain('VisibleCo');
    expect(out).not.toContain('HiddenCo');
    expect(out).not.toContain('SecretSectionTitle');
    expect(out).not.toContain('SecretEntry');
  });
});

describe('exportTex template selection', () => {
  it('renders both registered template ids', () => {
    for (const t of texTemplates) {
      const out = exportTex(sampleResume('en', '2024-01-01'));
      expect(out).toContain('\\documentclass');
      // and the selected one:
      const doc = makeDoc({ locale: 'en', texTemplate: t.id });
      expect(exportTex(doc)).toContain('\\documentclass');
      expect(exportTex(doc)).not.toContain('<%');
    }
    expect(texTemplates.map((t) => t.id).sort()).toEqual(['moderncv-like', 'simple-cv']);
  });

  it('falls back to moderncv-like for an unknown template id', () => {
    const doc = makeDoc({ locale: 'en', texTemplate: 'does-not-exist' });
    const out = exportTex(doc);
    expect(out).toContain('\\documentclass');
    // moderncv-like uses xcolor; simple-cv does not.
    expect(out).toContain('\\usepackage{xcolor}');
  });
});

describe('exportTexBundle', () => {
  it('returns a zip containing TeX and an inline photo', () => {
    const doc = sampleResume('en', '2024-01-01');
    doc.basics.photo = { src: 'data:image/jpeg;base64,/9j/2Q==', visible: true };
    const bundle = exportTexBundle(doc, 'resume');
    expect(bundle.kind).toBe('zip');
    if (bundle.kind !== 'zip') return;
    const files = unzipSync(bundle.data);
    expect(Object.keys(files).sort()).toEqual(['photo.jpg', 'resume.tex']);
    expect(strFromU8(files['resume.tex']!)).toContain('includegraphics');
  });

  it('keeps plain TeX for documents without an inline photo', () => {
    expect(exportTexBundle(sampleResume('en')).kind).toBe('tex');
  });
});
