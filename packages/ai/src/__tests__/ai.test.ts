import { describe, it, expect, vi, afterEach } from 'vitest';
import { chatComplete } from '../client';
import { textToResumeDraft, draftToDoc } from '../extract';
import { polishBullets } from '../polish';
import { resumeTranslationPayload, translateResume } from '../translate';
import { extractJson } from '../jsonUtil';
import { AiError } from '../errors';
import { AiConfig } from '../types';
import { ResumeDocSchema } from '../../../core/src/schema';
import { sampleResume } from '../../../core/src/samples';

// ---------------------------------------------------------------------------
// Test helpers

function mockResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

interface CapturedCall {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(body: unknown, init?: { ok?: boolean; status?: number }): CapturedCall[] {
  const calls: CapturedCall[] = [];
  const fn = vi.fn(async (url: string, reqInit?: RequestInit): Promise<Response> => {
    calls.push({ url, init: reqInit });
    return mockResponse(body, init);
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const OPENAI_CFG: AiConfig = {
  kind: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
};

const ANTHROPIC_CFG: AiConfig = {
  kind: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-ant-test',
  model: 'claude-sonnet-5',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// chatComplete: request shapes

describe('chatComplete openai-compatible', () => {
  it('joins the url, sends bearer auth and model in body', async () => {
    const calls = stubFetch({ choices: [{ message: { content: 'hello' } }] });
    const out = await chatComplete(OPENAI_CFG, { system: 'sys', user: 'usr' });

    expect(out).toBe('hello');
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');

    const headers = call.init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');

    const body = JSON.parse(call.init!.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0.2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('sys');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('usr');
    expect('response_format' in body).toBe(false);
  });

  it('handles a baseUrl with a trailing slash (no double slash)', async () => {
    const calls = stubFetch({ choices: [{ message: { content: 'ok' } }] });
    await chatComplete(
      { ...OPENAI_CFG, baseUrl: 'https://api.deepseek.com/v1/' },
      { system: 's', user: 'u' },
    );
    expect(calls[0]!.url).toBe('https://api.deepseek.com/v1/chat/completions');
  });
});

describe('chatComplete anthropic', () => {
  it('uses x-api-key, anthropic-version and includes max_tokens', async () => {
    const calls = stubFetch({ content: [{ text: 'claude-said' }] });
    const out = await chatComplete(ANTHROPIC_CFG, {
      system: 'sys',
      user: 'usr',
      maxTokens: 1234,
    });

    expect(out).toBe('claude-said');
    const call = calls[0]!;
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');

    const headers = call.init!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(call.init!.body as string);
    expect(body.max_tokens).toBe(1234);
    expect(body.system).toBe('sys');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'usr' });
  });

  it('defaults max_tokens to 4096 when unspecified', async () => {
    const calls = stubFetch({ content: [{ text: 'x' }] });
    await chatComplete(ANTHROPIC_CFG, { system: 's', user: 'u' });
    const body = JSON.parse(calls[0]!.init!.body as string);
    expect(body.max_tokens).toBe(4096);
  });
});

describe('chatComplete error mapping', () => {
  it('maps 401 to AiError(auth)', async () => {
    stubFetch({ error: 'nope' }, { ok: false, status: 401 });
    const err = await chatComplete(OPENAI_CFG, { system: 's', user: 'u' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe('auth');
  });

  it('maps other non-2xx to AiError(api)', async () => {
    stubFetch({ error: 'boom' }, { ok: false, status: 500 });
    const err = await chatComplete(OPENAI_CFG, { system: 's', user: 'u' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe('api');
  });

  it('maps a fetch rejection to AiError(network)', async () => {
    const fn = vi.fn(async (): Promise<Response> => {
      throw new TypeError('connection refused');
    });
    vi.stubGlobal('fetch', fn);
    const err = await chatComplete(OPENAI_CFG, { system: 's', user: 'u' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe('network');
  });
});

// ---------------------------------------------------------------------------
// extractJson

describe('extractJson', () => {
  it('parses fenced json with surrounding prose', () => {
    const s = 'blah\n```json\n{"a":1}\n```\ntrailing';
    expect(extractJson(s)).toEqual({ a: 1 });
  });
  it('parses a bare object embedded in prose', () => {
    expect(extractJson('result: {"a":2} end')).toEqual({ a: 2 });
  });
  it('parses a bare array', () => {
    expect(extractJson('["x","y"]')).toEqual(['x', 'y']);
  });
  it('throws AiError(parse) on garbage', () => {
    const err = ((): unknown => {
      try {
        return extractJson('no json here');
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe('parse');
  });
});

// ---------------------------------------------------------------------------
// extract + draftToDoc

describe('textToResumeDraft + draftToDoc', () => {
  it('parses fenced json amid prose and inflates a schema-valid doc with ids', async () => {
    const draftJson = {
      basics: {
        name: 'Jane Doe',
        headline: 'Engineer',
        contacts: [{ type: 'email', value: 'jane@example.com' }],
        customFields: [{ label: '求职意向', value: 'Staff Engineer' }],
      },
      sections: [
        {
          kind: 'experience',
          title: 'Experience',
          entries: [
            {
              primary: 'Acme',
              secondary: 'Engineer',
              start: '2020-01',
              end: 'present',
              bullets: ['did things'],
            },
          ],
        },
        { kind: 'freeform', title: 'Summary', markdown: 'Hello **world**' },
      ],
    };
    const modelText =
      'Sure, here is the JSON:\n\n```json\n' + JSON.stringify(draftJson) + '\n```\n\nDone.';
    stubFetch({ choices: [{ message: { content: modelText } }] });

    const draft = await textToResumeDraft(OPENAI_CFG, 'raw resume text here');
    expect(draft.basics.name).toBe('Jane Doe');
    expect(draft.sections).toHaveLength(2);

    const doc = draftToDoc(draft);
    // Schema-valid.
    expect(() => ResumeDocSchema.parse(doc)).not.toThrow();
    // Ids everywhere.
    expect(doc.meta.id).toBeTruthy();
    expect(doc.basics.contacts[0]!.id).toBeTruthy();
    expect(doc.basics.customFields[0]!.id).toBeTruthy();
    for (const section of doc.sections) {
      expect(section.id).toBeTruthy();
      if (section.kind !== 'freeform') {
        for (const entry of section.entries) {
          expect(entry.id).toBeTruthy();
        }
      }
    }
    // Content + ongoing marker preserved.
    const exp = doc.sections.find((s) => s.kind === 'experience');
    expect(exp && exp.kind === 'experience' ? exp.entries[0]?.end : undefined).toBe('present');
  });

  it('preserves settings and meta from a base doc', () => {
    const base = ResumeDocSchema.parse({
      schemaVersion: 1,
      meta: { id: 'keep-me', createdAt: 'c', updatedAt: 'u' },
      basics: { name: 'old', contacts: [], customFields: [] },
      sections: [],
      settings: { locale: 'en', texTemplate: 'simple-cv' },
    });
    const doc = draftToDoc({ basics: { name: 'new' }, sections: [] }, base);
    expect(doc.meta.id).toBe('keep-me');
    expect(doc.settings.texTemplate).toBe('simple-cv');
    expect(doc.settings.locale).toBe('en');
    expect(doc.basics.name).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// polish

describe('polishBullets', () => {
  it('returns rewritten bullets of equal count', async () => {
    stubFetch({ choices: [{ message: { content: JSON.stringify(['A', 'B']) } }] });
    const out = await polishBullets(OPENAI_CFG, { bullets: ['a', 'b'], locale: 'en' });
    expect(out).toEqual(['A', 'B']);
  });

  it('throws AiError(parse) on a count mismatch', async () => {
    stubFetch({ choices: [{ message: { content: JSON.stringify(['only one']) } }] });
    const err = await polishBullets(OPENAI_CFG, {
      bullets: ['a', 'b'],
      locale: 'en',
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe('parse');
  });

  it('surfaces a 401 as AiError(auth)', async () => {
    stubFetch({ error: 'bad key' }, { ok: false, status: 401 });
    const err = await polishBullets(
      { ...OPENAI_CFG, apiKey: 'bad' },
      { bullets: ['a'], locale: 'en' },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe('auth');
  });

  it('short-circuits an empty bullet list without calling the network', async () => {
    const calls = stubFetch({ choices: [{ message: { content: '[]' } }] });
    const out = await polishBullets(OPENAI_CFG, { bullets: [], locale: 'en' });
    expect(out).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// full-resume translation

describe('translateResume', () => {
  function translatedResponse(doc = sampleResume('en')): Record<string, unknown> {
    const payload = resumeTranslationPayload(doc, 'zh') as {
      basics: { name: string; headline?: string; customFields: unknown[] };
      sections: Array<Record<string, unknown>>;
    };
    return {
      basics: {
        ...payload.basics,
        name: '李墨',
        headline: '前端工程师',
      },
      sections: payload.sections.map((section) => ({
        ...section,
        title: `译文-${String(section['title'])}`,
        entries: Array.isArray(section['entries'])
          ? (section['entries'] as Array<Record<string, unknown>>).map((entry) => ({
              ...entry,
              bullets: (entry['bullets'] as string[]).map((bullet) => `译文-${bullet}`),
            }))
          : undefined,
        markdown: typeof section['markdown'] === 'string' ? `译文-${section['markdown']}` : undefined,
      })),
    };
  }

  it('creates a translated copy without sending contacts, dates or photos', async () => {
    const source = sampleResume('en');
    source.settings.template = 'classic';
    source.basics.photo = { src: 'data:image/jpeg;base64,secret-photo', visible: true };
    const calls = stubFetch({ choices: [{ message: { content: JSON.stringify(translatedResponse(source)) } }] });

    const translated = await translateResume(OPENAI_CFG, source, 'zh');
    expect(translated.meta.id).not.toBe(source.meta.id);
    expect(translated.settings.locale).toBe('zh');
    expect(translated.settings.template).toBe('classic');
    expect(translated.basics.name).toBe('李墨');
    expect(translated.basics.contacts).toEqual(source.basics.contacts);
    expect(translated.basics.photo).toEqual(source.basics.photo);
    expect(source.basics.name).toBe('Mo Li');

    const request = JSON.stringify(JSON.parse(calls[0]!.init!.body as string).messages[1].content);
    expect(request).not.toContain('limo@example.com');
    expect(request).not.toContain('2022-07');
    expect(request).not.toContain('secret-photo');
  });

  it('rejects duplicate or missing stable ids', async () => {
    const source = sampleResume('en');
    const response = translatedResponse(source) as {
      sections: Array<{ id: string }>;
    };
    response.sections[1]!.id = response.sections[0]!.id;
    stubFetch({ choices: [{ message: { content: JSON.stringify(response) } }] });

    const error = await translateResume(OPENAI_CFG, source, 'zh').catch((value) => value);
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).kind).toBe('parse');
  });
});
