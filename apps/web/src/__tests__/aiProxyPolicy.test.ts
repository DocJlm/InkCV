import { describe, expect, it } from 'vitest';
import { configuredHosts, isAllowedOrigin, validateProviderUrl } from '../aiProxyPolicy';

describe('AI proxy policy', () => {
  it('allows built-in providers in production', () => {
    expect(validateProviderUrl('https://api.deepseek.com/v1', { production: true }).hostname)
      .toBe('api.deepseek.com');
  });

  it('blocks private, insecure and unknown production hosts', () => {
    expect(() => validateProviderUrl('http://api.openai.com/v1', { production: true })).toThrow();
    expect(() => validateProviderUrl('https://127.0.0.1/v1', { production: false })).toThrow();
    expect(() => validateProviderUrl('https://[::1]/v1', { production: false })).toThrow();
    expect(() => validateProviderUrl('https://[fe80::1]/v1', { production: false })).toThrow();
    expect(() => validateProviderUrl('https://example.com/v1', { production: true })).toThrow();
  });

  it('supports deployment-configured hosts and exact same-origin requests', () => {
    expect(validateProviderUrl('https://ai.example.com/v1', {
      production: true,
      extraHosts: configuredHosts('ai.example.com'),
    }).hostname).toBe('ai.example.com');
    expect(isAllowedOrigin('https://inkcv.vercel.app/api/ai/chat', 'https://inkcv.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://inkcv.vercel.app/api/ai/chat', 'https://evil.example')).toBe(false);
  });
});
