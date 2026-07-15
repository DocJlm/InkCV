import { describe, expect, it } from 'vitest';
import { parseInkCvBackup, sampleResume, serializeInkCvBackup } from '..';

describe('InkCV backup', () => {
  it('round-trips a complete document including an inline photo', () => {
    const doc = sampleResume('zh', '2026-07-15T00:00:00.000Z');
    doc.basics.photo = { src: 'data:image/jpeg;base64,AA==', visible: true };
    const json = serializeInkCvBackup(doc, '2026-07-15T01:00:00.000Z');
    const backup = parseInkCvBackup(json);
    expect(backup.formatVersion).toBe(1);
    expect(backup.document).toEqual(doc);
  });

  it('rejects unknown backup versions without partial recovery', () => {
    expect(() => parseInkCvBackup({
      format: 'inkcv',
      formatVersion: 99,
      exportedAt: '2026-07-15T00:00:00.000Z',
      document: {},
    })).toThrow();
  });
});
