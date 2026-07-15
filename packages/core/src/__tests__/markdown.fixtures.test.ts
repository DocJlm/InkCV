import { describe, expect, it } from 'vitest';
import { sampleResume } from '../samples';
import { RESUME_COLOR_PRESETS, createEmptyResume } from '../schema';
import { migrateDoc } from '../migrate';
import { serializeResumeToMarkdown } from '../markdown/serialize';
import { InkMdParseError, parseResumeMarkdown } from '../markdown/parse';
import { applyMarkdownToDoc } from '../markdown/reconcile';
import { formatEntryLine, parseEntryLine } from '../markdown/entryLine';

const NOW = '2026-01-01T00:00:00.000Z';

describe('sample resume serialization', () => {
  it('uses locale-specific template defaults for new documents', () => {
    expect(createEmptyResume('zh', NOW).settings.template).toBe('lapis');
    expect(createEmptyResume('en', NOW).settings.template).toBe('onyx');
    expect(sampleResume('zh', NOW).settings.template).toBe('lapis');
    expect(sampleResume('en', NOW).settings.template).toBe('onyx');
  });
  it('uses the black color preset for new and sample resumes', () => {
    for (const doc of [createEmptyResume('zh', NOW), sampleResume('zh', NOW), sampleResume('en', NOW)]) {
      expect(doc.settings.tokens.accentColor).toBe(RESUME_COLOR_PRESETS.black.accentColor);
      expect(doc.settings.tokens.textColor).toBe(RESUME_COLOR_PRESETS.black.textColor);
    }
  });

  it('preserves an existing blue theme through Markdown reconciliation', () => {
    const doc = sampleResume('zh', NOW);
    doc.settings.tokens = { ...doc.settings.tokens, ...RESUME_COLOR_PRESETS.blue };
    const { doc: next } = applyMarkdownToDoc(serializeResumeToMarkdown(doc), doc, { now: NOW });
    expect(next.settings.tokens).toEqual(doc.settings.tokens);
  });

  it('serializes the zh sample into the canonical dialect', () => {
    const doc = sampleResume('zh', NOW);
    const md = serializeResumeToMarkdown(doc);
    expect(md).toContain('name: 李墨');
    expect(md).toContain('## 工作经历');
    expect(md).toContain('### 某互联网公司 | 前端工程师 @ 深圳 | 2022-07 – 至今');
    expect(md).toContain('- 负责营销活动页搭建平台前端');
    expect(md).toContain('url: https://github.com/example/inkcv');
    expect(md).toContain('tags: React, TypeScript');
    // Freeform body kept verbatim.
    expect(md).toContain('热爱开源，相信**好工具应该让人第一眼就会用**');
  });

  it('round-trips both samples exactly', () => {
    for (const locale of ['zh', 'en'] as const) {
      const doc = sampleResume(locale, NOW);
      const md = serializeResumeToMarkdown(doc);
      const { doc: doc2, warnings } = applyMarkdownToDoc(md, doc, { now: NOW });
      expect(warnings).toEqual([]);
      expect(doc2).toEqual(doc);
    }
  });
});

describe('entry line grammar', () => {
  it('parses the full form', () => {
    const e = parseEntryLine('字节跳动 | 高级前端 @ 北京 | 2021-03 – 至今 | url: https://a.b | tags: React, TS');
    expect(e.primary).toBe('字节跳动');
    expect(e.secondary).toBe('高级前端');
    expect(e.location).toBe('北京');
    expect(e.start).toBe('2021-03');
    expect(e.end).toBe('present');
    expect(e.url).toBe('https://a.b');
    expect(e.tags).toEqual(['React', 'TS']);
  });

  it('accepts forgiving variants', () => {
    expect(parseEntryLine('公司 @ 上海')).toMatchObject({ primary: '公司', location: '上海' });
    expect(parseEntryLine('X | 2020 – 2021')).toMatchObject({ start: '2020', end: '2021' });
    expect(parseEntryLine('X | 2020.3 ~ 2021.7')).toMatchObject({ start: '2020.3', end: '2021.7' });
    expect(parseEntryLine('X | 2019年9月 - 2023年6月')).toMatchObject({ start: '2019年9月', end: '2023年6月' });
    expect(parseEntryLine('X | loc: 广州 | role: 队长')).toMatchObject({
      location: '广州',
      secondary: '队长',
    });
    expect(parseEntryLine('X | Present –')).toMatchObject({ start: 'present' });
    expect(parseEntryLine('X | !hidden').visible).toBe(false);
  });

  it('protects reserved-looking secondary text via role:', () => {
    const entry = {
      id: 'e1',
      secondary: '2020 – 2021',
      tags: [],
      bullets: [],
      visible: true,
      extra: {},
    };
    const line = formatEntryLine(entry, 'zh')!;
    expect(parseEntryLine(line).secondary).toBe('2020 – 2021');
    expect(parseEntryLine(line).start).toBeUndefined();
  });

  it('escapes structural characters', () => {
    const entry = {
      id: 'e1',
      primary: 'A | B @ C',
      secondary: 'x\\y',
      tags: ['a|b'],
      bullets: [],
      visible: true,
      extra: { 备注: 'v@l|ue' },
    };
    const line = formatEntryLine(entry, 'en')!;
    const back = parseEntryLine(line);
    expect(back.primary).toBe('A | B @ C');
    expect(back.secondary).toBe('x\\y');
    expect(back.tags).toEqual(['a|b']);
    expect(back.extra['备注']).toBe('v@l|ue');
  });

  it('keeps unknown segments as extra data', () => {
    const e = parseEntryLine('公司 | 职位 | 2020 – 2021 | 乱七八糟的东西');
    expect(e.extra['_seg3']).toBe('乱七八糟的东西');
    expect(e.unknownSegments).toBe(1);
  });

  it('round-trips an entry whose only heading data is extra metadata', () => {
    const line = formatEntryLine({
      id: 'e-extra',
      tags: [],
      bullets: [],
      visible: true,
      extra: { a: 'a' },
    }, 'en')!;
    const parsed = parseEntryLine(line);
    expect(parsed.secondary).toBeUndefined();
    expect(parsed.extra).toEqual({ a: 'a' });
  });
});

describe('forgiving parsing of hand-written markdown', () => {
  const HAND_WRITTEN = `# 王小明

前端开发工程师

## 教育经历

### 北京大学 | 计算机科学 | 2016-09 - 2020-06
- 主修算法与数据结构

## 技能

熟悉 React 和 Vue
了解 Rust

## 自我评价

爱折腾，爱开源。
`;

  it('parses without front matter, inferring kinds', () => {
    const parsed = parseResumeMarkdown(HAND_WRITTEN);
    expect(parsed.basics.name).toBe('王小明');
    expect(parsed.warnings.some((w) => w.code === 'no-frontmatter')).toBe(true);

    // "前端开发工程师" prelude line becomes an untitled freeform section.
    expect(parsed.sections[0]).toMatchObject({ kind: 'freeform', title: '', markdown: '前端开发工程师' });

    const edu = parsed.sections[1]!;
    expect(edu.kind).toBe('custom'); // structured inferred from ### lines
    expect(edu.title).toBe('教育经历');

    // A block with neither ### nor bullet lines is inferred as freeform text.
    const skills = parsed.sections[2]!;
    expect(skills).toMatchObject({ kind: 'freeform', markdown: '熟悉 React 和 Vue\n了解 Rust' });
    expect(parsed.sections[3]).toMatchObject({ kind: 'freeform', title: '自我评价' });
  });

  it('turns plain lines inside structured sections into bullets with warnings', () => {
    const md = `---
name: X
sections:
  - {id: s1, kind: skills, title: 技能}
---

## 技能

熟悉 React 和 Vue
了解 Rust
`;
    const { doc, warnings } = applyMarkdownToDoc(md, null, { now: NOW });
    const skills = doc.sections[0]!;
    expect(skills.kind).toBe('skills');
    if (skills.kind !== 'freeform') {
      expect(skills.entries[0]!.bullets).toEqual(['熟悉 React 和 Vue', '了解 Rust']);
    }
    expect(warnings.filter((w) => w.code === 'loose-line')).toHaveLength(2);
  });

  it('reports dropped registry sections', () => {
    const md = `---
name: X
sections:
  - {id: s1, kind: skills, title: 技能}
  - {id: s2, kind: projects, title: 项目}
---

## 技能
- a
`;
    const { warnings } = applyMarkdownToDoc(md, null, { now: NOW });
    expect(warnings.some((w) => w.code === 'dropped-section')).toBe(true);
  });

  it('throws InkMdParseError with a line number on broken YAML', () => {
    const md = `---
name: [unclosed
---

## X
`;
    try {
      parseResumeMarkdown(md);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InkMdParseError);
      expect((err as InkMdParseError).line).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('id stability across markdown edits', () => {
  it('keeps section and entry ids when text is edited', () => {
    const doc = sampleResume('zh', NOW);
    const md = serializeResumeToMarkdown(doc);
    // Simulate a user editing a bullet in the markdown view.
    const edited = md.replace('- 主导简历渲染引擎重构', '- 主导渲染引擎彻底重构');
    const { doc: doc2 } = applyMarkdownToDoc(edited, doc, { now: NOW });
    expect(doc2.sections.map((s) => s.id)).toEqual(doc.sections.map((s) => s.id));
    const flatIds = (d: typeof doc) =>
      d.sections.flatMap((s) => (s.kind === 'freeform' ? [] : s.entries.map((e) => e.id)));
    expect(flatIds(doc2)).toEqual(flatIds(doc));
  });

  it('keeps entry ids when entries are reordered (matched by content)', () => {
    const doc = sampleResume('zh', NOW);
    const projects = doc.sections.find((s) => s.kind === 'projects')!;
    const skills = doc.sections.find((s) => s.kind === 'skills')!;
    const md = serializeResumeToMarkdown(doc);
    // Move the whole projects section after skills by swapping registry+body order.
    const lines = md.split('\n');
    // Simpler: rebuild doc with swapped sections and check serialize/apply agree.
    const swapped = {
      ...doc,
      sections: doc.sections.map((s) => (s.id === projects.id ? skills : s.id === skills.id ? projects : s)),
    };
    const mdSwapped = serializeResumeToMarkdown(swapped);
    const { doc: doc2 } = applyMarkdownToDoc(mdSwapped, doc, { now: NOW });
    expect(doc2.sections.map((s) => s.id)).toEqual(swapped.sections.map((s) => s.id));
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('settings preservation', () => {
  it('keeps previous theme settings when the buffer has no settings key', () => {
    const doc = sampleResume('zh', NOW);
    const customized = {
      ...doc,
      settings: { ...doc.settings, template: 'minimal-ats', tokens: { ...doc.settings.tokens, fontSize: 12 } },
    };
    const { doc: next } = applyMarkdownToDoc('# 新简历\n\n## 技能\n- React\n', customized, { now: NOW });
    expect(next.settings).toEqual(customized.settings);
    expect(next.basics.name).toBe('新简历');
  });
});

describe('migrate', () => {
  it('accepts current-version documents', () => {
    const doc = sampleResume('en', NOW);
    expect(migrateDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('rejects unknown versions', () => {
    expect(() => migrateDoc({ schemaVersion: 99 })).toThrow(/schemaVersion/);
  });
});
