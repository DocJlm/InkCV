import type { AiConfig, AiProfile } from '@inkcv/ai';
import type { AiCredentialStore } from './types';

/**
 * Browser credential store. Provider/model settings are persisted, while the
 * secret key deliberately lives only in module memory and disappears on reload.
 */
const AI_PROFILE_KEY = 'inkcv.ai.profile';
let sessionKey = '';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function readProfile(): AiProfile | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(AI_PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AiProfile>;
    if (
      typeof parsed.providerId === 'string' &&
      (parsed.kind === 'openai-compatible' || parsed.kind === 'anthropic') &&
      typeof parsed.baseUrl === 'string' &&
      typeof parsed.model === 'string'
    ) return parsed as AiProfile;
  } catch {
    // Invalid or legacy data is ignored.
  }
  return null;
}

export const aiConfig: AiCredentialStore = {
  get() {
    const profile = readProfile();
    return profile && sessionKey ? { ...profile, apiKey: sessionKey } : null;
  },

  getProfile() {
    return readProfile();
  },

  set(config: AiConfig | null) {
    if (config === null) {
      sessionKey = '';
      if (typeof localStorage !== 'undefined') localStorage.removeItem(AI_PROFILE_KEY);
    } else {
      sessionKey = config.apiKey;
      const profile: AiProfile = {
        providerId: config.providerId ?? 'custom',
        kind: config.kind,
        baseUrl: config.baseUrl,
        model: config.model,
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AI_PROFILE_KEY, JSON.stringify(profile));
        // Remove the v0.1 record because it contained the secret.
        localStorage.removeItem('inkcv.ai');
      }
    }
    emit();
  },

  isConfigured() {
    const config = aiConfig.get();
    return !!config && config.apiKey.trim() !== '' && config.model.trim() !== '';
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
