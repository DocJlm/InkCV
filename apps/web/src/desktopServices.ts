import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, readTextFile, stat, writeFile } from '@tauri-apps/plugin-fs';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import { createFetchAiTransport, type AiConfig, type AiProfile, type AiTransport } from '@inkcv/ai';
import type { AiCredentialStore, AppServices, FileGateway } from '@inkcv/ui';
import { validateProviderUrl } from './aiProxyPolicy';

const PROFILE_KEY = 'inkcv.ai.profile';

interface CredentialRead {
  key: string | null;
  available: boolean;
}

function readProfile(): AiProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AiProfile>;
    if (
      typeof value.providerId === 'string' &&
      (value.kind === 'openai-compatible' || value.kind === 'anthropic') &&
      typeof value.baseUrl === 'string' &&
      typeof value.model === 'string'
    ) return value as AiProfile;
  } catch {
    // Ignore malformed settings. Secrets are never read from local storage.
  }
  return null;
}

function createDesktopCredentialStore(initialKey: string, initialPersistence: AppServices['credentialPersistence']): {
  store: AiCredentialStore;
  getPersistence: () => AppServices['credentialPersistence'];
} {
  let sessionKey = initialKey;
  let persistence = initialPersistence;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const store: AiCredentialStore = {
    get() {
      const profile = readProfile();
      return profile && sessionKey ? { ...profile, apiKey: sessionKey } : null;
    },
    getProfile: readProfile,
    async set(config) {
      if (config === null) {
        sessionKey = '';
        localStorage.removeItem(PROFILE_KEY);
        await invoke<boolean>('delete_ai_key').catch(() => false);
      } else {
        sessionKey = config.apiKey;
        const profile: AiProfile = {
          providerId: config.providerId ?? 'custom',
          kind: config.kind,
          baseUrl: config.baseUrl,
          model: config.model,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        localStorage.removeItem('inkcv.ai');
        const saved = await invoke<boolean>('write_ai_key', { key: sessionKey }).catch(() => false);
        persistence = saved ? 'system' : 'session-fallback';
      }
      emit();
    },
    isConfigured() {
      return store.get()?.model.trim() !== '';
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return { store, getPersistence: () => persistence };
}

const desktopFiles: FileGateway = {
  async save(data, filename, mime) {
    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : '';
    const path = await save(extension
      ? { defaultPath: filename, filters: [{ name: mime || extension.toUpperCase(), extensions: [extension] }] }
      : { defaultPath: filename });
    if (!path) return;
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    await writeFile(path, bytes);
  },
  async pickText(extensions) {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'InkCV', extensions }],
    });
    if (!path || Array.isArray(path)) return null;
    const text = await readTextFile(path);
    const name = path.split(/[\\/]/).pop() ?? path;
    return { name, text };
  },
  async pickImage(maxBytes) {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (!path || Array.isArray(path)) return null;
    const info = await stat(path);
    if (info.size > maxBytes) throw new Error('file_too_large');
    const bytes = await readFile(path);
    const extension = path.split('.').pop()?.toLowerCase();
    const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return {
      name: path.split(/[\\/]/).pop() ?? path,
      dataUrl: `data:${mime};base64,${btoa(binary)}`,
    };
  },
};

function desktopAiTransport(): AiTransport {
  const guardedFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    validateProviderUrl(rawUrl, { production: false });
    const timeout = AbortSignal.timeout(55_000);
    return nativeFetch(input, { ...init, redirect: 'error', signal: timeout });
  };
  return createFetchAiTransport(guardedFetch);
}

export async function createDesktopServices(): Promise<AppServices> {
  const credential = await invoke<CredentialRead>('read_ai_key').catch(() => ({ key: null, available: false }));
  const credentials = createDesktopCredentialStore(
    credential.key ?? '',
    credential.available ? 'system' : 'session-fallback',
  );
  const services: AppServices = {
    aiCredentials: credentials.store,
    aiTransport: desktopAiTransport(),
    files: desktopFiles,
    runtime: 'desktop',
    credentialPersistence: credential.available ? 'system' : 'session-fallback',
    appVersion: await getVersion().catch(() => '0.2.0'),
    async openExternal(url) {
      await openUrl(url);
    },
  };
  Object.defineProperty(services, 'credentialPersistence', { get: credentials.getPersistence });
  return services;
}
