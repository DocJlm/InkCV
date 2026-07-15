import { Entry, PRESENT } from '../schema';
import { escapeField, splitUnescaped, unescapeField } from './escape';

/**
 * Entry heading line grammar (the text after `### `):
 *
 *   primary | secondary @ location | start – end | url: … | tags: a, b | k: v | !hidden
 *
 * - Segments are separated by unescaped `|`.
 * - Segment 0 is always `primary` (forgiving mode also accepts `primary @ location`).
 * - Segment 1 is `secondary[ @ location]`, unless it parses as a date range
 *   or carries a reserved `key:` prefix.
 * - A date segment is `start – end` (en dash, em dash, `~`, or spaced `-`),
 *   where both sides are date-like tokens (2024, 2024-06, 2024.6, 2024年6月)
 *   or a "present" word (至今/present/now/current).
 * - `key: value` segments: reserved keys url/tags/start/end/role/loc map to
 *   fields; any other key lands in `extra` (never dropped).
 * - The literal segment `!hidden` marks the entry invisible.
 *
 * A bare `###` line starts a new entry with no heading fields (used to
 * separate consecutive bullets-only entries).
 */

const PRESENT_TOKENS = new Set(['present', 'now', 'current', '至今', '今']);
const DATE_TOKEN_RE =
  /^[0-9]{4}(?:(?:[.\-/][0-9]{1,2}){0,2}|年(?:[0-9]{1,2}月(?:[0-9]{1,2}[日号])?)?)$/;
const RESERVED_KEYS = new Set(['url', 'tags', 'start', 'end', 'role', 'loc']);
const KV_RE = /^([^:]{1,64}?)\s*:\s*(.*)$/s;
const HIDDEN_MARK = '!hidden';

function isDateToken(t: string): boolean {
  return DATE_TOKEN_RE.test(t) || PRESENT_TOKENS.has(t.toLowerCase());
}

function normalizeDateToken(t: string): string {
  return PRESENT_TOKENS.has(t.toLowerCase()) ? PRESENT : t;
}

function localizeDateToken(v: string, locale: 'zh' | 'en'): string {
  return v === PRESENT ? (locale === 'zh' ? '至今' : 'Present') : v;
}

/** Parse a segment as a date range; null when it isn't one. */
export function parseDateSegment(seg: string): { start?: string; end?: string } | null {
  let m = seg.match(/^(.*?)\s*[–—~]\s*(.*)$/s);
  if (!m) m = seg.match(/^(.*?)\s+-\s+(.*)$/s);
  if (!m) {
    const t = seg.trim();
    if (t !== '' && isDateToken(t)) return { start: normalizeDateToken(t) };
    return null;
  }
  const a = m[1]!.trim();
  const b = m[2]!.trim();
  if (a === '' && b === '') return null;
  if (a !== '' && !isDateToken(a)) return null;
  if (b !== '' && !isDateToken(b)) return null;
  const out: { start?: string; end?: string } = {};
  if (a !== '') out.start = normalizeDateToken(a);
  if (b !== '') out.end = normalizeDateToken(b);
  return out;
}

/** Would this secondary text be misread if emitted as a bare segment? */
function secondaryNeedsKv(secondary: string): boolean {
  const escaped = escapeField(secondary);
  if (parseDateSegment(escaped) !== null) return true;
  if (escaped === HIDDEN_MARK) return true;
  const kv = escaped.match(KV_RE);
  if (kv && RESERVED_KEYS.has(kv[1]!.trim().toLowerCase())) return true;
  return false;
}

export interface ParsedEntryLine {
  primary?: string;
  secondary?: string;
  location?: string;
  start?: string;
  end?: string;
  url?: string;
  tags: string[];
  visible: boolean;
  extra: Record<string, string>;
  unknownSegments: number;
}

/** Parse the text after `### `. Total: never throws. */
export function parseEntryLine(rest: string): ParsedEntryLine {
  const out: ParsedEntryLine = { tags: [], visible: true, extra: {}, unknownSegments: 0 };
  const trimmed = rest.trim();
  if (trimmed === '') return out;
  const segs = splitUnescaped(trimmed, '|');

  // Segment 0: primary, with forgiving `primary @ location` support.
  const seg0 = segs[0]!;
  if (seg0 !== '') {
    const at = splitUnescaped(seg0, '@', 2);
    if (at.length === 2 && at[1] !== '') {
      if (at[0] !== '') out.primary = unescapeField(at[0]!);
      out.location = unescapeField(at[1]!);
    } else if (seg0 !== '') {
      out.primary = unescapeField(seg0);
    }
  }

  let datesSet = false;
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i]!;
    if (seg === '') continue;
    if (seg === HIDDEN_MARK) {
      out.visible = false;
      continue;
    }
    if (!datesSet) {
      const dates = parseDateSegment(seg);
      if (dates !== null) {
        if (dates.start !== undefined) out.start = dates.start;
        if (dates.end !== undefined) out.end = dates.end;
        datesSet = true;
        continue;
      }
    }
    const kv = seg.match(KV_RE);
    const key = kv?.[1]?.trim().toLowerCase();
    if (kv && key !== undefined && RESERVED_KEYS.has(key)) {
      const value = kv[2]!.trim();
      switch (key) {
        case 'url':
          out.url = unescapeField(value);
          break;
        case 'tags':
          out.tags = value === '' ? [] : splitTags(value);
          break;
        case 'start':
          out.start = unescapeField(value);
          break;
        case 'end':
          out.end = unescapeField(value);
          break;
        case 'role':
          out.secondary = unescapeField(value);
          break;
        case 'loc':
          out.location = unescapeField(value);
          break;
      }
      continue;
    }
    if (i === 1) {
      const at = splitUnescaped(seg, '@', 2);
      if (at.length === 2) {
        if (at[0] !== '') out.secondary = unescapeField(at[0]!);
        if (at[1] !== '') out.location = unescapeField(at[1]!);
      } else if (seg !== '') {
        out.secondary = unescapeField(seg);
      }
      continue;
    }
    if (kv && key !== undefined && key !== '') {
      out.extra[unescapeField(kv[1]!.trim())] = unescapeField(kv[2]!.trim());
      continue;
    }
    out.extra[`_seg${i}`] = unescapeField(seg);
    out.unknownSegments++;
  }
  return out;
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => unescapeField(t.trim()))
    .filter((t) => t !== '');
}

/** Reserved-collision-safe key check for extra maps (exported for UI use). */
export function sanitizeExtraKey(key: string): string {
  const k = key.replace(/:/g, '').replace(/^!+/, '').trim();
  if (k === '' || RESERVED_KEYS.has(k.toLowerCase()) || /^_seg\d+$/.test(k)) return `x-${k}`;
  return k;
}

/**
 * Format an entry's heading line (text after `### `). Returns null when the
 * entry has no heading fields (bullets-only entry).
 */
export function formatEntryLine(entry: Entry, locale: 'zh' | 'en'): string | null {
  const hasHeading =
    entry.primary !== undefined ||
    entry.secondary !== undefined ||
    entry.location !== undefined ||
    entry.start !== undefined ||
    entry.end !== undefined ||
    entry.url !== undefined ||
    entry.tags.length > 0 ||
    Object.keys(entry.extra).length > 0 ||
    !entry.visible;
  if (!hasHeading) return null;

  const segs: string[] = [escapeField(entry.primary ?? '')];
  const kvs: [string, string][] = [];

  const secondaryAsKv = entry.secondary !== undefined && secondaryNeedsKv(entry.secondary);
  const bareSecondary = secondaryAsKv ? undefined : entry.secondary;
  if (bareSecondary !== undefined || entry.location !== undefined) {
    let s1 = bareSecondary !== undefined ? escapeField(bareSecondary) : '';
    if (entry.location !== undefined) s1 += `${s1 === '' ? '' : ' '}@ ${escapeField(entry.location)}`;
    segs.push(s1);
  }
  if (secondaryAsKv) kvs.push(['role', entry.secondary!]);

  if (entry.start !== undefined || entry.end !== undefined) {
    const s = entry.start !== undefined ? localizeDateToken(entry.start, locale) : '';
    const e = entry.end !== undefined ? localizeDateToken(entry.end, locale) : '';
    const dateish =
      (s === '' || isDateToken(s)) && (e === '' || isDateToken(e)) && !(s === '' && e === '');
    if (dateish) {
      if (e === '') segs.push(`${s} –`);
      else if (s === '') segs.push(`– ${e}`);
      else segs.push(`${s} – ${e}`);
    } else {
      if (entry.start !== undefined) kvs.push(['start', entry.start]);
      if (entry.end !== undefined) kvs.push(['end', entry.end]);
    }
  }

  if (entry.url !== undefined) kvs.push(['url', entry.url]);
  if (entry.tags.length > 0) kvs.push(['tags', entry.tags.map((t) => escapeField(t)).join(', ')]);
  for (const k of Object.keys(entry.extra).sort()) {
    kvs.push([escapeField(k), escapeField(entry.extra[k]!)]);
  }

  // Segment 1 is the bare secondary slot. If the first emitted key/value is
  // custom extra data, reserve that slot explicitly so the parser does not
  // reinterpret `key: value` as a secondary field.
  if (segs.length === 1 && kvs.length > 0) {
    const firstKey = unescapeField(kvs[0]![0]).trim().toLowerCase();
    if (!RESERVED_KEYS.has(firstKey)) segs.push('');
  }

  for (const [k, v] of kvs) {
    // url/tags/start/end/role keys are emitted raw; tags/extra already escaped.
    const value = k === 'url' || k === 'start' || k === 'end' || k === 'role' ? escapeField(v) : v;
    segs.push(`${k}: ${value}`);
  }
  if (!entry.visible) segs.push(HIDDEN_MARK);

  // Drop trailing empty primary-only artifacts: if only seg0 and it's empty,
  // hasHeading guaranteed something else exists, so this can't happen.
  return segs.join(' | ').trimEnd();
}
