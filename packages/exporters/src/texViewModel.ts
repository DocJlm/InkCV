/**
 * Builds a plain-data view model consumed by the Mustache `.tex` templates.
 *
 * Everything in the returned object is already LaTeX-safe: text is escaped with
 * either {@link mdInlineToLatex} (bullet lines / freeform content, which may
 * contain inline Markdown) or {@link escapeLatex} (names, titles, dates, etc.).
 * Templates therefore emit values verbatim (with Mustache's HTML escaping
 * disabled).
 *
 * NOTE: photos are intentionally NOT modelled here — the v1 `.tex` export does
 * not support `basics.photo`. `hasPhoto` is ignored.
 */
import { Entry, PRESENT, ResumeDoc, Section } from '../../core/src/schema';
import { escapeLatex, mdInlineToLatex } from './latexEscape';

export interface TexBullet {
  text: string;
}

export interface TexEntry {
  primary: string;
  hasPrimary: boolean;
  secondary: string;
  hasSecondary: boolean;
  location: string;
  hasLocation: boolean;
  dates: string;
  hasDates: boolean;
  url: string;
  hasUrl: boolean;
  tags: string;
  hasTags: boolean;
  bullets: TexBullet[];
  hasBullets: boolean;
}

export interface TexCustomField {
  label: string;
  value: string;
}

export interface TexSection {
  title: string;
  isFreeform: boolean;
  /** Structured sections only. */
  entries: TexEntry[];
  hasEntries: boolean;
  /** Freeform sections only. */
  paragraphs: TexBullet[];
  hasParagraphs: boolean;
  bullets: TexBullet[];
  hasBullets: boolean;
}

export interface TexViewModel {
  isZh: boolean;
  /** Content (not just locale) contains CJK → templates must load ctex. */
  hasCjk: boolean;
  name: string;
  headline: string;
  hasHeadline: boolean;
  contactsLine: string;
  hasContacts: boolean;
  customFields: TexCustomField[];
  hasCustomFields: boolean;
  hasPhoto: boolean;
  photoFileName: string;
  /** Page margin in mm (from settings.page.margin). */
  margin: number;
  sections: TexSection[];
}

function formatDates(
  start: string | undefined,
  end: string | undefined,
  isZh: boolean,
): string {
  const s = (start ?? '').trim();
  let e = (end ?? '').trim();
  if (e === PRESENT) e = isZh ? '至今' : 'Present';
  const parts: string[] = [];
  if (s) parts.push(escapeLatex(s));
  if (e) parts.push(escapeLatex(e));
  return parts.join(' -- ');
}

/** Split freeform Markdown into paragraph blocks and `- ` bullet lines. */
function splitFreeform(markdown: string): { paragraphs: TexBullet[]; bullets: TexBullet[] } {
  const paragraphs: TexBullet[] = [];
  const bullets: TexBullet[] = [];
  const lines = (markdown ?? '').split(/\r?\n/);
  let para: string[] = [];
  const flush = (): void => {
    if (para.length > 0) {
      paragraphs.push({ text: mdInlineToLatex(para.join(' ')) });
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flush();
      continue;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flush();
      bullets.push({ text: mdInlineToLatex(bulletMatch[1] ?? '') });
    } else {
      para.push(line);
    }
  }
  flush();
  return { paragraphs, bullets };
}

function buildEntry(entry: Entry, isZh: boolean): TexEntry {
  const primary = escapeLatex(entry.primary ?? '');
  const secondary = escapeLatex(entry.secondary ?? '');
  const location = escapeLatex(entry.location ?? '');
  const dates = formatDates(entry.start, entry.end, isZh);
  const url = escapeLatex(entry.url ?? '');
  const tags = entry.tags.filter((t) => t.trim() !== '');
  const bullets = entry.bullets
    .filter((b) => b.trim() !== '')
    .map((b) => ({ text: mdInlineToLatex(b) }));
  return {
    primary,
    hasPrimary: primary !== '',
    secondary,
    hasSecondary: secondary !== '',
    location,
    hasLocation: location !== '',
    dates,
    hasDates: dates !== '',
    url,
    hasUrl: url !== '',
    tags: tags.map((t) => escapeLatex(t)).join(', '),
    hasTags: tags.length > 0,
    bullets,
    hasBullets: bullets.length > 0,
  };
}

function buildSection(section: Section, isZh: boolean): TexSection {
  const title = escapeLatex(section.title);
  if (section.kind === 'freeform') {
    const { paragraphs, bullets } = splitFreeform(section.markdown);
    return {
      title,
      isFreeform: true,
      entries: [],
      hasEntries: false,
      paragraphs,
      hasParagraphs: paragraphs.length > 0,
      bullets,
      hasBullets: bullets.length > 0,
    };
  }
  const entries = section.entries
    .filter((e) => e.visible)
    .map((e) => buildEntry(e, isZh));
  return {
    title,
    isFreeform: false,
    entries,
    hasEntries: entries.length > 0,
    paragraphs: [],
    hasParagraphs: false,
    bullets: [],
    hasBullets: false,
  };
}

/** Build the LaTeX view model from a resume document. */
export function buildTexViewModel(doc: ResumeDoc): TexViewModel {
  const isZh = doc.settings.locale === 'zh';
  // ctex must be included whenever the CONTENT contains CJK, not just when the
  // locale is zh — otherwise XeLaTeX renders CJK as missing glyphs.
  const hasCjk = isZh || /[　-〿㐀-鿿豈-﫿]/.test(JSON.stringify(doc));
  const contacts = doc.basics.contacts
    .filter((c) => c.visible && c.value.trim() !== '')
    .map((c) => escapeLatex(c.value));
  const customFields = doc.basics.customFields
    .filter((f) => f.label.trim() !== '' || f.value.trim() !== '')
    .map((f) => ({ label: escapeLatex(f.label), value: escapeLatex(f.value) }));
  const headline = escapeLatex(doc.basics.headline ?? '');
  const sections = doc.sections
    .filter((s) => s.visible)
    .map((s) => buildSection(s, isZh));
  return {
    isZh,
    hasCjk,
    name: escapeLatex(doc.basics.name),
    headline,
    hasHeadline: headline !== '',
    contactsLine: contacts.join('  $\\cdot$  '),
    hasContacts: contacts.length > 0,
    customFields,
    hasCustomFields: customFields.length > 0,
    hasPhoto: !!doc.basics.photo?.visible && /^data:image\/(?:jpeg|jpg|png);base64,/i.test(doc.basics.photo.src),
    photoFileName: /^data:image\/png;base64,/i.test(doc.basics.photo?.src ?? '') ? 'photo.png' : 'photo.jpg',
    margin: doc.settings.page.margin,
    sections,
  };
}
