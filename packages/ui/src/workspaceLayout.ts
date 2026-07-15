export const WORKSPACE_LAYOUT_KEY = 'inkcv.workspaceLayout.v1';

export interface WorkspaceLayout {
  rail: number;
  desktopEditor: number;
  mediumEditor: number;
}

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  rail: 224,
  desktopEditor: 760,
  mediumEditor: 520,
};

export type WorkspaceMode = 'desktop' | 'medium' | 'mobile';
export type WorkspaceSplitterKind = 'rail' | 'editor';

export function workspaceMode(width: number): WorkspaceMode {
  if (width >= 1280) return 'desktop';
  if (width >= 900) return 'medium';
  return 'mobile';
}

export function clampWorkspaceLayout(layout: WorkspaceLayout, width: number): WorkspaceLayout {
  const mode = workspaceMode(width);
  const rail = clamp(layout.rail, 180, 360);
  const desktopAvailable = Math.max(420, width - rail - 12 - 380);
  const mediumAvailable = Math.max(360, width - 6 - 340);
  return {
    rail,
    desktopEditor: clamp(layout.desktopEditor, 420, desktopAvailable),
    mediumEditor: clamp(layout.mediumEditor, 360, mediumAvailable),
  };
}

export function readWorkspaceLayout(storage: Pick<Storage, 'getItem'> | null): WorkspaceLayout {
  if (!storage) return DEFAULT_WORKSPACE_LAYOUT;
  try {
    const value = JSON.parse(storage.getItem(WORKSPACE_LAYOUT_KEY) ?? 'null') as Partial<WorkspaceLayout> | null;
    if (!value || !isFiniteNumber(value.rail) || !isFiniteNumber(value.desktopEditor) || !isFiniteNumber(value.mediumEditor)) {
      return DEFAULT_WORKSPACE_LAYOUT;
    }
    return { rail: value.rail, desktopEditor: value.desktopEditor, mediumEditor: value.mediumEditor };
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT;
  }
}

export function writeWorkspaceLayout(storage: Pick<Storage, 'setItem'> | null, value: WorkspaceLayout): void {
  if (!storage) return;
  try {
    storage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(value));
  } catch {
    // Layout preferences are best-effort and must never block editing.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
