import type { ResumeDoc } from '@inkcv/core';
import type { AiConfig, AiProfile, AiTransport } from '@inkcv/ai';

/** Lightweight descriptor for the résumé list in the left rail. */
export interface DocMeta {
  id: string;
  name: string;
  updatedAt: string;
}

/**
 * Persistence port. The host app (web: IndexedDB, desktop: filesystem)
 * implements this; @inkcv/ui stays storage-agnostic.
 */
export interface DocStore {
  list(): Promise<DocMeta[]>;
  load(id: string): Promise<ResumeDoc | null>;
  save(doc: ResumeDoc): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface AiCredentialStore {
  get(): AiConfig | null;
  getProfile(): AiProfile | null;
  set(config: AiConfig | null): void | Promise<void>;
  isConfigured(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface FileGateway {
  save(data: string | Uint8Array, filename: string, mime: string): Promise<void>;
  pickText(extensions: string[]): Promise<{ name: string; text: string } | null>;
  pickImage(maxBytes: number): Promise<{ name: string; dataUrl: string } | null>;
}

export interface AppServices {
  aiCredentials: AiCredentialStore;
  aiTransport: AiTransport;
  files: FileGateway;
  runtime: 'web' | 'desktop';
  credentialPersistence: 'memory' | 'system' | 'session-fallback';
  appVersion: string;
  openExternal(url: string): Promise<void>;
}
