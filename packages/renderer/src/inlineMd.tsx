import * as React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';

/**
 * Minimal inline-Markdown -> react-pdf renderer.
 *
 * Supported inline spans (nestable): **bold**, *italic*, `code`, [text](url).
 * Block handling lives only in `renderFreeform`, which splits paragraphs and
 * `- ` / `* ` bullet lists and delegates each line to `renderInline`.
 *
 * This is deliberately NOT a full CommonMark parser — the JSON document is the
 * source of truth; bullets carry only light inline emphasis.
 */

/** The concrete (non-array) style object accepted by react-pdf primitives. */
export type PdfStyle = Exclude<
  NonNullable<React.ComponentProps<typeof View>['style']>,
  readonly unknown[]
>;

const inlineStyles = {
  bold: { fontWeight: 700 } as PdfStyle,
  italic: { fontStyle: 'italic' } as PdfStyle,
  // ASCII code uses the always-available Courier standard font; CJK code inherits
  // the surrounding CJK-capable family to avoid missing-glyph failures.
  code: { fontFamily: 'Courier' } as PdfStyle,
  codeCjk: {} as PdfStyle,
  link: { textDecoration: 'underline' } as PdfStyle,
};

const isAscii = (s: string): boolean => /^[\x00-\x7F]*$/.test(s);

// Ordered alternation: code (protect backticks) | link | bold | italic.
// NOTE: renderInline recurses, so it must NOT share a stateful /g regex across
// calls — a nested call would clobber the outer loop's lastIndex and re-match
// from the start forever. A fresh RegExp is created per invocation.
const TOKEN_SOURCE = '(`[^`]+`)|(\\[[^\\]]+\\]\\([^)]+\\))|(\\*\\*[^*]+\\*\\*)|(\\*[^*]+\\*)';

/**
 * Render a single line of inline Markdown into an array of react-pdf nodes
 * (raw strings + <Text>/<Link> spans) suitable as children of a <Text>.
 */
export function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const token = new RegExp(TOKEN_SOURCE, 'g');
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;

  while ((m = token.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const key = `${keyPrefix}-${i++}`;

    if (m[1] !== undefined) {
      const inner = m[1].slice(1, -1);
      nodes.push(
        <Text key={key} style={isAscii(inner) ? inlineStyles.code : inlineStyles.codeCjk}>
          {inner}
        </Text>,
      );
    } else if (m[2] !== undefined) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m[2]);
      const label = lm?.[1] ?? m[2];
      const url = lm?.[2] ?? '';
      nodes.push(
        <Link key={key} src={url} style={inlineStyles.link}>
          {renderInline(label, key)}
        </Link>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <Text key={key} style={inlineStyles.bold}>
          {renderInline(m[3].slice(2, -2), key)}
        </Text>,
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <Text key={key} style={inlineStyles.italic}>
          {renderInline(m[4].slice(1, -1), key)}
        </Text>,
      );
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

/** Styles consumed by {@link renderFreeform}. Supplied by the template. */
export interface FreeformStyles {
  paragraph: PdfStyle;
  bulletRow: PdfStyle;
  bulletMark: PdfStyle;
  bulletText: PdfStyle;
}

/**
 * Render a freeform Markdown block: each non-empty line becomes either a bullet
 * row (`- ` / `* ` prefix) or a paragraph, with inline emphasis via renderInline.
 */
export function renderFreeform(markdown: string, styles: FreeformStyles): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = markdown.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.trim() === '') return;
    const key = `ff-${idx}`;
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(
        <View key={key} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bulletMark}>•  </Text>
          <Text style={styles.bulletText}>{renderInline(bullet[1] ?? '', key)}</Text>
        </View>,
      );
    } else {
      out.push(
        <Text key={key} style={styles.paragraph}>
          {renderInline(line, key)}
        </Text>,
      );
    }
  });

  return out;
}
