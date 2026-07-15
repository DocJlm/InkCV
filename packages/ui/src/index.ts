/**
 * @inkcv/ui — the InkCV editor UI (form + Markdown dual-mode, live PDF preview,
 * theme panel, AI features). Storage-agnostic: the host provides a {@link DocStore}.
 */
import { initI18n } from './i18n';

// Initialise i18next as a side effect of importing the UI package so any
// component (including <InkCvApp>) can call `t()` immediately. Idempotent.
initI18n();

export type { DocMeta, DocStore, AiCredentialStore, FileGateway, AppServices } from './types';
export { InkCvApp } from './components/InkCvApp';

// Re-export the dual-mode editor store and i18n controls for host apps
// (autosave subscriptions, language switching, etc.).
export { useEditorStore } from './store';
export type { EditorState, ViewMode, MdErrorState } from './store';
export { initI18n, setLang, getInitialLang, i18n, type Lang } from './i18n';
export { aiConfig } from './aiConfig';
export { defaultAppServices, useAppServices } from './services';
