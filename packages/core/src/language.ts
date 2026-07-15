import type { ResumeDoc } from './schema';

export type ResumeLocale = 'zh' | 'en';

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const LATIN_RE = /[A-Za-z]/g;
const URL_RE = /(?:https?:\/\/|www\.)\S+|\b\S+@\S+\.\S+\b/gi;

/**
 * Detect the formatting locale from user-visible, translatable resume text.
 * Contacts, URLs, dates, photos and metadata intentionally do not participate.
 */
export function detectResumeLocale(doc: ResumeDoc): ResumeLocale {
  const text = collectTranslatableText(doc).replace(URL_RE, ' ');
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const latin = text.match(LATIN_RE)?.length ?? 0;
  if (cjk === 0 && latin === 0) return doc.settings.locale;
  return cjk >= 4 && cjk / (cjk + latin) >= 0.15 ? 'zh' : 'en';
}

/** Resolve the explicit formatting override before falling back to detection. */
export function resolveResumeLocale(doc: ResumeDoc): ResumeLocale {
  const mode = doc.settings.localeMode;
  return mode === 'zh' || mode === 'en' ? mode : detectResumeLocale(doc);
}

function collectTranslatableText(doc: ResumeDoc): string {
  const chunks: string[] = [doc.basics.name, doc.basics.headline ?? ''];
  for (const field of doc.basics.customFields) chunks.push(field.label, field.value);
  for (const section of doc.sections) {
    if (!section.visible) continue;
    chunks.push(section.title);
    if (section.kind === 'freeform') {
      chunks.push(section.markdown);
      continue;
    }
    for (const entry of section.entries) {
      if (!entry.visible) continue;
      chunks.push(
        entry.primary ?? '',
        entry.secondary ?? '',
        entry.location ?? '',
        ...entry.tags,
        ...entry.bullets,
      );
    }
  }
  return chunks.join('\n');
}
