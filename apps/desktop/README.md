# @inkcv/desktop

Tauri 2 desktop shell wrapping the InkCV web app.

## Prerequisites

- Rust toolchain (`rustup`), plus the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)
- `pnpm install` at the repo root

## Develop / build

```bash
pnpm --filter @inkcv/desktop dev     # tauri dev (starts the web dev server automatically)
pnpm --filter @inkcv/desktop build   # tauri build (bundling disabled until icons are added)
```

## TODO (M7)

- App icons (`pnpm --filter @inkcv/desktop tauri icon <source.png>`), then set `bundle.active: true`
- Native save dialogs via tauri-plugin-dialog/fs (blob downloads are unreliable in WKWebView)
- Store the AI API key in the OS keychain instead of localStorage
- GitHub Releases workflow for Win/macOS/Linux artifacts
