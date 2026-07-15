import { beforeEach, describe, expect, it } from 'vitest';
import { sampleResume, serializeResumeToMarkdown } from '@inkcv/core';
import { useEditorStore } from '../store';

const NOW = '2026-01-01T00:00:00.000Z';

function reset() {
  useEditorStore.setState({
    doc: null,
    docRevision: 0,
    viewMode: 'form',
    mdBuffer: '',
    mdBufferRevision: 0,
    mdDirty: false,
    mdWarnings: [],
    mdError: null,
    previewBytes: null,
  });
}

describe('dual-mode editor store', () => {
  beforeEach(reset);

  it('loads a doc and generates the markdown buffer', () => {
    const doc = sampleResume('zh', NOW);
    useEditorStore.getState().loadDoc(doc);
    const s = useEditorStore.getState();
    expect(s.doc).toEqual(doc);
    expect(s.mdBuffer).toBe(serializeResumeToMarkdown(doc));
    expect(s.mdDirty).toBe(false);
  });

  it('form edits regenerate the markdown buffer on view switch', () => {
    useEditorStore.getState().loadDoc(sampleResume('zh', NOW));
    useEditorStore.getState().updateDoc((d) => {
      d.basics.name = '新名字';
    });
    expect(useEditorStore.getState().setViewMode('markdown')).toBe(true);
    expect(useEditorStore.getState().mdBuffer).toContain('name: 新名字');
  });

  it('markdown edits commit into the doc when switching back to form', () => {
    useEditorStore.getState().loadDoc(sampleResume('zh', NOW));
    useEditorStore.getState().setViewMode('markdown');
    const buffer = useEditorStore.getState().mdBuffer.replace('name: 李墨', 'name: 王五');
    useEditorStore.getState().setMdBuffer(buffer);
    expect(useEditorStore.getState().mdDirty).toBe(true);
    expect(useEditorStore.getState().setViewMode('form')).toBe(true);
    const s = useEditorStore.getState();
    expect(s.doc?.basics.name).toBe('王五');
    expect(s.mdDirty).toBe(false);
    expect(s.viewMode).toBe('form');
  });

  it('keeps section/entry ids stable across a markdown commit', () => {
    const doc = sampleResume('zh', NOW);
    useEditorStore.getState().loadDoc(doc);
    useEditorStore.getState().setViewMode('markdown');
    useEditorStore
      .getState()
      .setMdBuffer(useEditorStore.getState().mdBuffer.replace('- GPA 3.7/4.0', '- GPA 3.8/4.0'));
    useEditorStore.getState().commitMd();
    expect(useEditorStore.getState().doc?.sections.map((s) => s.id)).toEqual(
      doc.sections.map((s) => s.id),
    );
  });

  it('a broken markdown buffer blocks the switch back to form', () => {
    useEditorStore.getState().loadDoc(sampleResume('zh', NOW));
    useEditorStore.getState().setViewMode('markdown');
    useEditorStore.getState().setMdBuffer('---\nname: [broken\n---\n');
    expect(useEditorStore.getState().setViewMode('form')).toBe(false);
    const s = useEditorStore.getState();
    expect(s.viewMode).toBe('markdown');
    expect(s.mdError).not.toBeNull();
    // discard recovers
    s.discardMd();
    expect(useEditorStore.getState().mdError).toBeNull();
    expect(useEditorStore.getState().setViewMode('form')).toBe(true);
  });

  it('typing in markdown is not lost when re-entering markdown view', () => {
    useEditorStore.getState().loadDoc(sampleResume('zh', NOW));
    useEditorStore.getState().setViewMode('markdown');
    useEditorStore.getState().setMdBuffer('# 临时草稿');
    // Switching to form fails? No — '# 临时草稿' parses fine (forgiving), commits.
    expect(useEditorStore.getState().setViewMode('form')).toBe(true);
    expect(useEditorStore.getState().doc?.basics.name).toBe('临时草稿');
  });
});
