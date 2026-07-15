# InkCV 交接文档（Claude → Codex，更新于 2026-07-15）

本文档写给接手开发的 AI 代理/工程师。硬性规则的速查版在根目录 **AGENTS.md**（请先读），
产品与架构的完整设计依据在 **docs/design.md**（含调研结论），贡献规范在 **CONTRIBUTING.md**。

---

## 1. 项目一句话

**InkCV（墨简）**：开源、本地优先的简历制作工具。差异化 =「表单 ⇋ Markdown 双模式双向同步」
（经竞品调研确认是 >1k★ 赛道空白）+「预览即导出的 PDF」+ Web/Tauri 双发 + 中英文一等公民。
目标：GitHub 高星。许可证 MIT。

## 2. 当前状态（v0.2 公测候选，2026-07-15）

当前基线为 **85 个自动测试全绿**，typecheck 零错误，`pnpm --filter @inkcv/web build` 通过。

v0.2 在 v0.1 垂直切片上补齐了：Web 内存 Key 与桌面系统凭据库、Nitro/Vercel 同源 AI
代理、四家供应商入口、`.inkcv` 原子备份恢复、本地照片裁剪压缩、带照片 LaTeX ZIP、统一
FileGateway、<900px 手机编辑/预览工作台、Tauri 原生 HTTP/文件对话框/CSP/图标，以及 tag
驱动的 Windows/macOS/Linux Draft Release 矩阵。ResumeDoc schema 与 Markdown 方言未升级。

已在真实浏览器（Playwright）验证过的流程：
- 首次打开自动播种示例简历（按浏览器语言选 zh/en）
- 表单编辑 → 预览 PDF 与 Markdown 缓冲区同步
- Markdown 整体替换为"手写风格"文本（`# 姓名`、散文段、无注册表的 `##`）→ 宽容解析成功，
  设置保留、ID 稳定
- 4 款 PDF 模板（Onyx / Lapis / Classic / Minimal ATS）、真实缩略图画廊
- 样式抽屉（黑/蓝预设、自定义颜色、字号/行高/间距/页边距）
- ≥1280px 三栏；900-1279px 左侧简历列表抽屉；<900px 编辑/预览双标签工作台
- 导出 PDF / .md / .tex 或带照片 ZIP / .inkcv 备份
- 中/EN 界面切换；控制台零报错
- PDF 质量：`pdffonts` 确认 NotoSansSC Regular+Bold 嵌入+子集化（emb/sub/uni 全 yes），
  中文真粗体，文字可选中

## 3. 仓库结构与关键文件

```
packages/core        schema(zod) + Markdown 方言引擎 + reconciliation ← 整个项目的地基
  src/schema.ts                  ResumeDoc/Section/Entry/ThemeTokens/Settings
  src/markdown/entryLine.ts      条目行文法（转义、保留键、日期识别）
  src/markdown/serialize.ts      确定性序列化器（JSON→md）
  src/markdown/parse.ts          宽容解析器（md→shadow doc + warnings）
  src/markdown/reconcile.ts      applyMarkdownToDoc：回填稳定 id
  src/__tests__/roundtrip.property.test.ts   ★ 回环恒等属性测试（神圣不可破坏）
packages/renderer    react-pdf 模板 + 字体 + 预览管线
  src/fonts.ts                   isNodeEnv() 环境检测 + Noto SC 注册（Bold=独立700字重）
  src/tokens.ts                  resolveTheme()：ThemeTokens→具体值，zh 行高 clamp 1.4
  src/templates/                 4 款模板包装 + singleColumn 共享渲染骨架
  src/compile.ts / worker.ts / previewClient.ts / pdfjsView.ts   编译与预览
  scripts/fetch-fonts.mjs        字体下载（assets/fonts/ 已 gitignore）
packages/exporters   .tex（Mustache，分隔符 <% %>）/.md 导出 + downloadFile
packages/ai          BYO-key 客户端（openai-compatible + anthropic）+ 文本→简历抽取 + 润色
packages/ui          全部 React 组件 + store.ts（双模式状态机，我手写的核心交互逻辑）
apps/web             Vite 应用：IdbDocStore 持久化、500ms 自动保存、首跑播种
apps/desktop         Tauri 2 壳（仅脚手架，见 §6）
.github/             CI（测试+构建+字体缓存）、issue 模板（防"投简历式"垃圾 issue）
```

关键接口契约（跨包调用面，改动需谨慎）：
- `useEditorStore`：`loadDoc / updateDoc(mutate) / setViewMode / setMdBuffer / commitMd / discardMd / previewBytes`
- `DocStore`（apps 注入）：`list() / load(id) / save(doc) / remove(id)`
- renderer：`compileResume(doc)→Uint8Array`、`PdfPreviewController`、`renderPdfToCanvas`、`templates`
- exporters：`exportTex(doc)`、`texTemplates`、`downloadFile`
- ai：`textToResumeDraft(cfg, text)`、`draftToDoc(draft, base?)`、`polishBullets`、`PROVIDER_PRESETS`

## 4. 必须理解的设计不变量

1. **JSON 唯一真相源**。Markdown 是"可编辑投影"：同一时刻只有一个视图是热的；
   Markdown 在 debounce 800ms/blur/切视图时通过 `applyMarkdownToDoc` 提交；
   解析错误（InkMdParseError）会阻塞切回表单，用户可修复或 discard。
2. **回环恒等**：`applyMarkdownToDoc(serialize(doc), doc, {now}) === doc`，
   属性测试 750+ 轮/次保护。方言的每个转义规则（`\|` `\@` `\\`、freeform 行首 `\##`、
   secondary 撞保留形态时降级为 `role:` kv）都是为这个恒等服务的，动之前先读
   entryLine.ts 顶部的文法注释。
3. **预览=导出**：react-pdf 在 Web Worker 编译 → 字节流 → pdf.js 画 canvas。
   worker 挂掉自动降级主线程（PreviewPane.onError 里有每 revision 一次的重试）。
4. **无后端**：数据在 IndexedDB；AI Key 在 localStorage（桌面版迁 keychain 是待办）。

## 5. 踩坑记录（都修好了，但别再踩）

| 坑 | 根因 | 现状 |
|---|---|---|
| Worker 里预览永远"编译中" | `typeof window==='undefined'` 在 Worker 里为 true → 走了 Node 专用 renderToBuffer | 统一用 `isNodeEnv()`（查 process.versions.node） |
| Worker 静默死亡无报错 | @vitejs/plugin-react 给 worker 依赖图里的 .tsx 注入 @react-refresh，运行时引用 window | vite.config 已 exclude `packages/renderer/`，勿删 |
| 姓名与头衔重叠 | react-pdf 无单位 lineHeight 在声明节点解析成绝对 pt 被子节点继承 | 大字号 Text 自带 lineHeight（onyx name=1.2） |
| 中文 .tex 编译豆腐块 | ctex 按 locale 而非内容判断 | `hasCjk`（内容含 CJK 正则）驱动 ctex |
| renderInline 无限循环 OOM | 模块级 `/g` 正则 + 递归共享 lastIndex | 每次调用新建 RegExp |
| CJK 假粗体 | react-pdf 对 fallback 字体粗体退化 400 | Bold.otf 显式注册为同 family 的 700 字重 |
| pdf.js 容器被 React 崩 removeChild | renderPdfToCanvas 用 replaceChildren 接管了 React 管理的节点 | 预览容器是 React 空叶子，占位符为兄弟节点 |

另有一次**未复现的属性测试失败**（"Property failed after 5 tests"，发生在多 agent 并发跑
pnpm 时；此后 2.6 万+ 随机文档零失败）。若 CI 再出现：fast-check 会打印 seed 和
Counterexample，务必保存下来定位——不要直接 retry 掩盖。

## 6. 待办路线图（按建议优先级）

### P0 发布链路（星标增长的前提）
- [ ] GitHub 建仓推送。注意：GitHub 已有 `cosmoscatts/InkCV`（1★、建仓当天停更），
      不构成实质冲突；npm `inkcv` 可用。用户如介意可发布前改名（代码层成本很低）。
- [ ] 在线 Demo 部署（Vercel 或 GitHub Pages；vite base 已设 './'）。README 顶部放链接 + GIF 演示。
- [ ] README 完善：英文段扩写、功能 GIF（录屏「粘贴文本→AI 导入→换模板→导出」最有传播力）。

### P1 产品补齐
- [x] **模板扩充到 4 款**（M6）：Onyx / Lapis / Classic / Minimal ATS 已注册；模板统一消费
      `ResolvedTheme`，中英文、照片、黑蓝配色、自由文本和长内容分页已有编译测试覆盖。
- [ ] **AI 链路真实 Key 实测**（M5 代码已完成、mock 测试 17 个全过，但未用真实
      OpenAI/DeepSeek/Anthropic Key 打过真流量）。重点验证：JSON 输出解析健壮性、
      DeepSeek 的 openai-compatible 兼容差异、错误信息对小白是否可读。
- [ ] 照片支持完善：photo 目前只支持 URL 输入；应支持本地文件选择→dataURL。
      .tex 导出不含照片（模板未建模，已知欠账）。

### P2 桌面端（M7，需要 Rust 工具链，本机未装）
- [ ] `rustup` 装工具链后 `pnpm --filter @inkcv/desktop dev` 冒烟
- [ ] 应用图标（`tauri icon`）→ tauri.conf.json `bundle.active: true`
- [ ] blob 下载在 WKWebView 不可靠 → 接 tauri-plugin-dialog/fs 原生保存对话框
- [ ] AI Key 迁 OS keychain；GitHub Releases 三平台发版工作流

### P3 远期方向（docs/design.md 有依据）
- [ ] CLI/脚本化导出接口（LapisCV 用户明确要过，CI 场景刚需）
- [ ] typst.ts WASM 作为 v2 渲染引擎（同引擎出预览 SVG 和 PDF，排版质量更高；
      代价 ~13MB WASM，方案调研已在 design.md）
- [ ] 字体子集化导出（当前导出即子集；web 端加载仍是全字体 ~8MB/字重，可再优化）
- [ ] Word (.docx) 导出（国内 HR 刚需，调研过实现成本中等）

## 7. 验证手册（改动后怎么自证）

```bash
pnpm test && pnpm typecheck && pnpm --filter @inkcv/web build   # 基线，必须全绿
```

- **改了 core 方言** → 属性测试就是裁判；再手工跑一次 §2 的浏览器流程里
  "Markdown 整体替换"用例。
- **改了 renderer/模板** → 生成真 PDF 目检 + 查字体：
  在 renderer 下临时写一个 vitest 用例调 `compileResume(sampleResume('zh'))` 落盘，
  然后 `pdffonts xx.pdf`（应看到 emb/sub 全 yes）、`pdftoppm -png` 转图目检
  （本机装了 poppler-utils）。**别忘了删临时测试文件。**
- **改了 UI/预览管线** → `pnpm dev` + 浏览器走：首跑播种 → 表单改名 → 切 Markdown
  确认同步 → 改 md 切回 → Export 三连 → 控制台无 error。关键 testid：
  `mode-form / mode-markdown / export-pdf / export-md / export-tex / template-picker / preview / ai-import`。
- **改了依赖** → 提交 pnpm-lock.yaml（CI 是 frozen-lockfile）。

## 8. 环境备忘

- Node 24 / pnpm 11.3（corepack）；无 Rust（桌面构建不可用）；无 xelatex
  （.tex 只能静态断言，不能本地编译验证——可考虑在 CI 加 texlive 任务编译样例）。
- 字体：`packages/renderer/assets/fonts/` 被 gitignore，首次开发/CI 都要跑 fetch 脚本
  （CI 已配 actions/cache）。
- 浏览器端字体走 jsdelivr CDN 懒加载；备用源 raw.githubusercontent.com（脚本里有 fallback）。
