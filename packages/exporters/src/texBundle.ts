import { strToU8, zipSync } from 'fflate';
import type { ResumeDoc } from '@inkcv/core';
import { exportTex } from './tex';

export type TexExportBundle =
  | { kind: 'tex'; data: string; extension: 'tex'; mime: 'application/x-tex' }
  | { kind: 'zip'; data: Uint8Array; extension: 'zip'; mime: 'application/zip' };

function decodeDataUrl(src: string): { name: string; bytes: Uint8Array } | null {
  const match = src.match(/^data:image\/(jpeg|jpg|png);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const binary = atob((match[2] ?? '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return { name: match[1]?.toLowerCase() === 'png' ? 'photo.png' : 'photo.jpg', bytes };
}

export function exportTexBundle(doc: ResumeDoc, baseName = 'resume'): TexExportBundle {
  const tex = exportTex(doc);
  const photo = doc.basics.photo?.visible ? decodeDataUrl(doc.basics.photo.src) : null;
  if (!photo) return { kind: 'tex', data: tex, extension: 'tex', mime: 'application/x-tex' };
  return {
    kind: 'zip',
    data: zipSync({ [`${baseName}.tex`]: strToU8(tex), [photo.name]: photo.bytes }, { level: 6 }),
    extension: 'zip',
    mime: 'application/zip',
  };
}
