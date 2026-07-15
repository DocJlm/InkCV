# InkCV（墨简）— 开源简历制作工具实施计划

> v0.2 补充：Onyx 为默认模板，新建文档使用 `#1a1a1a` 黑色预设；蓝色预设为
> `#2f5c8f` 强调色与 `#1a1a1a` 正文色。四款模板均走 `compileResume()`。
> 响应式规则为 ≥1280px 三栏、900–1279px 编辑/预览双栏加简历抽屉、<900px
> “编辑 / 预览”双标签手机工作台。AI 配置持久化非敏感 profile；Web Key 只在内存，
> Tauri Key 优先进入系统凭据库。模板排版参考与署名见 README。

## Context

用户想做一款开源、小白友好、即开即用的简历制作工具，目标 GitHub 高星。参考：MarkText（软件形态）、LapisCV（Markdown 中文简历）、billryan/resume（LaTeX 模板）。经三个调研 agent（参考项目 / 竞品格局 / PDF 技术）+ 一个架构设计 agent 验证：**「表单 + Markdown 双模式双向同步」是赛道最干净的空白点**（无任何 >1k★ 项目做到），「Web + Tauri 桌面」组合在 >3k★ 项目中零覆盖。心智上最近的竞品 Reactive-Resume（39.6k★）强依赖 Postgres/Docker 后端，与本地优先根本冲突。

## 已确认的需求（与用户逐问确认）

1. **交互形态**：双模式——表单填空（小白）⇋ Markdown 源码（进阶）双向同步，右侧实时预览。
2. **LaTeX 策略**：不绑定真 LaTeX；内置轻量引擎出「LaTeX 级」PDF；支持导出 .md/.tex 源码。
3. **发布形态**：Web 在线版 + Tauri 2 桌面版（Win/macOS/Linux）双发，一套代码，纯本地存储，无后端。
4. **语言**：内容中英文完美排版（PDF 内嵌中文字体）；界面中英双语。
5. **AI**：用户自带 API Key（OpenAI/Anthropic/DeepSeek 兼容），txt→结构化简历、旧简历导入、润色；无 Key 时隐藏，核心功能不受影响。
6. **导出**：PDF + .md + .tex。
7. **技术栈**：授权我定——React + TypeScript + Vite + Tauri 2 + pnpm workspaces。
8. **命名/许可**：InkCV（墨简），建仓时验证可用性；MIT（竞品 magic-resume 的非商业条款是反面教材）。

## 2026-07 产品闭环补充

- **首发 PDF 模板**：`onyx`（通用左对齐单栏）、`lapis`（紧凑中文排版）、`classic`（居中页眉与经典分节）、`minimal-ats`（兼顾机器读取与视觉层次的简洁单栏）。四款全部通过 `compileResume()` 渲染，模板组件接收集中解析后的 `ResolvedTheme`。
- **颜色策略**：新建和首跑示例显式使用黑色预设（强调色/正文色 `#1a1a1a`）；蓝色预设为 `#2f5c8f` + `#1a1a1a`；保留自定义取色。旧文档不迁移，切换模板不覆盖字体、颜色、字号、行高、间距或页边距。
- **模板画廊**：编辑器使用 2×2 真实 PDF 首页面缩略图画廊，缩略图由中英文示例经 `compileResume()` 和 `pdftoppm` 生成。
- **响应式边界**：≥1280px 保持三栏；900-1279px 将简历列表改为抽屉并保留编辑/预览双栏；<900px 使用完整的“编辑 / 预览”双标签手机工作台，设置与导出通过移动端面板进入。
- **参考与原创边界**：借鉴 [LapisCV](https://github.com/BingyanStudio/LapisCV) 的中文排版/主题变量和 [billryan/resume](https://github.com/billryan/resume) 的经典层级；不复用其 HTML/CSS 或 XeLaTeX 渲染路径。

## 关键技术决策（调研支撑）

- **PDF 引擎：@react-pdf/renderer**（Reactive Resume v5.1 已验证纯客户端可行）。排除：window.print/paged.js（无法静默产出文件）、Tauri 原生打印（macOS WKWebView 空白 PDF bug）、html2pdf.js（栅格化）。typst.ts WASM（~13MB）留作 v2「预览即 PDF」升级方向。
- **预览 = 导出，单渲染路径**：react-pdf 在 Web Worker 内编译 → pdf.js 渲到 canvas 作为预览，**逐字节一致**，从结构上根除本品类第一痛点（LapisCV issue 区实证：预览≠导出）。debounce 300ms + 过期任务取消 + 保留上一帧防闪烁。
- **中文字体**：内置 Noto Sans/Serif SC，按需懒加载（纯英文简历零流量），导出时按用字子集化。两个已知坑的对策：CJK 粗体退化 400 → Bold 注册为独立 fontFamily 显式切换；行高 <1.35 裁切 CJK → zh 语境行高下限 clamp 1.4。
- **数据模型**：自定义 zod schema（不套 JSON Resume 超集），核心特征：sections 数组顺序即渲染顺序、structured/freeform 两类 section、所有条目带稳定 id（nanoid）、内容与主题（ThemeTokens）彻底分离、customFields 承载政治面貌等本土字段（不硬编码）、`extra` 字段保证解析不丢数据。
- **md ⇋ 表单双向同步**：JSON 是唯一真相源，Markdown 是可编辑投影（同一时刻单视图 focus，commit 时同步，回避 CRT 冲突）。方言：YAML front-matter 存结构化元数据 + section 注册表；`##`=section、`### primary | secondary @ location | start – end`=entry、`-`=bullets。解析用 remark，序列化**手写确定性 serializer**（保证 JSON→md→JSON 恒等），fast-check 属性测试入 CI。无法识别的内容分层降级：存 `extra` + gutter 黄色提示 / freeform 原样保留 / 未知 `##` 自动建 freeform section——绝不丢数据。
- **.tex 导出**：独立 Mustache 手写模板（不与 PDF 模板耦合），UI 明示「PDF 是设计品，.md/.tex 是源码」的预期。
- **模板系统**：模板 = `(doc, tokens) => <Document>` 的 react-pdf 组件树；ThemeTokens（字体/字号/行高/颜色/间距）是 LapisCV 式用户可调面板，模板只消费 token。

## 仓库结构（greenfield，位于 /home/winbeau/qianchen_zhao/inkcv/）

```
packages/
  core/        zod schema + md 方言 parser/确定性 serializer + migration（零 React 依赖）
  renderer/    react-pdf 模板 + ThemeTokens + PDF 编译 worker + pdf.js 预览
  exporters/   tex(mustache) / md(复用 core) / pdf(blob 下载)
  ai/          BYO-key 多 provider 客户端 + 文本→ResumeDoc 抽取 + 润色
  ui/          表单编辑器 + CodeMirror md 编辑器 + 预览面板 + 主题面板（双端共用）
apps/
  web/         Vite SPA，IndexedDB 存储，部署 GitHub Pages/Vercel
  desktop/     Tauri 2 壳：原生文件打开/保存、API key 存 OS keychain
templates/     内置模板包（Onyx、Lapis、Classic、Minimal ATS，首发 4 款）
```

最关键文件：`packages/core/src/schema.ts`、`packages/core/src/markdown/{parser,serializer}.ts`、`packages/renderer/src/pdfWorker.ts`、`packages/renderer/src/templates/`、`packages/exporters/src/tex.ts`。

## 实施里程碑

- **M0 脚手架**：验证 InkCV 名称可用性 → git init + pnpm monorepo + Vite/React/TS + Tauri 2 + vitest + GitHub Actions CI + MIT LICENSE；把本设计存入 `docs/design.md`。
- **M1 core**：schema + migration；md 方言 parser/serializer + reconciliation（回填 id）；fast-check 回环恒等测试。
- **M2 renderer**：第一款模板 + ThemeTokens；CJK 字体注册/懒加载/子集化；PDF worker + pdf.js 预览管线（debounce/取消/保帧）。
- **M3 UI**：表单编辑器（分 section 增删排序、可见性开关）⇋ CodeMirror md 编辑器双模式切换；主题调节面板；IndexedDB 自动保存 + 多简历管理；界面 i18n（zh/en）；首次打开加载示例简历（中英各一）。
- **M4 导出**：PDF 下载、.md 导出、.tex 导出（两款 Mustache 模板起步）；桌面端走原生保存对话框。
- **M5 AI**：设置页 BYO Key（Web 仅当前内存会话、桌面存系统凭据库）；「粘贴任意文本 → 结构化简历」导入向导；一键润色 bullets。
- **M6 模板扩充（已完成）**：4 款内置模板、黑蓝预设和真实缩略图模板画廊。
- **M7 桌面打包**：Tauri 三平台构建 + GitHub Releases 自动发版工作流。
- **M8 开源发布件**：中英双语 README（在线 Demo 链接置顶 + GIF 演示）、截图、issue 模板（防 billryan 式垃圾 issue）、CONTRIBUTING、示例简历库。

## 验证方式

- **单元/属性测试**：core 回环恒等（fast-check）、schema migration、tex 模板快照——`pnpm test` 全绿。
- **端到端**：`pnpm dev` 起 Web 版，用 Playwright 走通「新建→表单填写→切 md 源码改动→切回表单确认同步→换模板→调主题→导出 PDF/.md/.tex」全流程；中文简历导出 PDF 后用 `pdffonts` 确认字体已嵌入、分页正确。
- **桌面冒烟**：tag 工作流在 Windows、Intel/ARM macOS 与 Linux 构建真实安装包，完成安装/挂载、启动与进程存活检查后再进入发布 job。
- **AI 链路**：用用户提供的 Key（或 mock server）验证 txt→简历导入。

## 风险登记（Top 5）

1. react-pdf CJK 粗体退化 → Bold 独立 fontFamily 显式切换。
2. 行高 <1.35 裁切 CJK → zh 行高下限 clamp 1.4，滑杆随 locale 收紧。
3. Web 端字体 8MB/字重 → 懒加载 + 子集化 + Cache API 缓存，默认仅 SC Regular+Bold。
4. md⇋表单回环丢数据 → reconciliation + gutter 提示 + 属性测试入 CI。
5. 预览延迟/worker 稳定性 → debounce + job 取消 + 保帧 + worker 挂掉降级主线程。
