# Contributing to InkCV

感谢你的兴趣！Thanks for your interest in contributing.

## Development setup

```bash
pnpm install
node packages/renderer/scripts/fetch-fonts.mjs   # one-time CJK font download (~30 MB)
pnpm dev                                          # Web + local AI proxy on http://localhost:5173
pnpm test
pnpm typecheck
pnpm --filter @inkcv/web build
```

Building the Tauri application additionally requires the Rust toolchain and the
platform prerequisites documented by Tauri:

```bash
pnpm --filter @inkcv/desktop build
```

## Repository layout

| Package | Responsibility |
|---|---|
| `packages/core` | Resume schema, Markdown dialect, reconciliation and `.inkcv` backup |
| `packages/renderer` | react-pdf templates, theme tokens, PDF worker and preview |
| `packages/exporters` | Markdown, LaTeX/ZIP and backup export |
| `packages/ai` | Provider profiles, transports, extraction and polishing |
| `packages/ui` | Shared React workbench, runtime services and responsive UI |
| `apps/web` | Vite + Nitro Web application and same-origin AI proxy |
| `apps/desktop` | Tauri 2 shell and native credential/file/HTTP adapters |

## Ground rules

- Preserve `JSON → Markdown → JSON` identity. Run
  `pnpm --filter @inkcv/core test` after any Markdown dialect change and update
  `docs/design.md` when the grammar changes.
- Preview and PDF export must both use `compileResume()`; do not add an HTML
  resume renderer.
- New PDF templates belong in `packages/renderer/src/templates/`, must be
  registered, and may consume only resolved theme tokens for visual values.
- User-visible strings must exist in both `packages/ui/src/i18n/zh.ts` and
  `packages/ui/src/i18n/en.ts`.
- Never persist, log or include an AI API key in errors, screenshots or backups.

## Commit and pull request conventions

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Keep one logical change per pull request and include tests for changed behavior.
- Before opening a pull request, run the test, typecheck and Web build commands
  above. Native changes should also pass the desktop build on every affected OS.
