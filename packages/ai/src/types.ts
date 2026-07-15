/**
 * AI provider configuration and built-in presets.
 *
 * Two transport kinds are supported:
 * - `openai-compatible`: the OpenAI Chat Completions wire format, used by
 *   OpenAI, DeepSeek, Moonshot (Kimi) and most self-hosted gateways.
 * - `anthropic`: the Anthropic Messages API.
 */
export interface AiConfig {
  /** Stable preset id. Custom providers use `custom`. */
  providerId?: string;
  kind: 'openai-compatible' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Non-secret provider settings that may safely be persisted. */
export interface AiProfile {
  providerId: string;
  kind: AiConfig['kind'];
  baseUrl: string;
  model: string;
}

export interface ChatOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

/** Runtime-specific transport: browser proxy or native/direct HTTP. */
export interface AiTransport {
  complete(config: AiConfig, options: ChatOptions): Promise<string>;
}

export interface ProviderPreset {
  id: string;
  label: string;
  kind: AiConfig['kind'];
  baseUrl: string;
  defaultModel: string;
  /** Human hint about where to obtain / what an API key looks like. */
  keyHint: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyHint: 'sk-...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-flash',
    keyHint: 'sk-...',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-5',
    keyHint: 'sk-ant-...',
  },
  {
    id: 'moonshot',
    label: 'Moonshot (Kimi)',
    kind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2',
    keyHint: 'sk-...',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    kind: 'openai-compatible',
    baseUrl: '',
    defaultModel: '',
    keyHint: 'Provider-specific API key',
  },
];
