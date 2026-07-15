import * as React from 'react';
import { pdf, renderToBuffer } from '@react-pdf/renderer';
import type { ResumeDoc } from '../../core/src/schema';
import { isNodeEnv, registerFonts } from './fonts';
import { getTemplate } from './templates';
import { resolveTheme } from './tokens';

/**
 * Compile a resume document into PDF bytes.
 *
 * Works in both environments:
 *   - Node (tests / desktop): uses `renderToBuffer`.
 *   - Browser (worker / main thread): uses `pdf(el).toBlob()`.
 *
 * Fonts are registered (idempotently) before rendering so CJK glyphs — including
 * genuine bold — are embedded.
 */
export async function compileResume(doc: ResumeDoc): Promise<Uint8Array> {
  await registerFonts();

  const descriptor = getTemplate(doc.settings.template);
  const { component: Template } = descriptor;
  const theme = resolveTheme(doc.settings, descriptor.profile);
  // The template renders a <Document>; cast to the DocumentProps element type
  // react-pdf's render entry points expect (custom wrapper components aren't in
  // their signature).
  const element = React.createElement(Template, { doc, theme }) as unknown as Parameters<
    typeof renderToBuffer
  >[0];

  // NOT `typeof window === 'undefined'`: that is also true inside a Web
  // Worker, where the Node-only renderToBuffer would throw.
  if (isNodeEnv()) {
    const buffer = await renderToBuffer(element);
    // Buffer is a Uint8Array subclass; return a plain Uint8Array view of it.
    return new Uint8Array(buffer);
  }

  const blob = await pdf(element).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
