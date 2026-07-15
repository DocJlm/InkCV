/**
 * Rewrite resume bullet points to be stronger (action verbs, quantified),
 * preserving language and count.
 */
import { AiError } from './errors';
import { chatComplete } from './client';
import { extractJson } from './jsonUtil';
import type { AiConfig, AiTransport } from './types';

export interface PolishOptions {
  bullets: string[];
  role?: string;
  locale: 'zh' | 'en';
}

const POLISH_SYSTEM_PROMPT = `You rewrite resume bullet points to be stronger. 你负责润色简历条目，使其更有力。

Rules 规则:
- Rewrite EACH bullet: start with a strong action verb, quantify impact where the input already implies numbers, remove filler. 每条都改写：以有力动词开头，在原文已隐含数字处量化影响，去除废话。
- Do NOT invent facts or numbers that are not implied by the input. 不要编造原文未隐含的事实或数字。
- Keep the SAME language as each input bullet. 保持每条原文的语言。
- Return the SAME number of bullets, in the same order. 返回条目数量与顺序不变。
- Output ONLY a JSON array of strings. 只输出字符串 JSON 数组。`;

/**
 * @throws AiError('parse') if the model returns the wrong number of bullets,
 *         a non-array, or non-string elements.
 */
export async function polishBullets(
  cfg: AiConfig,
  opts: PolishOptions,
  transport?: AiTransport,
): Promise<string[]> {
  const { bullets, role, locale } = opts;
  if (bullets.length === 0) return [];

  const user = JSON.stringify({
    locale,
    role: role ?? '',
    count: bullets.length,
    bullets,
  });

  const raw = await chatComplete(cfg, {
    system: POLISH_SYSTEM_PROMPT,
    user,
    maxTokens: 2048,
  }, transport);

  const json = extractJson(raw);
  if (!Array.isArray(json)) {
    throw new AiError('parse', 'Expected a JSON array of strings.');
  }
  if (json.length !== bullets.length) {
    throw new AiError(
      'parse',
      `Expected ${bullets.length} bullets, got ${json.length}.`,
    );
  }
  if (!json.every((x): x is string => typeof x === 'string')) {
    throw new AiError('parse', 'Expected every element to be a string.');
  }
  return json;
}
