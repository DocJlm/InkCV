import * as YAML from 'yaml';
import { ResumeDoc, isFreeform } from '../schema';
import { resolveResumeLocale } from '../language';
import { escapeFreeformLine } from './escape';
import { formatEntryLine } from './entryLine';

/**
 * Deterministic ResumeDoc → Markdown serializer.
 *
 * Guarantees (property-tested):
 * - serialize(doc) is a pure function of doc (fixed key order, fixed layout).
 * - applyMarkdownToDoc(serialize(doc), doc) === doc (round-trip identity).
 *
 * meta is intentionally NOT serialized: the Markdown view is a projection of
 * content + settings; identity/timestamps live with the stored document and
 * are preserved by reconciliation.
 */
export function serializeResumeToMarkdown(doc: ResumeDoc): string {
  const lines: string[] = ['---', stringifyFrontMatter(doc), '---'];
  const locale = resolveResumeLocale(doc);

  for (const section of doc.sections) {
    lines.push('', `## ${section.title}`.trimEnd());
    if (isFreeform(section)) {
      if (section.markdown !== '') {
        lines.push('');
        for (const raw of section.markdown.split('\n')) {
          lines.push(escapeFreeformLine(raw));
        }
      }
      continue;
    }
    section.entries.forEach((entry, idx) => {
      const head = formatEntryLine(entry, locale);
      if (head !== null) {
        lines.push('', `### ${head}`.trimEnd());
      } else if (idx > 0 || entry.bullets.length === 0) {
        // Bare `###` separates bullets-only entries and keeps empty entries alive.
        lines.push('', '###');
      } else {
        lines.push('');
      }
      for (const bullet of entry.bullets) {
        lines.push(`- ${bullet.replace(/\r?\n/g, ' ')}`);
      }
    });
  }

  return `${lines.join('\n')}\n`;
}

function stringifyFrontMatter(doc: ResumeDoc): string {
  const b = doc.basics;
  const fm: Record<string, unknown> = {};

  fm.name = b.name;
  if (b.headline !== undefined) fm.headline = b.headline;
  if (b.photo !== undefined) {
    fm.photo = { src: b.photo.src, ...(b.photo.visible ? {} : { visible: false }) };
  }
  if (b.contacts.length > 0) {
    fm.contacts = b.contacts.map((c) => ({
      type: c.type,
      value: c.value,
      ...(c.visible ? {} : { visible: false }),
    }));
  }
  if (b.customFields.length > 0) {
    fm.custom = b.customFields.map((f) => ({ [f.label]: f.value }));
  }
  if (doc.sections.length > 0) {
    fm.sections = doc.sections.map((s) => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      ...(s.visible ? {} : { visible: false }),
    }));
  }
  const { template, texTemplate, locale, localeMode, page, tokens } = doc.settings;
  fm.settings = {
    template,
    texTemplate,
    locale,
    localeMode,
    page: { size: page.size, margin: page.margin },
    tokens: {
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      lineHeight: tokens.lineHeight,
      accentColor: tokens.accentColor,
      textColor: tokens.textColor,
      spacing: tokens.spacing,
    },
  };

  return YAML.stringify(fm, { lineWidth: 0, aliasDuplicateObjects: false }).trimEnd();
}
