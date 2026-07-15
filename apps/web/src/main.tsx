import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openDB, type IDBPDatabase } from 'idb';
import {
  InkCvApp,
  defaultAppServices,
  useEditorStore,
  getInitialLang,
  type DocMeta,
  type DocStore,
} from '@inkcv/ui';
import { sampleResume, type ResumeDoc } from '@inkcv/core';
import '@inkcv/ui/styles.css';
import { proxyAiTransport } from './aiTransport';
import { createDesktopServices } from './desktopServices';

const DB_NAME = 'inkcv';
const STORE_NAME = 'docs';

/** IndexedDB-backed {@link DocStore}. One object store keyed by `meta.id`. */
class IdbDocStore implements DocStore {
  private dbp: Promise<IDBPDatabase>;

  constructor() {
    this.dbp = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'meta.id' });
        }
      },
    });
  }

  async list(): Promise<DocMeta[]> {
    const db = await this.dbp;
    const docs = (await db.getAll(STORE_NAME)) as ResumeDoc[];
    return docs
      .map((d) => ({
        id: d.meta.id,
        name: d.basics.name || '未命名',
        updatedAt: d.meta.updatedAt,
      }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  async load(id: string): Promise<ResumeDoc | null> {
    const db = await this.dbp;
    const doc = (await db.get(STORE_NAME, id)) as ResumeDoc | undefined;
    return doc ?? null;
  }

  async save(doc: ResumeDoc): Promise<void> {
    const db = await this.dbp;
    await db.put(STORE_NAME, doc);
  }

  async remove(id: string): Promise<void> {
    const db = await this.dbp;
    await db.delete(STORE_NAME, id);
  }
}

async function bootstrap(): Promise<void> {
  const store = new IdbDocStore();

  // First run (empty db): seed one locale-appropriate sample so the app is
  // never blank on first open. InkCvApp then lists it and opens it.
  const existing = await store.list();
  if (existing.length === 0) {
    await store.save(sampleResume(getInitialLang()));
  }

  // Autosave: persist doc edits, debounced. Fires on every doc-object change
  // (form edits, markdown commits, loads); identical references are skipped.
  let timer: ReturnType<typeof setTimeout> | null = null;
  useEditorStore.subscribe((state, prev) => {
    const doc = state.doc;
    if (!doc || doc === prev.doc) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void store.save(doc);
    }, 500);
  });

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('#root not found');
  const isDesktop = '__TAURI_INTERNALS__' in window;
  const services = isDesktop
    ? await createDesktopServices()
    : { ...defaultAppServices, aiTransport: proxyAiTransport };
  createRoot(rootEl).render(
    <StrictMode>
      <InkCvApp
        store={store}
        services={services}
      />
    </StrictMode>,
  );
}

void bootstrap();
