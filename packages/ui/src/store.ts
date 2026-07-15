import { create } from 'zustand';
import {
  InkMdParseError,
  MdWarning,
  ResumeDoc,
  applyMarkdownToDoc,
  cloneDoc,
  serializeResumeToMarkdown,
} from '@inkcv/core';

/**
 * Dual-mode editing state machine.
 *
 * The ResumeDoc is the single source of truth. The Markdown view edits a
 * working buffer that is committed into the doc (via reconciliation) on
 * debounce, blur, or view switch — never live per keystroke — so the two
 * views can't conflict: only one view is "hot" at a time.
 *
 * - Form edits go straight to the doc (updateDoc) and bump docRevision.
 * - Entering Markdown view regenerates the buffer iff it's stale and clean.
 * - Leaving Markdown view first commits the buffer; a parse error blocks the
 *   switch (the user can fix or discard).
 */
export type ViewMode = 'form' | 'markdown';

export interface MdErrorState {
  line: number;
  message: string;
}

export interface EditorState {
  doc: ResumeDoc | null;
  /** Increments on every doc change; used to detect stale markdown buffers. */
  docRevision: number;
  viewMode: ViewMode;
  mdBuffer: string;
  /** docRevision the buffer was last generated from / committed into. */
  mdBufferRevision: number;
  /** Buffer has uncommitted keystrokes. */
  mdDirty: boolean;
  mdWarnings: MdWarning[];
  mdError: MdErrorState | null;
  /** Last compiled PDF, reused by the export menu. */
  previewBytes: Uint8Array | null;

  loadDoc: (doc: ResumeDoc) => void;
  updateDoc: (mutate: (draft: ResumeDoc) => void) => void;
  setViewMode: (mode: ViewMode) => boolean;
  setMdBuffer: (text: string) => void;
  commitMd: () => boolean;
  discardMd: () => void;
  setPreviewBytes: (bytes: Uint8Array) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  doc: null,
  docRevision: 0,
  viewMode: 'form',
  mdBuffer: '',
  mdBufferRevision: 0,
  mdDirty: false,
  mdWarnings: [],
  mdError: null,
  previewBytes: null,

  loadDoc: (doc) => {
    const revision = get().docRevision + 1;
    set({
      doc,
      docRevision: revision,
      mdBuffer: serializeResumeToMarkdown(doc),
      mdBufferRevision: revision,
      mdDirty: false,
      mdWarnings: [],
      mdError: null,
      previewBytes: null,
    });
  },

  updateDoc: (mutate) => {
    const { doc, docRevision } = get();
    if (!doc) return;
    const draft = cloneDoc(doc);
    mutate(draft);
    draft.meta.updatedAt = new Date().toISOString();
    set({ doc: draft, docRevision: docRevision + 1 });
  },

  setViewMode: (mode) => {
    const state = get();
    if (mode === state.viewMode) return true;
    if (mode === 'form') {
      if (state.mdDirty && !get().commitMd()) return false;
      set({ viewMode: 'form' });
      return true;
    }
    // Entering markdown: refresh the buffer if the form changed under it.
    if (!state.mdDirty && state.mdBufferRevision !== state.docRevision && state.doc) {
      set({
        mdBuffer: serializeResumeToMarkdown(state.doc),
        mdBufferRevision: state.docRevision,
        mdWarnings: [],
        mdError: null,
      });
    }
    set({ viewMode: 'markdown' });
    return true;
  },

  setMdBuffer: (text) => {
    if (text === get().mdBuffer) return;
    set({ mdBuffer: text, mdDirty: true });
  },

  commitMd: () => {
    const { doc, mdBuffer, mdDirty, docRevision } = get();
    if (!doc || !mdDirty) return true;
    try {
      const { doc: next, warnings } = applyMarkdownToDoc(mdBuffer, doc);
      const revision = docRevision + 1;
      set({
        doc: next,
        docRevision: revision,
        mdBufferRevision: revision,
        mdDirty: false,
        mdWarnings: warnings,
        mdError: null,
      });
      return true;
    } catch (err) {
      if (err instanceof InkMdParseError) {
        set({ mdError: { line: err.line, message: err.message } });
        return false;
      }
      set({ mdError: { line: 1, message: (err as Error).message } });
      return false;
    }
  },

  discardMd: () => {
    const { doc, docRevision } = get();
    if (!doc) return;
    set({
      mdBuffer: serializeResumeToMarkdown(doc),
      mdBufferRevision: docRevision,
      mdDirty: false,
      mdWarnings: [],
      mdError: null,
    });
  },

  setPreviewBytes: (bytes) => set({ previewBytes: bytes }),
}));
