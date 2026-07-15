/**
 * LaTeX escaping utilities.
 *
 * Two entry points:
 * - `escapeLatex`  — escapes raw text so it is safe to drop into a LaTeX body.
 * - `mdInlineToLatex` — parses a subset of inline Markdown into LaTeX commands,
 *   escaping every text fragment that is *not* a Markdown token.
 */

/**
 * Single-pass character map. Because `String.prototype.replace` with a global
 * regex + callback tests each match against the *original* string (never the
 * replacement text), the braces introduced by `\textbackslash{}` etc. are not
 * re-escaped. This is what lets us handle the backslash first without the
 * classic double-escape bug.
 */
const LATEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

const LATEX_SPECIALS = /[\\{}&%$#_~^]/g;

/** Escape LaTeX special characters: `\\ { } & % $ # _ ~ ^` (backslash first). */
export function escapeLatex(s: string): string {
  if (!s) return '';
  return s.replace(LATEX_SPECIALS, (c) => LATEX_ESCAPES[c] ?? c);
}

/**
 * Inline Markdown tokenizer. Alternatives, in priority order:
 *  1. `**bold**`
 *  2. `*italic*`
 *  3. `` `code` ``
 *  4. `[text](url)`
 *
 * Bold is listed before italic so `**x**` is not mis-parsed as two italics.
 */
const MD_INLINE =
  /(\*\*([^*]+?)\*\*)|(\*([^*]+?)\*)|(`([^`]+?)`)|(\[([^\]]*?)\]\(([^)]*?)\))/g;

/**
 * Convert inline Markdown to LaTeX. The Markdown tokens are parsed first, then
 * each surrounding text fragment (and each token's inner content) is escaped
 * with {@link escapeLatex} *before* being wrapped in its LaTeX command.
 *
 * - `**bold**`   -> `\textbf{...}`
 * - `*italic*`   -> `\textit{...}`
 * - `` `code` `` -> `\texttt{...}`
 * - `[t](u)`     -> `\href{u}{t}`
 */
export function mdInlineToLatex(s: string): string {
  if (!s) return '';
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  MD_INLINE.lastIndex = 0;
  while ((m = MD_INLINE.exec(s)) !== null) {
    out += escapeLatex(s.slice(last, m.index));
    if (m[1] !== undefined) {
      out += `\\textbf{${escapeLatex(m[2] ?? '')}}`;
    } else if (m[3] !== undefined) {
      out += `\\textit{${escapeLatex(m[4] ?? '')}}`;
    } else if (m[5] !== undefined) {
      out += `\\texttt{${escapeLatex(m[6] ?? '')}}`;
    } else if (m[7] !== undefined) {
      out += `\\href{${escapeLatex(m[9] ?? '')}}{${escapeLatex(m[8] ?? '')}}`;
    }
    last = MD_INLINE.lastIndex;
  }
  out += escapeLatex(s.slice(last));
  return out;
}
