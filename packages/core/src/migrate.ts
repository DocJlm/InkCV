import { ResumeDoc, ResumeDocSchema, SCHEMA_VERSION } from './schema';

/**
 * Parse a stored document of any supported schemaVersion into the current
 * ResumeDoc shape. Add a case here whenever SCHEMA_VERSION is bumped.
 */
export function migrateDoc(raw: unknown): ResumeDoc {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Not a resume document');
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  switch (version) {
    case SCHEMA_VERSION:
      return ResumeDocSchema.parse(raw);
    default:
      throw new Error(`Unsupported resume schemaVersion: ${String(version)}`);
  }
}
