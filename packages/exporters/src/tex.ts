/**
 * `.tex` export entry point.
 *
 * Selects one of the self-contained article-class templates by
 * `doc.settings.texTemplate`, falling back to 'moderncv-like'.
 */
import Mustache from 'mustache';
import { ResumeDoc } from '../../core/src/schema';
import { buildTexViewModel } from './texViewModel';
import { modercvLikeTemplate } from './texTemplates/modercvLike';
import { simpleCvTemplate } from './texTemplates/simpleCv';

export interface TexTemplateInfo {
  id: string;
  nameZh: string;
  nameEn: string;
}

/** Registry of available `.tex` templates (UI surfaces this list). */
export const texTemplates: TexTemplateInfo[] = [
  { id: 'moderncv-like', nameZh: '类 moderncv', nameEn: 'moderncv-like' },
  { id: 'simple-cv', nameZh: '简约', nameEn: 'Simple CV' },
];

const DEFAULT_TEMPLATE_ID = 'moderncv-like';

const TEMPLATE_SOURCES: Record<string, string> = {
  'moderncv-like': modercvLikeTemplate,
  'simple-cv': simpleCvTemplate,
};

/**
 * Mustache config: custom `<% %>` delimiters (so LaTeX `{{`/`}}` never collide)
 * and a no-op escape (values are already LaTeX-escaped by the view model, so
 * Mustache must not apply HTML entity escaping to them).
 */
const MUSTACHE_CONFIG = {
  tags: ['<%', '%>'] as [string, string],
  escape: (value: unknown): string => (value == null ? '' : String(value)),
};

/** Render a resume document to LaTeX source. */
export function exportTex(doc: ResumeDoc): string {
  const requested = doc.settings.texTemplate;
  const template = TEMPLATE_SOURCES[requested] ?? TEMPLATE_SOURCES[DEFAULT_TEMPLATE_ID]!;
  const vm = buildTexViewModel(doc);
  return Mustache.render(template, vm, {}, MUSTACHE_CONFIG);
}
