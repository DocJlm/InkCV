/**
 * @inkcv/renderer — PDF rendering for InkCV resumes.
 *
 * NOTE: `worker.ts` is intentionally NOT re-exported here; it is a Web Worker
 * entry point and must be referenced via
 * `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
 * `PdfPreviewController` does this for you.
 *
 * `pdfjsView` and `previewClient` are browser-safe to import from Node: neither
 * has a top-level pdfjs/Worker side effect (both defer to inside their functions).
 */

export {
  registerFonts,
  fontFamilyFor,
  SANS_FAMILY,
  SERIF_FAMILY,
} from './fonts';

export {
  renderInline,
  renderFreeform,
  type PdfStyle,
  type FreeformStyles,
} from './inlineMd';

export {
  resolveTheme,
  type ResolvedTheme,
  type TemplateProfile,
} from './tokens';

export {
  templates,
  getTemplate,
  type TemplateDescriptor,
  type TemplateProps,
} from './templates';
export { OnyxTemplate } from './templates/onyx';
export { LapisTemplate } from './templates/lapis';
export { MinimalAtsTemplate } from './templates/minimalAts';
export { CompactTechTemplate } from './templates/compactTech';

export { compileResume } from './compile';

export {
  PdfPreviewController,
  type PdfPreviewOptions,
} from './previewClient';

export { renderPdfToCanvas, type RenderPdfOptions } from './pdfjsView';
