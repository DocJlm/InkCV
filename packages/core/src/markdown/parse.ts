import * as YAML from 'yaml';
import {
  PageSettingsSchema,
  Photo,
  Settings,
  SettingsSchema,
  STRUCTURED_KINDS,
  StructuredKind,
  ThemeTokensSchema,
} from '../schema';
import { unescapeFreeformLine } from './escape';
import { ParsedEntryLine, parseEntryLine } from './entryLine';

// ---------------------------------------------------------------------------
// Diagnostics

export type MdWarningCode =
  | 'no-frontmatter'
  | 'yaml-loose'
  | 'bad-settings'
  | 'unknown-kind'
  | 'unknown-section'
  | 'dropped-section'
  | 'loose-line'
  | 'unknown-segment'
  | 'prelude';

/** Non-fatal diagnostics surfaced as editor gutter hints. 1-based lines. */
export interface MdWarning {
  line: number;
  code: MdWarningCode;
  message: string;
}

/** Fatal parse failure (e.g. malformed YAML front-matter). */
export class InkMdParseError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(message);
    this.name = 'InkMdParseError';
    this.line = line;
  }
}

// ---------------------------------------------------------------------------
// Parsed (id-less) document shape; reconcile.ts turns this into a ResumeDoc.

export interface ParsedContact {
  type: string;
  value: string;
  visible: boolean;
}
export interface ParsedCustomField {
  label: string;
  value: string;
}
export interface ParsedEntry extends ParsedEntryLine {
  bullets: string[];
}
interface ParsedSectionBase {
  id?: string;
  title: string;
  visible: boolean;
}
export interface ParsedStructuredSection extends ParsedSectionBase {
  kind: StructuredKind;
  entries: ParsedEntry[];
}
export interface ParsedFreeformSection extends ParsedSectionBase {
  kind: 'freeform';
  markdown: string;
}
export type ParsedSection = ParsedStructuredSection | ParsedFreeformSection;

export interface ParsedResume {
  basics: {
    name: string;
    headline?: string;
    photo?: Photo;
    contacts: ParsedContact[];
    customFields: ParsedCustomField[];
  };
  sections: ParsedSection[];
  settings: Settings;
  /**
   * Whether the front matter carried a `settings:` key at all. When absent,
   * reconciliation keeps the previous document's settings instead of
   * resetting theme choices to defaults.
   */
  settingsPresent: boolean;
  warnings: MdWarning[];
}

// ---------------------------------------------------------------------------

const SECTION_RE = /^## (.*)$/;
const ENTRY_RE = /^### ?(.*)$/;
const BULLET_RE = /^[-*] (.*)$/;

interface RegistryItem {
  id?: string;
  kind: StructuredKind | 'freeform';
  title: string;
  visible: boolean;
  consumed: boolean;
}

export function parseResumeMarkdown(md: string): ParsedResume {
  const warnings: MdWarning[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  // ---- front matter -------------------------------------------------------
  let fm: Record<string, unknown> = {};
  let bodyStart = 0;
  if (lines[0]?.trim() === '---') {
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]!.trim() === '---') {
        close = i;
        break;
      }
    }
    if (close === -1) throw new InkMdParseError('front matter is not closed with ---', 1);
    const yamlText = lines.slice(1, close).join('\n');
    let raw: unknown;
    try {
      raw = YAML.parse(yamlText);
    } catch (err) {
      const linePos = (err as { linePos?: [{ line: number }] }).linePos;
      const line = 1 + (linePos?.[0]?.line ?? 1);
      throw new InkMdParseError(`YAML front matter error: ${(err as Error).message}`, line);
    }
    if (raw !== null && raw !== undefined && typeof raw === 'object' && !Array.isArray(raw)) {
      fm = raw as Record<string, unknown>;
    } else if (raw !== null && raw !== undefined) {
      warnings.push({ line: 2, code: 'yaml-loose', message: 'front matter is not a mapping; ignored' });
    }
    bodyStart = close + 1;
  } else {
    warnings.push({ line: 1, code: 'no-frontmatter', message: 'no front matter found; using defaults' });
  }

  // ---- basics / settings / section registry ------------------------------
  const basics = readBasics(fm);
  const settings = readSettings(fm, warnings);
  const registry = readRegistry(fm, warnings);

  // ---- body segmentation ---------------------------------------------------
  interface Block {
    title: string;
    line: number;
    lines: { text: string; line: number }[];
  }
  const blocks: Block[] = [];
  const prelude: { text: string; line: number }[] = [];
  let current: Block | null = null;

  for (let i = bodyStart; i < lines.length; i++) {
    const text = lines[i]!;
    const lineNo = i + 1;
    const m = text === '##' ? ['##', ''] : SECTION_RE.exec(text);
    if (m) {
      current = { title: (m[1] ?? '').trim(), line: lineNo, lines: [] };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push({ text, line: lineNo });
    else prelude.push({ text, line: lineNo });
  }

  // ---- prelude: tolerate `# Name` and stray intro text ---------------------
  const preludeBody: { text: string; line: number }[] = [];
  for (const l of prelude) {
    const t = l.text.trim();
    if (t === '') continue;
    const h1 = /^# (.*)$/.exec(l.text);
    if (h1) {
      if (basics.name === '') basics.name = h1[1]!.trim();
      else
        warnings.push({ line: l.line, code: 'prelude', message: 'extra top-level heading ignored (name already set)' });
      continue;
    }
    preludeBody.push(l);
  }

  const sections: ParsedSection[] = [];
  if (preludeBody.length > 0) {
    warnings.push({
      line: preludeBody[0]!.line,
      code: 'prelude',
      message: 'text before the first "## " heading was kept as an untitled section',
    });
    sections.push({
      title: '',
      visible: true,
      kind: 'freeform',
      markdown: trimBlankEdges(preludeBody.map((l) => unescapeFreeformLine(l.text))).join('\n'),
    });
  }

  // ---- per-block parsing ----------------------------------------------------
  for (const block of blocks) {
    const reg = registry.find((r) => !r.consumed && r.title === block.title);
    let kind: StructuredKind | 'freeform';
    let id: string | undefined;
    let visible = true;
    if (reg) {
      reg.consumed = true;
      kind = reg.kind;
      id = reg.id;
      visible = reg.visible;
    } else {
      const looksStructured = block.lines.some(
        (l) => ENTRY_RE.test(l.text) || BULLET_RE.test(l.text),
      );
      kind = looksStructured ? 'custom' : 'freeform';
      if (registry.length > 0) {
        warnings.push({
          line: block.line,
          code: 'unknown-section',
          message: `section "${block.title}" is not in the front-matter registry; created as ${kind}`,
        });
      }
    }

    if (kind === 'freeform') {
      const body = trimBlankEdges(block.lines.map((l) => unescapeFreeformLine(l.text)));
      sections.push({
        ...(id !== undefined ? { id } : {}),
        title: block.title,
        visible,
        kind: 'freeform',
        markdown: body.join('\n'),
      });
      continue;
    }

    const entries: ParsedEntry[] = [];
    let entry: ParsedEntry | null = null;
    const openEntry = (parsed: ParsedEntryLine): ParsedEntry => {
      const e: ParsedEntry = { ...parsed, bullets: [] };
      entries.push(e);
      return e;
    };
    for (const l of block.lines) {
      const text = l.text;
      if (text.trim() === '') continue;
      const em = ENTRY_RE.exec(text);
      if (em) {
        const parsed = parseEntryLine(em[1] ?? '');
        if (parsed.unknownSegments > 0) {
          warnings.push({
            line: l.line,
            code: 'unknown-segment',
            message: 'some "|"-separated parts were not recognized; kept as extra data',
          });
        }
        entry = openEntry(parsed);
        continue;
      }
      const bm = BULLET_RE.exec(text);
      if (bm) {
        if (!entry) entry = openEntry(parseEntryLine(''));
        entry.bullets.push(bm[1]!.trim());
        continue;
      }
      // Forgiving mode: plain paragraph lines become bullets.
      if (!entry) entry = openEntry(parseEntryLine(''));
      entry.bullets.push(text.trim());
      warnings.push({
        line: l.line,
        code: 'loose-line',
        message: 'plain text line was treated as a bullet',
      });
    }
    sections.push({
      ...(id !== undefined ? { id } : {}),
      title: block.title,
      visible,
      kind,
      entries,
    });
  }

  for (const reg of registry) {
    if (!reg.consumed) {
      warnings.push({
        line: 1,
        code: 'dropped-section',
        message: `registered section "${reg.title}" has no "## ${reg.title}" heading in the body and was dropped`,
      });
    }
  }

  const out: ParsedResume = {
    basics,
    sections,
    settings,
    settingsPresent: fm['settings'] !== undefined,
    warnings,
  };
  return out;
}

// ---------------------------------------------------------------------------
// Tolerant front-matter readers

function asStr(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function readBasics(fm: Record<string, unknown>): ParsedResume['basics'] {
  const basics: ParsedResume['basics'] = {
    name: asStr(fm['name']) ?? '',
    contacts: [],
    customFields: [],
  };
  const headline = asStr(fm['headline']);
  if (headline !== undefined) basics.headline = headline;

  const photo = fm['photo'];
  if (typeof photo === 'string' && photo !== '') {
    basics.photo = { src: photo, visible: true };
  } else if (photo !== null && typeof photo === 'object' && !Array.isArray(photo)) {
    const src = asStr((photo as Record<string, unknown>)['src']);
    if (src !== undefined && src !== '') {
      basics.photo = { src, visible: (photo as Record<string, unknown>)['visible'] !== false };
    }
  }

  const contacts = fm['contacts'];
  if (Array.isArray(contacts)) {
    for (const c of contacts) {
      if (c === null || typeof c !== 'object') continue;
      const rec = c as Record<string, unknown>;
      const type = asStr(rec['type']) ?? '';
      const value = asStr(rec['value']) ?? '';
      if (type === '' && value === '') continue;
      basics.contacts.push({ type, value, visible: rec['visible'] !== false });
    }
  }

  const custom = fm['custom'];
  if (Array.isArray(custom)) {
    for (const item of custom) {
      if (item === null || typeof item !== 'object') continue;
      for (const [label, v] of Object.entries(item as Record<string, unknown>)) {
        basics.customFields.push({ label, value: asStr(v) ?? '' });
      }
    }
  } else if (custom !== null && typeof custom === 'object') {
    for (const [label, v] of Object.entries(custom as Record<string, unknown>)) {
      basics.customFields.push({ label, value: asStr(v) ?? '' });
    }
  }
  return basics;
}

function readSettings(fm: Record<string, unknown>, warnings: MdWarning[]): Settings {
  const raw = fm['settings'];
  const clean: Record<string, unknown> = {};
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const template = asStr(rec['template']);
    if (template !== undefined) clean['template'] = template;
    const texTemplate = asStr(rec['texTemplate']);
    if (texTemplate !== undefined) clean['texTemplate'] = texTemplate;
    if (rec['locale'] === 'zh' || rec['locale'] === 'en') clean['locale'] = rec['locale'];
    clean['page'] = pickValid(rec['page'], PageSettingsSchema.shape as never);
    clean['tokens'] = pickValid(rec['tokens'], ThemeTokensSchema.shape as never);
  } else if (raw !== undefined) {
    warnings.push({ line: 1, code: 'bad-settings', message: 'settings is not a mapping; using defaults' });
  }
  try {
    return SettingsSchema.parse(clean);
  } catch {
    warnings.push({ line: 1, code: 'bad-settings', message: 'invalid settings values; using defaults' });
    return SettingsSchema.parse({});
  }
}

/** Keep only fields of `raw` that individually satisfy the zod field schema. */
function pickValid(
  raw: unknown,
  shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const field = shape[k];
    if (field && field.safeParse(v).success) out[k] = v;
  }
  return out;
}

function readRegistry(fm: Record<string, unknown>, warnings: MdWarning[]): RegistryItem[] {
  const out: RegistryItem[] = [];
  const raw = fm['sections'];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const kindRaw = asStr(rec['kind']) ?? '';
    let kind: StructuredKind | 'freeform';
    if (kindRaw === 'freeform' || (STRUCTURED_KINDS as readonly string[]).includes(kindRaw)) {
      kind = kindRaw as StructuredKind | 'freeform';
    } else {
      kind = 'custom';
      warnings.push({
        line: 1,
        code: 'unknown-kind',
        message: `unknown section kind "${kindRaw}"; treated as custom`,
      });
    }
    const id = asStr(rec['id']);
    out.push({
      ...(id !== undefined && id !== '' ? { id } : {}),
      kind,
      title: asStr(rec['title']) ?? '',
      visible: rec['visible'] !== false,
      consumed: false,
    });
  }
  return out;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]!.trim() === '') start++;
  while (end > start && lines[end - 1]!.trim() === '') end--;
  return lines.slice(start, end);
}
