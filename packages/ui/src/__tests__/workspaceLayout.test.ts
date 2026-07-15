import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_LAYOUT,
  clampWorkspaceLayout,
  readWorkspaceLayout,
  workspaceMode,
  writeWorkspaceLayout,
} from '../workspaceLayout';

describe('workspace layout', () => {
  it('selects the responsive layout bands', () => {
    expect(workspaceMode(1280)).toBe('desktop');
    expect(workspaceMode(1024)).toBe('medium');
    expect(workspaceMode(899)).toBe('mobile');
  });

  it('clamps persisted sizes to the active viewport', () => {
    expect(clampWorkspaceLayout({ rail: 999, desktopEditor: 9999, mediumEditor: 0 }, 1280)).toEqual({
      rail: 360,
      desktopEditor: 528,
      mediumEditor: 360,
    });
  });

  it('ignores malformed storage and round-trips valid values', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    values.set('inkcv.workspaceLayout.v1', '{bad');
    expect(readWorkspaceLayout(storage)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
    const next = { rail: 260, desktopEditor: 700, mediumEditor: 480 };
    writeWorkspaceLayout(storage, next);
    expect(readWorkspaceLayout(storage)).toEqual(next);
  });
});
