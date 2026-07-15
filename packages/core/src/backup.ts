import { z } from 'zod';
import { migrateDoc } from './migrate';
import type { ResumeDoc } from './schema';

export const INKCV_BACKUP_FORMAT_VERSION = 1 as const;

export interface InkCvBackupV1 {
  format: 'inkcv';
  formatVersion: typeof INKCV_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  document: ResumeDoc;
}

const BackupEnvelopeSchema = z.object({
  format: z.literal('inkcv'),
  formatVersion: z.literal(INKCV_BACKUP_FORMAT_VERSION),
  exportedAt: z.string(),
  document: z.unknown(),
});

export function createInkCvBackup(doc: ResumeDoc, now = new Date().toISOString()): InkCvBackupV1 {
  return {
    format: 'inkcv',
    formatVersion: INKCV_BACKUP_FORMAT_VERSION,
    exportedAt: now,
    document: structuredClone(doc),
  };
}

export function serializeInkCvBackup(doc: ResumeDoc, now?: string): string {
  return JSON.stringify(createInkCvBackup(doc, now), null, 2);
}

export function parseInkCvBackup(input: string | unknown): InkCvBackupV1 {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  const envelope = BackupEnvelopeSchema.parse(raw);
  return { ...envelope, document: migrateDoc(envelope.document) };
}
