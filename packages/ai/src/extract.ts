/**
 * Extract a structured resume draft from arbitrary text via an LLM, then
 * inflate it into a fully-valid {@link ResumeDoc}.
 *
 * The draft schema is deliberately LOOSE (no ids, everything optional) — it is
 * what we ask the model to emit. `draftToDoc` is what turns it into the strict
 * canonical document (assigning ids and applying schema defaults).
 */
import { z } from 'zod';
import {
  ResumeDoc,
  ResumeDocSchema,
  SCHEMA_VERSION,
  STRUCTURED_KINDS,
  newId,
} from '../../core/src/schema';
import { AiError } from './errors';
import { chatComplete } from './client';
import { extractJson } from './jsonUtil';
import type { AiConfig, AiTransport } from './types';

// ---------------------------------------------------------------------------
// Loose draft schema (the shape we ask the model for)

const DraftContactSchema = z.object({
  type: z.string(),
  value: z.string(),
});

const DraftCustomFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const DraftBasicsSchema = z.object({
  name: z.string().optional(),
  headline: z.string().optional(),
  contacts: z.array(DraftContactSchema).optional(),
  customFields: z.array(DraftCustomFieldSchema).optional(),
});

const DraftEntrySchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
  location: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
});

const DraftStructuredSectionSchema = z.object({
  kind: z.enum(STRUCTURED_KINDS),
  title: z.string(),
  entries: z.array(DraftEntrySchema).default([]),
});

const DraftFreeformSectionSchema = z.object({
  kind: z.literal('freeform'),
  title: z.string(),
  markdown: z.string().default(''),
});

const DraftSectionSchema = z.union([
  DraftStructuredSectionSchema,
  DraftFreeformSectionSchema,
]);

export const ResumeDraftSchema = z.object({
  basics: DraftBasicsSchema.default({}),
  sections: z.array(DraftSectionSchema).default([]),
});

export type ResumeDraft = z.infer<typeof ResumeDraftSchema>;
export type DraftSection = z.infer<typeof DraftSectionSchema>;

// ---------------------------------------------------------------------------
// Prompt

const EXTRACT_SYSTEM_PROMPT = `You are a resume information extractor. 你是简历信息抽取器。

Extract resume information from arbitrary input text into EXACTLY this JSON shape:
将任意输入文本抽取为严格如下结构的 JSON：

{
  "basics": {
    "name": string?,
    "headline": string?,
    "contacts": [{ "type": string, "value": string }]?,
    "customFields": [{ "label": string, "value": string }]?
  },
  "sections": [
    // structured section 结构化段落:
    { "kind": "experience"|"education"|"projects"|"skills"|"awards"|"custom",
      "title": string,
      "entries": [{
        "primary": string?, "secondary": string?, "location": string?,
        "start": string?, "end": string?, "url": string?,
        "tags": string[]?, "bullets": string[]?
      }] }
    // OR freeform section 自由段落:
    | { "kind": "freeform", "title": string, "markdown": string }
  ]
}

Rules 规则:
- Dates: use 'YYYY-MM' when possible; ongoing -> "end": "present". 日期尽量用 'YYYY-MM'，进行中用 "end":"present"。
- primary = company/school/project; secondary = role/degree. primary=公司/学校/项目，secondary=职位/学位。
- bullets = achievement / responsibility lines. bullets 为成就或职责条目。
- Do NOT invent facts; omit unknown fields entirely. 不要编造事实；未知字段直接省略。
- Keep the ORIGINAL language of the content. 保持内容原语言。
- Output ONLY the JSON object, no prose, no code fences. 只输出 JSON 对象，不要解释、不要代码围栏。`;

/** Call the model and parse its output into a loose {@link ResumeDraft}. */
export async function textToResumeDraft(
  cfg: AiConfig,
  rawText: string,
  transport?: AiTransport,
): Promise<ResumeDraft> {
  const raw = await chatComplete(cfg, {
    system: EXTRACT_SYSTEM_PROMPT,
    user: rawText,
    maxTokens: 4096,
  }, transport);
  const json = extractJson(raw);
  const parsed = ResumeDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiError(
      'parse',
      `Extracted draft did not match the expected shape: ${parsed.error.message.slice(0, 300)}`,
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Draft -> canonical document

/**
 * Inflate a loose draft into a strict {@link ResumeDoc}: assign fresh ids
 * everywhere and apply schema defaults. When `base` is provided its
 * `settings` and `meta` are preserved; otherwise sensible defaults are used.
 */
export function draftToDoc(draft: ResumeDraft, base?: ResumeDoc): ResumeDoc {
  const now = new Date().toISOString();
  const meta = base?.meta ?? { id: newId(), createdAt: now, updatedAt: now };

  const contacts = (draft.basics.contacts ?? []).map((c) => ({
    id: newId(),
    type: c.type,
    value: c.value,
    visible: true,
  }));

  const customFields = (draft.basics.customFields ?? []).map((f) => ({
    id: newId(),
    label: f.label,
    value: f.value,
  }));

  const sections = draft.sections.map((s) => {
    if (s.kind === 'freeform') {
      return {
        id: newId(),
        kind: 'freeform' as const,
        title: s.title,
        visible: true,
        markdown: s.markdown ?? '',
      };
    }
    return {
      id: newId(),
      kind: s.kind,
      title: s.title,
      visible: true,
      entries: (s.entries ?? []).map((e) => ({
        id: newId(),
        primary: e.primary,
        secondary: e.secondary,
        location: e.location,
        start: e.start,
        end: e.end,
        url: e.url,
        tags: e.tags ?? [],
        bullets: e.bullets ?? [],
        visible: true,
        extra: {},
      })),
    };
  });

  const docInput = {
    schemaVersion: SCHEMA_VERSION,
    meta,
    basics: {
      name: draft.basics.name ?? '',
      headline: draft.basics.headline,
      contacts,
      customFields,
    },
    sections,
    settings: base?.settings ?? {},
  };

  // `.parse` validates and applies all remaining defaults, and strips the
  // `undefined` optional fields above.
  return ResumeDocSchema.parse(docInput);
}
