import { describe, expect, it } from 'vitest';
import { createEmptyResume } from '../schema';
import { sampleResume } from '../samples';
import { detectResumeLocale, resolveResumeLocale } from '../language';

describe('resume locale resolution', () => {
  it('detects the language of visible resume content', () => {
    expect(detectResumeLocale(sampleResume('zh'))).toBe('zh');
    expect(detectResumeLocale(sampleResume('en'))).toBe('en');
  });

  it('uses the legacy locale for an empty document', () => {
    expect(detectResumeLocale(createEmptyResume('zh'))).toBe('zh');
    expect(detectResumeLocale(createEmptyResume('en'))).toBe('en');
  });

  it('ignores contacts and hidden sections', () => {
    const doc = createEmptyResume('en');
    doc.basics.contacts.push({ id: 'c', type: 'email', value: '中文@example.com', visible: true });
    doc.sections[0]!.title = '大量中文内容';
    doc.sections[0]!.visible = false;
    expect(detectResumeLocale(doc)).toBe('en');
  });

  it('lets an explicit formatting locale override detection', () => {
    const doc = sampleResume('en');
    doc.settings.localeMode = 'zh';
    expect(resolveResumeLocale(doc)).toBe('zh');
  });
});
