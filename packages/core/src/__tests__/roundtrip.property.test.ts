import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  Entry,
  ResumeDoc,
  ResumeDocSchema,
  SCHEMA_VERSION,
  STRUCTURED_KINDS,
} from '../schema';
import { serializeResumeToMarkdown } from '../markdown/serialize';
import { applyMarkdownToDoc } from '../markdown/reconcile';

const NOW = '2026-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Generators. Character pool deliberately includes the dialect's structural
// characters (| @ \ : # – ~ -) plus CJK, so escaping is actually exercised.

const TEXT_CHARS = [
  ...'abcXYZ019',
  ...'张三简历工程师至今',
  '|', '@', '\\', ':', '#', '–', '~', '-', '.', '(', ')', '%', '&', '*', '$', "'", '"', ' ',
];

const arbText = fc
  .array(fc.constantFrom(...TEXT_CHARS), { minLength: 1, maxLength: 24 })
  .map((a) => a.join(''))
  .filter((s) => s.trim() === s && s !== '');

const arbTextOpt = fc.option(arbText, { nil: undefined });

const arbDate = fc.oneof(
  fc.constant('present'),
  fc.integer({ min: 1990, max: 2030 }).map(String),
  fc
    .tuple(fc.integer({ min: 1990, max: 2030 }), fc.integer({ min: 1, max: 12 }))
    .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
  fc
    .tuple(fc.integer({ min: 1990, max: 2030 }), fc.integer({ min: 1, max: 12 }))
    .map(([y, m]) => `${y}.${m}`),
  fc
    .tuple(fc.integer({ min: 1990, max: 2030 }), fc.integer({ min: 1, max: 12 }))
    .map(([y, m]) => `${y}年${m}月`),
);

const arbTag = fc
  .array(fc.constantFrom(...TEXT_CHARS.filter((c) => c !== ',')), { minLength: 1, maxLength: 10 })
  .map((a) => a.join(''))
  .filter((s) => s.trim() === s && s !== '');

const RESERVED = new Set(['url', 'tags', 'start', 'end', 'role', 'loc']);
const arbExtraKey = fc
  .array(fc.constantFrom(...'abcxyz键值中文09_- '), { minLength: 1, maxLength: 8 })
  .map((a) => a.join(''))
  .filter(
    (s) =>
      s.trim() === s &&
      s !== '' &&
      !RESERVED.has(s.toLowerCase()) &&
      s !== '!hidden' &&
      !/^_seg\d+$/.test(s),
  );

const arbExtra = fc.dictionary(arbExtraKey, arbText, { maxKeys: 2 });

const arbEntry: fc.Arbitrary<Entry> = fc
  .record({
    primary: arbTextOpt,
    secondary: arbTextOpt,
    location: arbTextOpt,
    start: fc.option(arbDate, { nil: undefined }),
    end: fc.option(arbDate, { nil: undefined }),
    url: arbTextOpt,
    tags: fc.array(arbTag, { maxLength: 3 }),
    bullets: fc.array(arbText, { maxLength: 3 }),
    visible: fc.boolean(),
    extra: arbExtra,
  })
  .map((e, ) => ({ id: 'placeholder', ...stripUndefined(e) }) as Entry);

const arbFreeformLine = fc.oneof(
  fc.constant(''),
  arbText,
  arbText.map((t) => `## ${t}`),
  arbText.map((t) => `\\## ${t}`),
  fc.constant('##'),
  arbText.map((t) => `### ${t}`),
  arbText.map((t) => `- ${t}`),
  fc.constant('---'),
);

const arbFreeformMarkdown = fc
  .array(arbFreeformLine, { minLength: 1, maxLength: 5 })
  .map((lines) => lines.join('\n'))
  .map((s) => s.replace(/^\n+/, '').replace(/\n+$/, ''))
  .filter((s) => s !== '');

const arbTitle = fc.oneof(arbText, fc.constant(''));

const arbSection = fc.oneof(
  fc.record({
    kind: fc.constantFrom(...STRUCTURED_KINDS),
    title: arbTitle,
    visible: fc.boolean(),
    entries: fc.array(arbEntry, { maxLength: 3 }),
  }),
  fc.record({
    kind: fc.constant('freeform' as const),
    title: arbTitle,
    visible: fc.boolean(),
    markdown: arbFreeformMarkdown,
  }),
);

const arbSettings = fc.record({
  template: fc.constantFrom('onyx', 'lapis', 'minimal-ats', 'compact-tech'),
  texTemplate: fc.constantFrom('moderncv-like', 'simple-cv'),
  locale: fc.constantFrom('zh' as const, 'en' as const),
  localeMode: fc.constantFrom('auto' as const, 'zh' as const, 'en' as const),
  page: fc.record({
    size: fc.constantFrom('A4' as const, 'Letter' as const),
    margin: fc.integer({ min: 8, max: 30 }),
  }),
  tokens: fc.record({
    fontFamily: fc.constantFrom('sans' as const, 'serif' as const),
    fontSize: fc.constantFrom(8, 9, 9.5, 10, 10.5, 11, 12, 14),
    lineHeight: fc.constantFrom(1.2, 1.35, 1.4, 1.5, 1.75, 2),
    accentColor: fc.constantFrom('#2f5c8f', '#000000', '#ff5722'),
    textColor: fc.constantFrom('#1a1a1a', '#333333'),
    spacing: fc.constantFrom(0.8, 1, 1.25),
  }),
});

const arbBasics = fc.record({
  name: fc.oneof(arbText, fc.constant('')),
  headline: arbTextOpt,
  photo: fc.option(
    fc.record({ src: arbText, visible: fc.boolean() }),
    { nil: undefined },
  ),
  contacts: fc.array(
    fc.record({
      type: fc.oneof(fc.constantFrom('email', 'phone', 'github', 'url'), arbText),
      value: arbText,
      visible: fc.boolean(),
    }),
    { maxLength: 3 },
  ),
  customFields: fc.array(fc.record({ label: arbText, value: arbText }), { maxLength: 2 }),
});

const arbDoc: fc.Arbitrary<ResumeDoc> = fc
  .record({
    basics: arbBasics,
    sections: fc.array(arbSection, { maxLength: 5 }),
    settings: arbSettings,
  })
  .map(({ basics, sections, settings }) => {
    const doc = {
      schemaVersion: SCHEMA_VERSION,
      meta: { id: 'doc1', createdAt: NOW, updatedAt: NOW },
      basics: {
        ...stripUndefined(basics),
        contacts: basics.contacts.map((c, i) => ({ ...c, id: `c${i}` })),
        customFields: basics.customFields.map((f, i) => ({ ...f, id: `f${i}` })),
      },
      sections: sections.map((s, i) =>
        s.kind === 'freeform'
          ? { ...s, id: `s${i}` }
          : { ...s, id: `s${i}`, entries: s.entries.map((e, j) => ({ ...e, id: `s${i}e${j}` })) },
      ),
      settings,
    };
    return ResumeDocSchema.parse(doc);
  });

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

/** Remove ids and meta so content can be compared across independent imports. */
function stripIds(doc: ResumeDoc): unknown {
  return {
    basics: {
      ...doc.basics,
      contacts: doc.basics.contacts.map(({ id: _id, ...rest }) => rest),
      customFields: doc.basics.customFields.map(({ id: _id, ...rest }) => rest),
    },
    sections: doc.sections.map((s) =>
      s.kind === 'freeform'
        ? { kind: s.kind, title: s.title, visible: s.visible, markdown: s.markdown }
        : {
            kind: s.kind,
            title: s.title,
            visible: s.visible,
            entries: s.entries.map(({ id: _id, ...rest }) => rest),
          },
    ),
    settings: doc.settings,
  };
}

// ---------------------------------------------------------------------------

describe('markdown round-trip properties', () => {
  it('serialize → apply(prev=doc) is the identity', () => {
    fc.assert(
      fc.property(arbDoc, (doc) => {
        const md = serializeResumeToMarkdown(doc);
        const { doc: doc2 } = applyMarkdownToDoc(md, doc, { now: doc.meta.updatedAt });
        expect(doc2).toEqual(doc);
      }),
      { numRuns: 300 },
    );
  });

  it('serialize is a fixpoint after one round-trip', () => {
    fc.assert(
      fc.property(arbDoc, (doc) => {
        const md = serializeResumeToMarkdown(doc);
        const doc2 = applyMarkdownToDoc(md, doc, { now: doc.meta.updatedAt }).doc;
        expect(serializeResumeToMarkdown(doc2)).toBe(md);
      }),
      { numRuns: 150 },
    );
  });

  it('importing without prev preserves all content (ids regenerated)', () => {
    fc.assert(
      fc.property(arbDoc, (doc) => {
        const md = serializeResumeToMarkdown(doc);
        const imported = applyMarkdownToDoc(md, null, { now: NOW }).doc;
        expect(stripIds(imported)).toEqual(stripIds(doc));
      }),
      { numRuns: 150 },
    );
  });

  it('round-trip emits no warnings for canonical documents', () => {
    fc.assert(
      fc.property(arbDoc, (doc) => {
        const md = serializeResumeToMarkdown(doc);
        const { warnings } = applyMarkdownToDoc(md, doc, { now: doc.meta.updatedAt });
        expect(warnings).toEqual([]);
      }),
      { numRuns: 150 },
    );
  });
});
