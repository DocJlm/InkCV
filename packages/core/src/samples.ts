import {
  PRESENT,
  RESUME_COLOR_PRESETS,
  ResumeDoc,
  ResumeDocSchema,
  SCHEMA_VERSION,
  newId,
} from './schema';

/**
 * First-run sample resumes. Content is intentionally realistic but fictional.
 */
export function sampleResume(locale: 'zh' | 'en', now?: string): ResumeDoc {
  const ts = now ?? new Date().toISOString();
  return locale === 'zh' ? sampleZh(ts) : sampleEn(ts);
}

function sampleZh(ts: string): ResumeDoc {
  return ResumeDocSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    meta: { id: newId(), createdAt: ts, updatedAt: ts },
    basics: {
      name: '李墨',
      headline: '前端工程师 · 3 年经验',
      contacts: [
        { id: newId(), type: 'phone', value: '138-0000-0000', visible: true },
        { id: newId(), type: 'email', value: 'limo@example.com', visible: true },
        { id: newId(), type: 'github', value: 'github.com/limo', visible: true },
      ],
      customFields: [{ id: newId(), label: '求职意向', value: '资深前端工程师' }],
    },
    sections: [
      {
        id: newId(),
        kind: 'education',
        title: '教育经历',
        visible: true,
        entries: [
          {
            id: newId(),
            primary: '华中科技大学',
            secondary: '软件工程 本科',
            location: '武汉',
            start: '2018-09',
            end: '2022-06',
            tags: [],
            bullets: ['GPA 3.7/4.0，院级奖学金两次', '校开源社区核心成员，维护校内选课插件（1.2k star）'],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'experience',
        title: '工作经历',
        visible: true,
        entries: [
          {
            id: newId(),
            primary: '某互联网公司',
            secondary: '前端工程师',
            location: '深圳',
            start: '2022-07',
            end: PRESENT,
            tags: [],
            bullets: [
              '负责营销活动页搭建平台前端，服务 30+ 运营同学，页面上线周期从 2 天缩短到 2 小时',
              '推动组件库 TypeScript 化改造，类型覆盖率从 40% 提升到 95%，重构期间零线上事故',
              '主导首屏性能专项，LCP 从 3.2s 优化至 1.4s（PageSpeed 分数 58 → 92）',
            ],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'projects',
        title: '项目经历',
        visible: true,
        entries: [
          {
            id: newId(),
            primary: 'InkCV',
            secondary: '开源简历工具 · 核心贡献者',
            start: '2024-03',
            end: PRESENT,
            url: 'https://github.com/example/inkcv',
            tags: ['React', 'TypeScript'],
            bullets: [
              '实现 Markdown 与表单双向同步引擎，属性测试保证序列化回环恒等',
              '设计 PDF 预览管线：Web Worker 编译 + 帧保留策略，编辑时预览零闪烁',
            ],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'skills',
        title: '专业技能',
        visible: true,
        entries: [
          {
            id: newId(),
            tags: [],
            bullets: [
              '熟悉 React / TypeScript / Vite，理解 React 渲染机制与常见性能陷阱',
              '熟悉 Node.js 工具链开发，写过 Vite 插件与 CLI 工具',
              '了解 Rust 与 Tauri 桌面应用开发',
            ],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'freeform',
        title: '自我评价',
        visible: true,
        markdown: '热爱开源，相信**好工具应该让人第一眼就会用**。业余维护两个 npm 包，累计下载 50k+。',
      },
    ],
    settings: { locale: 'zh', tokens: RESUME_COLOR_PRESETS.black },
  });
}

function sampleEn(ts: string): ResumeDoc {
  return ResumeDocSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    meta: { id: newId(), createdAt: ts, updatedAt: ts },
    basics: {
      name: 'Mo Li',
      headline: 'Frontend Engineer · 3 yrs',
      contacts: [
        { id: newId(), type: 'email', value: 'limo@example.com', visible: true },
        { id: newId(), type: 'github', value: 'github.com/limo', visible: true },
        { id: newId(), type: 'url', value: 'limo.dev', visible: true },
      ],
      customFields: [],
    },
    sections: [
      {
        id: newId(),
        kind: 'experience',
        title: 'Experience',
        visible: true,
        entries: [
          {
            id: newId(),
            primary: 'Acme Internet Co.',
            secondary: 'Frontend Engineer',
            location: 'Shenzhen, China',
            start: '2022-07',
            end: PRESENT,
            tags: [],
            bullets: [
              'Built the marketing-page builder used by 30+ operators; page launch time cut from 2 days to 2 hours',
              'Led TypeScript migration of the component library; type coverage 40% → 95% with zero production incidents',
              'Owned the first-paint performance initiative; LCP 3.2s → 1.4s (PageSpeed 58 → 92)',
            ],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'education',
        title: 'Education',
        visible: true,
        entries: [
          {
            id: newId(),
            primary: 'Huazhong University of Science and Technology',
            secondary: 'B.Eng. in Software Engineering',
            location: 'Wuhan, China',
            start: '2018-09',
            end: '2022-06',
            tags: [],
            bullets: ['GPA 3.7/4.0, two college scholarships'],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'projects',
        title: 'Projects',
        visible: true,
        entries: [
          {
            id: newId(),
            primary: 'InkCV',
            secondary: 'Open-source resume builder · core contributor',
            start: '2024-03',
            end: PRESENT,
            url: 'https://github.com/example/inkcv',
            tags: ['React', 'TypeScript'],
            bullets: [
              'Implemented the Markdown ⇋ form bidirectional sync engine with property-tested round-trip identity',
              'Designed the PDF preview pipeline: Web Worker compilation with frame retention for flicker-free editing',
            ],
            visible: true,
            extra: {},
          },
        ],
      },
      {
        id: newId(),
        kind: 'skills',
        title: 'Skills',
        visible: true,
        entries: [
          {
            id: newId(),
            tags: [],
            bullets: [
              'React / TypeScript / Vite; solid grasp of React rendering internals and common performance pitfalls',
              'Node.js tooling: authored Vite plugins and CLI tools',
              'Familiar with Rust and Tauri desktop development',
            ],
            visible: true,
            extra: {},
          },
        ],
      },
    ],
    settings: { locale: 'en', tokens: RESUME_COLOR_PRESETS.black },
  });
}
