import { z } from 'zod';
import { nanoid } from 'nanoid';

/**
 * InkCV canonical resume data model.
 *
 * Design invariants (see docs/design.md):
 * - The JSON document is the single source of truth; the Markdown dialect and
 *   the form UI are both projections of it.
 * - `sections` array order is the authoritative render order.
 * - Every section/entry carries a stable id (nanoid) so both editing views can
 *   reconcile without losing identity.
 * - Content and theme (`settings`) are fully separated.
 * - Nothing locale-specific is hardcoded: Chinese-market fields such as
 *   政治面貌 live in `basics.customFields`.
 * - Parsers must never drop data: anything unrecognized lands in `extra`.
 */

export const SCHEMA_VERSION = 1;

/** Special `end` value meaning "ongoing"; rendered as 至今/Present by locale. */
export const PRESENT = 'present';

export const newId = (): string => nanoid(10);

// ---------------------------------------------------------------------------
// Basics

export const ContactSchema = z.object({
  id: z.string(),
  /** Open set: 'email' | 'phone' | 'url' | 'github' | 'wechat' | ... */
  type: z.string(),
  value: z.string(),
  visible: z.boolean().default(true),
});
export type Contact = z.infer<typeof ContactSchema>;

export const CustomFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});
export type CustomField = z.infer<typeof CustomFieldSchema>;

export const PhotoSchema = z.object({
  /** data URL or (desktop) file path. */
  src: z.string(),
  visible: z.boolean().default(true),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const BasicsSchema = z.object({
  name: z.string().default(''),
  headline: z.string().optional(),
  photo: PhotoSchema.optional(),
  contacts: z.array(ContactSchema).default([]),
  customFields: z.array(CustomFieldSchema).default([]),
});
export type Basics = z.infer<typeof BasicsSchema>;

// ---------------------------------------------------------------------------
// Sections

export const STRUCTURED_KINDS = [
  'experience',
  'education',
  'projects',
  'skills',
  'awards',
  'custom',
] as const;
export type StructuredKind = (typeof STRUCTURED_KINDS)[number];

export const EntrySchema = z.object({
  id: z.string(),
  /** Company / school / project name. */
  primary: z.string().optional(),
  /** Role / degree. */
  secondary: z.string().optional(),
  location: z.string().optional(),
  /** Free-form date string, canonically 'YYYY-MM'. */
  start: z.string().optional(),
  /** Free-form date string, or PRESENT. */
  end: z.string().optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** One line each; inline Markdown (bold/italic/link/code) allowed. */
  bullets: z.array(z.string()).default([]),
  visible: z.boolean().default(true),
  /** Key-value overflow: unrecognized data is preserved here, never dropped. */
  extra: z.record(z.string(), z.string()).default({}),
});
export type Entry = z.infer<typeof EntrySchema>;

const sectionBase = {
  id: z.string(),
  title: z.string(),
  visible: z.boolean().default(true),
};

export const StructuredSectionSchema = z.object({
  ...sectionBase,
  kind: z.enum(STRUCTURED_KINDS),
  entries: z.array(EntrySchema).default([]),
});
export type StructuredSection = z.infer<typeof StructuredSectionSchema>;

export const FreeformSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal('freeform'),
  /** Arbitrary Markdown, preserved verbatim. */
  markdown: z.string().default(''),
});
export type FreeformSection = z.infer<typeof FreeformSectionSchema>;

export const SectionSchema = z.union([StructuredSectionSchema, FreeformSectionSchema]);
export type Section = z.infer<typeof SectionSchema>;

export const isFreeform = (s: Section): s is FreeformSection => s.kind === 'freeform';

// ---------------------------------------------------------------------------
// Theme / settings (content-independent)

export const RESUME_COLOR_PRESETS = {
  black: { accentColor: '#1a1a1a', textColor: '#1a1a1a' },
  blue: { accentColor: '#2f5c8f', textColor: '#1a1a1a' },
} as const;
export type ResumeColorPresetId = keyof typeof RESUME_COLOR_PRESETS;

export const ThemeTokensSchema = z.object({
  /** Font family class; concrete faces are resolved by the renderer. */
  fontFamily: z.enum(['sans', 'serif']).default('sans'),
  /** Base body size in pt. */
  fontSize: z.number().min(8).max(14).default(10),
  /**
   * Body line height multiplier. Renderers must clamp to >= 1.4 for zh
   * content (react-pdf clips CJK glyphs below ~1.35).
   */
  lineHeight: z.number().min(1.1).max(2.2).default(1.5),
  /** Accent color for headings/rules, hex. */
  accentColor: z.string().default('#2f5c8f'),
  textColor: z.string().default('#1a1a1a'),
  /** Global spacing multiplier applied to section/entry gaps. */
  spacing: z.number().min(0.6).max(1.8).default(1),
});
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;

export const PageSettingsSchema = z.object({
  size: z.enum(['A4', 'Letter']).default('A4'),
  /** Page margin in mm. */
  margin: z.number().min(8).max(30).default(14),
});
export type PageSettings = z.infer<typeof PageSettingsSchema>;

export const SettingsSchema = z.object({
  /** PDF template id, e.g. 'onyx'. */
  template: z.string().default('onyx'),
  /** .tex export template id; independent from the PDF template. */
  texTemplate: z.string().default('moderncv-like'),
  /** Content locale: affects date words (至今/Present) and renderer clamps. */
  locale: z.enum(['zh', 'en']).default('zh'),
  tokens: ThemeTokensSchema.default({}),
  page: PageSettingsSchema.default({}),
});
export type Settings = z.infer<typeof SettingsSchema>;

// ---------------------------------------------------------------------------
// Document

export const MetaSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Meta = z.infer<typeof MetaSchema>;

export const ResumeDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  meta: MetaSchema,
  basics: BasicsSchema,
  sections: z.array(SectionSchema).default([]),
  settings: SettingsSchema.default({}),
});
export type ResumeDoc = z.infer<typeof ResumeDocSchema>;

// ---------------------------------------------------------------------------
// Constructors

export function createEmptyResume(locale: 'zh' | 'en' = 'zh', now?: string): ResumeDoc {
  const ts = now ?? new Date().toISOString();
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  return ResumeDocSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    meta: { id: newId(), createdAt: ts, updatedAt: ts },
    basics: { name: '', contacts: [], customFields: [] },
    sections: [
      { id: newId(), kind: 'education', title: t('教育经历', 'Education'), visible: true, entries: [] },
      { id: newId(), kind: 'experience', title: t('工作经历', 'Experience'), visible: true, entries: [] },
      { id: newId(), kind: 'projects', title: t('项目经历', 'Projects'), visible: true, entries: [] },
      { id: newId(), kind: 'skills', title: t('专业技能', 'Skills'), visible: true, entries: [] },
    ],
    settings: {
      locale,
      template: locale === 'zh' ? 'lapis' : 'onyx',
      tokens: RESUME_COLOR_PRESETS.black,
    },
  });
}

/** Deep-clone helper used by editors before mutating drafts. */
export const cloneDoc = (doc: ResumeDoc): ResumeDoc => structuredClone(doc);
