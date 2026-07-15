import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiConfig } from '../aiConfig';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  get length(): number { return this.values.size; }
}

describe('web AI credential lifecycle', () => {
  const storage = new MemoryStorage();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', storage);
    aiConfig.set(null);
  });

  it('persists only the non-secret profile', () => {
    aiConfig.set({
      providerId: 'deepseek',
      kind: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      apiKey: 'secret-key-must-not-persist',
    });

    expect(aiConfig.get()?.apiKey).toBe('secret-key-must-not-persist');
    expect(storage.getItem('inkcv.ai.profile')).not.toContain('secret-key-must-not-persist');
    expect(storage.getItem('inkcv.ai')).toBeNull();
  });

  it('clears both the in-memory key and persisted profile', () => {
    aiConfig.set({
      providerId: 'openai',
      kind: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'temporary',
    });
    aiConfig.set(null);
    expect(aiConfig.get()).toBeNull();
    expect(aiConfig.getProfile()).toBeNull();
  });
});
