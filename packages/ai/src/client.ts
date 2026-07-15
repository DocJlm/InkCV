/**
 * Minimal chat client over global `fetch`. Supports the OpenAI Chat Completions
 * wire format and the Anthropic Messages API.
 */
import { AiError } from './errors';
import type { AiConfig, AiTransport, ChatOptions } from './types';

/** Join a base URL and an absolute path without producing a double slash. */
function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + path;
}

/** Map a non-OK response to the appropriate {@link AiError}. */
async function raiseForStatus(res: Response): Promise<never> {
  if (res.status === 401 || res.status === 403) {
    throw new AiError('auth', `Authentication failed (HTTP ${res.status}).`);
  }
  // Do not echo provider response bodies. A misconfigured or malicious gateway
  // can reflect Authorization headers, which would leak the user's key into UI
  // errors or screenshots.
  throw new AiError('api', `Provider request failed (HTTP ${res.status}).`);
}

/**
 * Send a single system+user turn and return the assistant text.
 *
 * @throws AiError('auth')    on 401/403
 * @throws AiError('network') if the request never completes
 * @throws AiError('api')     on any other non-2xx status
 * @throws AiError('parse')   if the response body lacks the expected text field
 */
export async function chatComplete(
  cfg: AiConfig,
  opts: ChatOptions,
  transport?: AiTransport,
): Promise<string> {
  if (transport) return transport.complete(cfg, opts);
  return directComplete(cfg, opts, globalThis.fetch);
}

async function directComplete(cfg: AiConfig, opts: ChatOptions, fetchImpl: typeof fetch): Promise<string> {
  if (cfg.kind === 'anthropic') {
    return anthropicComplete(cfg, opts, fetchImpl);
  }
  return openaiComplete(cfg, opts, fetchImpl);
}

/** Direct fetch transport used by tests, local tools and desktop adapters. */
export const directAiTransport: AiTransport = {
  complete(config, options) {
    return directComplete(config, options, globalThis.fetch);
  },
};

export function createFetchAiTransport(fetchImpl: typeof fetch): AiTransport {
  return {
    complete(config, options) {
      return directComplete(config, options, fetchImpl);
    },
  };
}

async function openaiComplete(cfg: AiConfig, opts: ChatOptions, fetchImpl: typeof fetch): Promise<string> {
  const url = joinUrl(cfg.baseUrl, '/chat/completions');
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: 0.2,
  };
  // `response_format` is intentionally omitted (not all providers support it).
  if (opts.maxTokens !== undefined) {
    body.max_tokens = opts.maxTokens;
  }

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiError('network', `Network request failed: ${errText(err)}`);
  }

  if (!res.ok) {
    await raiseForStatus(res);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new AiError('parse', 'Malformed response: choices[0].message.content missing.');
  }
  return content;
}

async function anthropicComplete(cfg: AiConfig, opts: ChatOptions, fetchImpl: typeof fetch): Promise<string> {
  const url = joinUrl(cfg.baseUrl, '/v1/messages');
  const body = {
    model: cfg.model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AiError('network', `Network request failed: ${errText(err)}`);
  }

  if (!res.ok) {
    await raiseForStatus(res);
  }

  const data = (await res.json()) as { content?: { text?: unknown }[] };
  const text = data.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new AiError('parse', 'Malformed response: content[0].text missing.');
  }
  return text;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
