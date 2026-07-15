# AGENTS.md — InkCV 开发代理须知

> 完整交接文档见 **docs/HANDOVER.md**（现状/路线图/踩坑记录），产品设计见 **docs/design.md**。

## 常用命令

```bash
pnpm install
node packages/renderer/scripts/fetch-fonts.mjs  # 首次必跑：下载 CJK 字体（~30MB，已 gitignore）
pnpm dev            # Web 应用 http://localhost:5173
pnpm test           # 全部包测试（当前 59 个，必须保持全绿）
pnpm typecheck      # 全部包 tsc --noEmit（strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes）
pnpm --filter @inkcv/web build
pnpm --filter @inkcv/core test   # 单包运行同理
```

## 硬性规则（违反=引入回归）

1. **回环恒等不可破坏**：`packages/core` 的 Markdown 方言必须满足 `JSON→md→JSON` 恒等，由
   `packages/core/src/__tests__/roundtrip.property.test.ts` 的 fast-check 属性测试保护。
   改动方言语法（front-matter、`### primary | secondary @ location | start – end` 条目行、
   转义规则）必须让属性测试继续通过，并同步更新 docs/design.md。
2. **单渲染路径**：预览和导出都只能走 `compileResume()`（react-pdf）。
   永远不要为预览引入第二套 HTML 渲染——"预览即 PDF"是本产品第一卖点。
3. **JSON 是唯一真相源**：表单和 Markdown 都是投影。Markdown 提交必须走
   `applyMarkdownToDoc(md, prevDoc)`（reconciliation 回填稳定 id），不要绕过。
4. **模板只消费 ThemeTokens**：新 PDF 模板放 `packages/renderer/src/templates/`，
   注册进 registry，尺寸/颜色/间距一律来自 `resolveTheme()`，禁止硬编码。
5. **所有 UI 字符串走 i18n**（`packages/ui/src/i18n/`，zh + en 都要加）。
6. **依赖版本**：zod 锁 ^3（v4 的 `.default({})` 语义不同，升级会引入静默 bug）；
   `@types/react`/`@types/react-dom` 用 ^19.2.3（19.2.7 不存在）。
7. **环境检测**：判断 Node 用 `isNodeEnv()`（`packages/renderer/src/fonts.ts`），
   **禁止** `typeof window === 'undefined'`——Web Worker 里它也为 true。
8. **不要把 react Fast Refresh 引入 worker 依赖图**：`apps/web/vite.config.ts` 已将
   `packages/renderer` 从 plugin-react 中 exclude，勿删（否则注入的 @react-refresh
   引用 window，PDF worker 直接死亡且无报错）。
9. **react-pdf 行高陷阱**：无单位 lineHeight 在声明节点解析为绝对值后被子节点继承；
   任何大字号 Text 必须自带 lineHeight。zh 内容行高下限 1.4（低于 ~1.35 会裁切 CJK）。
10. **.tex 的 ctex 按内容判断**：`hasCjk`（内容含 CJK 即加载 ctex），不是按 locale。

## 提交约定

Conventional commits（feat/fix/docs/chore）。提交前：`pnpm test && pnpm typecheck` 全绿。
CI 用 `--frozen-lockfile`——改了任何 package.json 记得跑 `pnpm install` 并提交 lockfile。
