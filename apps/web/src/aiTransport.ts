import { AiError, type AiTransport } from '@inkcv/ai';

export const proxyAiTransport: AiTransport = {
  async complete(config, options) {
    let response: Response;
    try {
      const { apiKey, ...safeConfig } = config;
      response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-inkcv-api-key': apiKey,
        },
        body: JSON.stringify({ config: safeConfig, options }),
      });
    } catch (error) {
      throw new AiError('network', error instanceof Error ? error.message : String(error));
    }
    const body = await response.json().catch(() => ({})) as { text?: unknown; error?: unknown };
    if (!response.ok) {
      const code = typeof body.error === 'string' ? body.error : `http_${response.status}`;
      if (response.status === 401) throw new AiError('auth', code);
      if (response.status === 502 || response.status === 504) throw new AiError('network', code);
      throw new AiError('api', code);
    }
    if (typeof body.text !== 'string') throw new AiError('parse', 'proxy_response_invalid');
    return body.text;
  },
};
