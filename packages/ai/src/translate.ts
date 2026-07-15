import { z } from 'zod';
import { cloneDoc, isFreeform, newId, type ResumeDoc } from '../../core/src/schema';
import { chatComplete } from './client';
import { AiError } from './errors';
import { extractJson } from './jsonUtil';
import type { AiConfig, AiTransport } from './types';

const TranslatedCustomFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

const TranslatedEntrySchema = z.object({
  id: z.string(),
  primary: z.string().optional(),
  secondary: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()),
  bullets: z.array(z.string()),
});

const TranslatedSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  markdown: z.string().optional(),
  entries: z.array(TranslatedEntrySchema).optional(),
});

export const ResumeTranslationSchema = z.object({
  basics: z.object({
    name: z.string(),
    headline: z.string().optional(),
    customFields: z.array(TranslatedCustomFieldSchema),
  }),
  sections: z.array(TranslatedSectionSchema),
});

export type ResumeTranslation = z.infer<typeof ResumeTranslationSchema>;

const TRANSLATE_SYSTEM_PROMPT = `You translate resume content between Simplified Chinese and English.
你负责在简体中文和英文之间翻译简历内容。

Rules:
- Translate every human-readable string in the supplied JSON, including names when a conventional translation or transliteration is clear.
- Preserve every id exactly and preserve all array lengths and ordering.
- Preserve Markdown syntax in markdown strings.
- Preserve technical names, product names, metrics and factual meaning. Never invent facts.
- Output ONLY one JSON object with exactly the same shape. No prose or code fences.`;

/** Build the text-only payload sent to the model. Secrets, photos, dates and URLs are excluded. */
export function resumeTranslationPayload(doc: ResumeDoc, targetLocale: 'zh' | 'en'): object {
  return {
    targetLocale,
    basics: {
      name: doc.basics.name,
      headline: doc.basics.headline,
      customFields: doc.basics.customFields.map((field) => ({
        id: field.id,
        label: field.label,
        value: field.value,
      })),
    },
    sections: doc.sections.map((section) => isFreeform(section)
      ? { id: section.id, title: section.title, markdown: section.markdown }
      : {
          id: section.id,
          title: section.title,
          entries: section.entries.map((entry) => ({
            id: entry.id,
            primary: entry.primary,
            secondary: entry.secondary,
            location: entry.location,
            tags: entry.tags,
            bullets: entry.bullets,
          })),
        }),
  };
}

function assertExactIds(label: string, expected: string[], actual: string[]): void {
  if (new Set(actual).size !== actual.length) {
    throw new AiError('parse', `${label} contains duplicate ids.`);
  }
  if (expected.length !== actual.length || expected.some((id) => !actual.includes(id))) {
    throw new AiError('parse', `${label} ids do not match the source document.`);
  }
}

function validateTranslationShape(doc: ResumeDoc, translation: ResumeTranslation): void {
  assertExactIds(
    'customFields',
    doc.basics.customFields.map((field) => field.id),
    translation.basics.customFields.map((field) => field.id),
  );
  assertExactIds(
    'sections',
    doc.sections.map((section) => section.id),
    translation.sections.map((section) => section.id),
  );

  for (const section of doc.sections) {
    const translated = translation.sections.find((candidate) => candidate.id === section.id)!;
    if (isFreeform(section)) {
      if (translated.markdown === undefined || translated.entries !== undefined) {
        throw new AiError('parse', `Freeform section ${section.id} has an invalid translation shape.`);
      }
      continue;
    }
    if (!translated.entries || translated.markdown !== undefined) {
      throw new AiError('parse', `Structured section ${section.id} has an invalid translation shape.`);
    }
    assertExactIds(
      `entries:${section.id}`,
      section.entries.map((entry) => entry.id),
      translated.entries.map((entry) => entry.id),
    );
    for (const entry of section.entries) {
      const translatedEntry = translated.entries.find((candidate) => candidate.id === entry.id)!;
      if (translatedEntry.tags.length !== entry.tags.length || translatedEntry.bullets.length !== entry.bullets.length) {
        throw new AiError('parse', `Entry ${entry.id} changed tag or bullet counts.`);
      }
    }
  }
}

/** Translate a resume into a new document while preserving the source document unchanged. */
export async function translateResume(
  cfg: AiConfig,
  doc: ResumeDoc,
  targetLocale: 'zh' | 'en',
  transport?: AiTransport,
): Promise<ResumeDoc> {
  const raw = await chatComplete(cfg, {
    system: TRANSLATE_SYSTEM_PROMPT,
    user: JSON.stringify(resumeTranslationPayload(doc, targetLocale)),
    maxTokens: 8192,
  }, transport);
  const parsed = ResumeTranslationSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    throw new AiError('parse', `Translated resume did not match the expected shape: ${parsed.error.message.slice(0, 300)}`);
  }
  validateTranslationShape(doc, parsed.data);

  const next = cloneDoc(doc);
  const now = new Date().toISOString();
  next.meta = { id: newId(), createdAt: now, updatedAt: now };
  next.settings.locale = targetLocale;
  next.settings.localeMode = 'auto';
  next.basics.name = parsed.data.basics.name;
  if (parsed.data.basics.headline === undefined) delete next.basics.headline;
  else next.basics.headline = parsed.data.basics.headline;

  for (const field of next.basics.customFields) {
    const translated = parsed.data.basics.customFields.find((candidate) => candidate.id === field.id)!;
    field.label = translated.label;
    field.value = translated.value;
  }
  for (const section of next.sections) {
    const translated = parsed.data.sections.find((candidate) => candidate.id === section.id)!;
    section.title = translated.title;
    if (isFreeform(section)) {
      section.markdown = translated.markdown!;
      continue;
    }
    for (const entry of section.entries) {
      const translatedEntry = translated.entries!.find((candidate) => candidate.id === entry.id)!;
      for (const key of ['primary', 'secondary', 'location'] as const) {
        const value = translatedEntry[key];
        if (value === undefined) delete entry[key];
        else entry[key] = value;
      }
      entry.tags = translatedEntry.tags;
      entry.bullets = translatedEntry.bullets;
    }
  }
  return next;
}
