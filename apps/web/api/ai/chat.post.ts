import { defineHandler } from 'nitro/h3';
import { AiError, chatComplete, createFetchAiTransport, type AiConfig, type ChatOptions } from '@inkcv/ai';
import { configuredHosts, isAllowedOrigin, validateProviderUrl } from '../../src/aiProxyPolicy';

const MAX_REQUEST_BYTES = 128 * 1024;

function env(name: string): string | undefined {
  return (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.[name];
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

export default defineHandler(async (event) => {
  if (!isAllowedOrigin(event.req.url, event.req.headers.get('origin'))) {
    return json({ error: 'origin_not_allowed' }, 403);
  }
  if (!event.req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'json_required' }, 400);
  }
  const contentLength = Number(event.req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'request_too_large' }, 413);
  const apiKey = event.req.headers.get('x-inkcv-api-key')?.trim() ?? '';
  if (!apiKey) return json({ error: 'missing_api_key' }, 401);

  let body: { config?: Omit<AiConfig, 'apiKey'>; options?: ChatOptions };
  try {
    const raw = await event.req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: 'request_too_large' }, 413);
    }
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const config = body.config;
  const options = body.options;
  if (!config || !options ||
      (config.kind !== 'openai-compatible' && config.kind !== 'anthropic') ||
      typeof config.baseUrl !== 'string' || typeof config.model !== 'string' ||
      typeof options.system !== 'string' || typeof options.user !== 'string') {
    return json({ error: 'invalid_request' }, 400);
  }
  try {
    validateProviderUrl(config.baseUrl, {
      production: env('VERCEL') === '1',
      extraHosts: configuredHosts(env('INKCV_ALLOWED_AI_HOSTS')),
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const guardedFetch: typeof fetch = (input, init) => globalThis.fetch(input, {
        ...init,
        redirect: 'error',
        signal: controller.signal,
      });
      const text = await chatComplete(
        { ...config, apiKey },
        options,
        createFetchAiTransport(guardedFetch),
      );
      if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024) {
        return json({ error: 'response_too_large' }, 502);
      }
      return json({ text });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return json({ error: 'provider_timeout' }, 504);
    if (error instanceof AiError) {
      if (error.kind === 'network' && error.message.toLowerCase().includes('abort')) {
        return json({ error: 'provider_timeout' }, 504);
      }
      if (error.kind === 'auth') return json({ error: 'provider_auth' }, 401);
      if (error.kind === 'network') return json({ error: 'provider_unreachable' }, 502);
      return json({ error: 'provider_error' }, 502);
    }
    if (error instanceof Error && ['invalid_url', 'https_required', 'private_host', 'host_not_allowed'].includes(error.message)) {
      return json({ error: error.message }, 403);
    }
    return json({ error: 'proxy_error' }, 502);
  }
});
