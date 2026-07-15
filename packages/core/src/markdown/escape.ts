/**
 * Escaping rules for the InkCV Markdown dialect.
 *
 * Inside an entry heading line (`### ...`) the characters `|` and `@` are
 * structural delimiters and `\` is the escape character. Field values escape
 * all three; splitting only honors unescaped delimiters, so any user text
 * round-trips losslessly.
 */

const ESCAPABLE = new Set(['\\', '|', '@']);

export function escapeField(s: string): string {
  return s.replace(/([\\|@])/g, '\\$1');
}

export function unescapeField(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\' && i + 1 < s.length && ESCAPABLE.has(s[i + 1]!)) {
      out += s[i + 1];
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Split on a delimiter character, honoring backslash escapes. Escape
 * sequences are preserved in the returned segments (call unescapeField on
 * each afterwards). Segments are trimmed.
 */
export function splitUnescaped(s: string, delim: '|' | '@', limit = Infinity): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\' && i + 1 < s.length && ESCAPABLE.has(s[i + 1]!)) {
      cur += ch + s[i + 1];
      i++;
      continue;
    }
    if (ch === delim && parts.length < limit - 1) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

/**
 * Freeform section bodies are stored verbatim, but a line starting with an
 * (optionally backslash-prefixed) `## ` heading would be read back as a new
 * section boundary — so we insert one escaping backslash before the hashes
 * when serializing and strip exactly one when parsing.
 */
export function escapeFreeformLine(line: string): string {
  return line.replace(/^(\\*)(## |##$)/, '$1\\$2');
}

export function unescapeFreeformLine(line: string): string {
  return line.replace(/^(\\*)\\(## |##$)/, '$1$2');
}
