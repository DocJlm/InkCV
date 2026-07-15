import {
  Contact,
  CustomField,
  Entry,
  ResumeDoc,
  ResumeDocSchema,
  SCHEMA_VERSION,
  Section,
  newId,
} from '../schema';
import { MdWarning, ParsedEntry, ParsedResume, ParsedSection, parseResumeMarkdown } from './parse';

export interface ApplyOptions {
  /** Injectable timestamp for deterministic tests. */
  now?: string;
}

export interface ApplyResult {
  doc: ResumeDoc;
  warnings: MdWarning[];
}

/**
 * Commit a Markdown buffer into the document model.
 *
 * The JSON document is the single source of truth; this reconciles the parsed
 * Markdown against `prev` so that stable ids survive editing:
 * - sections: matched by registry id, then (kind, title), then title order
 * - entries: matched by (primary, secondary), then by order
 * - contacts: matched by (type, value), then by type order
 *
 * Round-trip identity (property-tested): for any valid doc,
 * applyMarkdownToDoc(serializeResumeToMarkdown(doc), doc, {now: doc.meta.updatedAt}).doc
 * deep-equals doc.
 */
export function applyMarkdownToDoc(
  md: string,
  prev: ResumeDoc | null,
  opts: ApplyOptions = {},
): ApplyResult {
  const parsed = parseResumeMarkdown(md);
  const now = opts.now ?? new Date().toISOString();
  const meta = prev
    ? { ...prev.meta, updatedAt: now }
    : { id: newId(), createdAt: now, updatedAt: now };

  const basics = {
    name: parsed.basics.name,
    ...(parsed.basics.headline !== undefined ? { headline: parsed.basics.headline } : {}),
    ...(parsed.basics.photo !== undefined ? { photo: parsed.basics.photo } : {}),
    contacts: reconcileContacts(parsed, prev),
    customFields: reconcileCustomFields(parsed, prev),
  };

  const sections = reconcileSections(parsed.sections, prev);

  const doc = ResumeDocSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    meta,
    basics,
    sections,
    // A buffer without a settings key keeps the previous theme choices.
    settings: parsed.settingsPresent || !prev ? parsed.settings : prev.settings,
  });
  return { doc, warnings: parsed.warnings };
}

// ---------------------------------------------------------------------------

function reconcileContacts(parsed: ParsedResume, prev: ResumeDoc | null): Contact[] {
  const pool = prev ? [...prev.basics.contacts] : [];
  const consumed = new Set<number>();
  const ids: (string | null)[] = parsed.basics.contacts.map((c) => {
    const i = pool.findIndex(
      (p, idx) => !consumed.has(idx) && p.type === c.type && p.value === c.value,
    );
    if (i >= 0) {
      consumed.add(i);
      return pool[i]!.id;
    }
    return null;
  });
  parsed.basics.contacts.forEach((c, k) => {
    if (ids[k] !== null) return;
    const i = pool.findIndex((p, idx) => !consumed.has(idx) && p.type === c.type);
    if (i >= 0) {
      consumed.add(i);
      ids[k] = pool[i]!.id;
    }
  });
  return parsed.basics.contacts.map((c, k) => ({
    id: ids[k] ?? newId(),
    type: c.type,
    value: c.value,
    visible: c.visible,
  }));
}

function reconcileCustomFields(parsed: ParsedResume, prev: ResumeDoc | null): CustomField[] {
  const pool = prev ? [...prev.basics.customFields] : [];
  const consumed = new Set<number>();
  const ids: (string | null)[] = parsed.basics.customFields.map((f) => {
    const i = pool.findIndex(
      (p, idx) => !consumed.has(idx) && p.label === f.label && p.value === f.value,
    );
    if (i >= 0) {
      consumed.add(i);
      return pool[i]!.id;
    }
    return null;
  });
  parsed.basics.customFields.forEach((f, k) => {
    if (ids[k] !== null) return;
    const i = pool.findIndex((p, idx) => !consumed.has(idx) && p.label === f.label);
    if (i >= 0) {
      consumed.add(i);
      ids[k] = pool[i]!.id;
    }
  });
  return parsed.basics.customFields.map((f, k) => ({
    id: ids[k] ?? newId(),
    label: f.label,
    value: f.value,
  }));
}

function reconcileSections(parsedSections: ParsedSection[], prev: ResumeDoc | null): Section[] {
  const pool = prev ? [...prev.sections] : [];
  const consumed = new Set<number>();

  // Pass 1: explicit registry ids win outright.
  const resolvedIds: (string | null)[] = parsedSections.map((s) => {
    if (s.id !== undefined) {
      const i = pool.findIndex((p, idx) => !consumed.has(idx) && p.id === s.id);
      if (i >= 0) consumed.add(i);
      return s.id;
    }
    return null;
  });
  // Pass 2: (kind, title) match.
  parsedSections.forEach((s, k) => {
    if (resolvedIds[k] !== null) return;
    const i = pool.findIndex(
      (p, idx) => !consumed.has(idx) && p.kind === s.kind && p.title === s.title,
    );
    if (i >= 0) {
      consumed.add(i);
      resolvedIds[k] = pool[i]!.id;
    }
  });
  // Pass 3: title-only match.
  parsedSections.forEach((s, k) => {
    if (resolvedIds[k] !== null) return;
    const i = pool.findIndex((p, idx) => !consumed.has(idx) && p.title === s.title);
    if (i >= 0) {
      consumed.add(i);
      resolvedIds[k] = pool[i]!.id;
    }
  });

  return parsedSections.map((s, k) => {
    const id = resolvedIds[k] ?? newId();
    const prevSection = prev?.sections.find((p) => p.id === id);
    if (s.kind === 'freeform') {
      return { id, kind: 'freeform' as const, title: s.title, visible: s.visible, markdown: s.markdown };
    }
    const prevEntries = prevSection && prevSection.kind !== 'freeform' ? prevSection.entries : [];
    return {
      id,
      kind: s.kind,
      title: s.title,
      visible: s.visible,
      entries: reconcileEntries(s.entries, prevEntries),
    };
  });
}

function reconcileEntries(parsedEntries: ParsedEntry[], prevEntries: Entry[]): Entry[] {
  const pool = [...prevEntries];
  const consumed = new Set<number>();
  const ids: (string | null)[] = parsedEntries.map((e) => {
    const i = pool.findIndex(
      (p, idx) => !consumed.has(idx) && p.primary === e.primary && p.secondary === e.secondary,
    );
    if (i >= 0) {
      consumed.add(i);
      return pool[i]!.id;
    }
    return null;
  });
  // Order-based fallback: remaining parsed entries adopt remaining prev ids.
  parsedEntries.forEach((_, k) => {
    if (ids[k] !== null) return;
    const i = pool.findIndex((_, idx) => !consumed.has(idx));
    if (i >= 0) {
      consumed.add(i);
      ids[k] = pool[i]!.id;
    }
  });
  return parsedEntries.map((e, k) => ({
    id: ids[k] ?? newId(),
    ...(e.primary !== undefined ? { primary: e.primary } : {}),
    ...(e.secondary !== undefined ? { secondary: e.secondary } : {}),
    ...(e.location !== undefined ? { location: e.location } : {}),
    ...(e.start !== undefined ? { start: e.start } : {}),
    ...(e.end !== undefined ? { end: e.end } : {}),
    ...(e.url !== undefined ? { url: e.url } : {}),
    tags: e.tags,
    bullets: e.bullets,
    visible: e.visible,
    extra: e.extra,
  }));
}
