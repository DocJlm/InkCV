import { createContext, useContext, type ReactNode } from 'react';
import { directAiTransport } from '@inkcv/ai';
import { downloadFile } from '@inkcv/exporters';
import { aiConfig } from './aiConfig';
import type { AppServices, FileGateway } from './types';

const browserFiles: FileGateway = {
  async save(data, filename, mime) {
    downloadFile(data, filename, mime);
  },

  async pickText(extensions) {
    if (typeof document === 'undefined') return null;
    return await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = extensions.map((extension) => `.${extension}`).join(',');
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) resolve(null);
        else void file.text().then((fileText) => resolve({ name: file.name, text: fileText }));
      };
      input.click();
    });
  },

  async pickImage(maxBytes) {
    if (typeof document === 'undefined') return null;
    return await new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > maxBytes) return reject(new Error('file_too_large'));
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
        reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },
};

export const defaultAppServices: AppServices = {
  aiCredentials: aiConfig,
  aiTransport: directAiTransport,
  files: browserFiles,
  runtime: 'web',
  credentialPersistence: 'memory',
  appVersion: '0.2.0',
  async openExternal(url) {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  },
};

const AppServicesContext = createContext<AppServices>(defaultAppServices);

export function AppServicesProvider(props: { services: AppServices; children: ReactNode }): ReactNode {
  return <AppServicesContext.Provider value={props.services}>{props.children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  return useContext(AppServicesContext);
}
