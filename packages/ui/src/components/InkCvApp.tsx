import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sampleResume,
  createEmptyResume,
  cloneDoc,
  newId,
  parseInkCvBackup,
  type ResumeDoc,
} from '@inkcv/core';
import { useEditorStore } from '../store';
import { getInitialLang, type Lang } from '../i18n';
import type { AppServices, DocMeta, DocStore } from '../types';
import { AppServicesProvider, defaultAppServices } from '../services';
import { useAppServices } from '../services';
import { LeftRail } from './LeftRail';
import { FormEditor } from './FormEditor';
import { MarkdownEditor } from './MarkdownEditor';
import { PreviewPane } from './PreviewPane';
import { Modal } from '../primitives';
import { AiSettingsModal, AiImportModal } from './AiModals';

export function InkCvApp(props: { store: DocStore; services?: AppServices }): ReactElement {
  return (
    <AppServicesProvider services={props.services ?? defaultAppServices}>
      <InkCvAppInner store={props.store} />
    </AppServicesProvider>
  );
}

function InkCvAppInner({ store }: { store: DocStore }): ReactElement {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocMeta | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const [backupCandidate, setBackupCandidate] = useState<ResumeDoc | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { files, appVersion, openExternal } = useAppServices();

  const loadDoc = useEditorStore((s) => s.loadDoc);
  const currentDoc = useEditorStore((s) => s.doc);
  const lang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as Lang;

  const refreshList = useCallback(async () => {
    const list = await store.list();
    setDocs(list);
    return list;
  }, [store]);

  const openDoc = useCallback(
    async (id: string) => {
      const doc = await store.load(id);
      if (doc) {
        loadDoc(doc);
        setCurrentId(id);
        setRailOpen(false);
      }
    },
    [store, loadDoc],
  );

  const createAndOpen = useCallback(
    async (doc: ResumeDoc) => {
      await store.save(doc);
      loadDoc(doc);
      setCurrentId(doc.meta.id);
      await refreshList();
      setRailOpen(false);
    },
    [store, loadDoc, refreshList],
  );

  // First load: open the most recent doc, or seed a sample if the store is empty.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await refreshList();
      if (cancelled) return;
      if (list.length > 0 && list[0]) {
        await openDoc(list[0].id);
      } else {
        await createAndOpen(sampleResume(getInitialLang()));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNew = useCallback(
    (kind: 'zh' | 'en' | 'blank') => {
      const doc =
        kind === 'blank' ? createEmptyResume(lang) : sampleResume(kind);
      void createAndOpen(doc);
    },
    [createAndOpen, lang],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const doc = await store.load(id);
      if (!doc) return;
      const copy = cloneDoc(doc);
      const ts = new Date().toISOString();
      copy.meta = { id: newId(), createdAt: ts, updatedAt: ts };
      copy.basics.name = doc.basics.name ? `${doc.basics.name} (copy)` : doc.basics.name;
      await createAndOpen(copy);
    },
    [store, createAndOpen],
  );

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    await store.remove(target.id);
    const list = await refreshList();
    if (target.id === currentId) {
      if (list.length > 0 && list[0]) await openDoc(list[0].id);
      else await createAndOpen(sampleResume(getInitialLang()));
    }
  }, [deleteTarget, store, refreshList, currentId, openDoc, createAndOpen]);

  const handleReplace = useCallback(
    (doc: ResumeDoc) => {
      // Keep the current doc's identity so the AI import overwrites in place.
      const target = currentDoc ? { ...doc, meta: currentDoc.meta } : doc;
      loadDoc(target);
      setCurrentId(target.meta.id);
      void store.save(target).then(() => void refreshList());
    },
    [currentDoc, loadDoc, store, refreshList],
  );

  const handleBackupImport = useCallback(async () => {
    setRailOpen(false);
    setBackupError(null);
    const picked = await files.pickText(['inkcv']);
    if (!picked) return;
    try {
      const imported = parseInkCvBackup(picked.text).document;
      if (docs.some((meta) => meta.id === imported.meta.id)) setBackupCandidate(imported);
      else await createAndOpen(imported);
    } catch {
      setBackupError(t('backup.invalid'));
    }
  }, [files, docs, createAndOpen, t]);

  const importBackupAsCopy = useCallback(async () => {
    if (!backupCandidate) return;
    const copy = cloneDoc(backupCandidate);
    const ts = new Date().toISOString();
    copy.meta = { id: newId(), createdAt: ts, updatedAt: ts };
    copy.basics.name = copy.basics.name ? `${copy.basics.name} (${t('backup.copySuffix')})` : copy.basics.name;
    setBackupCandidate(null);
    await createAndOpen(copy);
  }, [backupCandidate, createAndOpen, t]);

  const replaceFromBackup = useCallback(async () => {
    if (!backupCandidate) return;
    const imported = backupCandidate;
    setBackupCandidate(null);
    await store.save(imported);
    loadDoc(imported);
    setCurrentId(imported.meta.id);
    await refreshList();
  }, [backupCandidate, store, loadDoc, refreshList]);

  return (
    <>
      <div className="ink-desktop-required" role="status">
        <div className="ink-desktop-required-mark">墨</div>
        <h1>{t('responsive.desktopTitle')}</h1>
        <p>{t('responsive.desktopBody')}</p>
      </div>

      <div className={`ink-app ink-mobile-${mobilePane}${railOpen ? ' ink-rail-open' : ''}`}>
      <button
        className="ink-rail-backdrop"
        aria-label={t('common.close')}
        onClick={() => setRailOpen(false)}
      />
      <LeftRail
        docs={docs}
        currentId={currentId}
        currentName={currentDoc?.basics.name ?? ''}
        lang={lang}
        onOpen={(id) => void openDoc(id)}
        onNew={handleNew}
        onDuplicate={(id) => void handleDuplicate(id)}
        onDelete={(meta) => setDeleteTarget(meta)}
        onOpenAiSettings={() => {
          setRailOpen(false);
          setAiSettingsOpen(true);
        }}
        onOpenImport={() => {
          setRailOpen(false);
          setImportOpen(true);
        }}
        onImportBackup={() => void handleBackupImport()}
        onOpenAbout={() => {
          setRailOpen(false);
          setAboutOpen(true);
        }}
      />

      <MiddlePane onOpenRail={() => setRailOpen(true)} />

      <PreviewPane />

      <nav className="ink-mobile-nav" aria-label={t('app.name')}>
        <button data-testid="mobile-edit" className={mobilePane === 'edit' ? 'active' : ''} aria-current={mobilePane === 'edit' ? 'page' : undefined} onClick={() => setMobilePane('edit')}>
          {t('mobile.edit')}
        </button>
        <button data-testid="mobile-preview" className={mobilePane === 'preview' ? 'active' : ''} aria-current={mobilePane === 'preview' ? 'page' : undefined} onClick={() => setMobilePane('preview')}>
          {t('mobile.preview')}
        </button>
      </nav>

      {deleteTarget && (
        <Modal
          title={t('confirm.deleteTitle')}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <div className="ink-spacer" />
              <button className="ink-btn ink-btn-ghost" onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="ink-btn ink-btn-primary danger" onClick={() => void confirmDelete()}>
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>{t('confirm.deleteBody', { name: deleteTarget.name || t('doc.untitled') })}</p>
        </Modal>
      )}

      {aiSettingsOpen && <AiSettingsModal onClose={() => setAiSettingsOpen(false)} />}
      {importOpen && <AiImportModal onClose={() => setImportOpen(false)} onReplace={handleReplace} />}
      {backupCandidate && (
        <Modal
          title={t('backup.conflictTitle')}
          onClose={() => setBackupCandidate(null)}
          footer={
            <>
              <button className="ink-btn ink-btn-ghost" onClick={() => setBackupCandidate(null)}>{t('common.cancel')}</button>
              <div className="ink-spacer" />
              <button className="ink-btn" onClick={() => void importBackupAsCopy()}>{t('backup.importCopy')}</button>
              <button className="ink-btn ink-btn-primary" onClick={() => void replaceFromBackup()}>{t('backup.replace')}</button>
            </>
          }
        >
          <p>{t('backup.conflictBody', { name: backupCandidate.basics.name || t('doc.untitled') })}</p>
        </Modal>
      )}
      {backupError && (
        <Modal title={t('backup.errorTitle')} onClose={() => setBackupError(null)}>
          <div className="ink-inline-error">{backupError}</div>
        </Modal>
      )}
      {aboutOpen && (
        <Modal title={t('about.title')} onClose={() => setAboutOpen(false)}>
          <p>{t('about.version', { version: appVersion })}</p>
          <p className="ink-modal-intro">{t('about.body')}</p>
          <div className="ink-row">
            <button className="ink-btn" onClick={() => void openExternal('https://github.com/DocJlm/InkCV')}>
              {t('nav.github')}
            </button>
            <button className="ink-btn" onClick={() => void openExternal('https://github.com/DocJlm/InkCV/releases')}>
              {t('about.releases')}
            </button>
          </div>
        </Modal>
      )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Middle pane: mode toggle + contextual editor

function MiddlePane({ onOpenRail }: { onOpenRail: () => void }): ReactNode {
  const { t } = useTranslation();
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const hasDoc = useEditorStore((s) => s.doc !== null);

  return (
    <div className="ink-middle">
      <div className="ink-mode-toolbar">
        <button data-testid="open-resumes" className="ink-btn ink-btn-sm ink-rail-toggle" onClick={onOpenRail}>
          {t('nav.openResumes')}
        </button>
        <div className="ink-mode-toggle" role="tablist">
          <button
            role="tab"
            data-testid="mode-form"
            aria-selected={viewMode === 'form'}
            className={viewMode === 'form' ? 'active' : ''}
            onClick={() => setViewMode('form')}
          >
            {t('toolbar.form')}
          </button>
          <button
            role="tab"
            data-testid="mode-markdown"
            aria-selected={viewMode === 'markdown'}
            className={viewMode === 'markdown' ? 'active' : ''}
            onClick={() => setViewMode('markdown')}
          >
            {t('toolbar.markdown')}
          </button>
        </div>
      </div>
      <div className="ink-middle-body">
        {hasDoc && (viewMode === 'form' ? <FormEditor /> : <MarkdownEditor />)}
      </div>
    </div>
  );
}
