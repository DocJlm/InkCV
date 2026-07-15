# @inkcv/desktop

Tauri 2 desktop application for InkCV. It shares the React UI and PDF renderer with the Web app, while providing native HTTP, open/save dialogs, file access, and OS credential storage.

## Prerequisites

- Rust toolchain (`rustup`), plus the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)
- `pnpm install` at the repo root

## Develop / build

```bash
pnpm --filter @inkcv/desktop dev     # tauri dev (starts the web dev server automatically)
pnpm --filter @inkcv/desktop build   # platform-native unsigned bundles
```

The bundle is configured for Windows NSIS/MSI, macOS DMG, and Linux AppImage/Deb. Builds are platform-specific; GitHub Actions produces all release targets from a tag.

## Runtime behavior

- Imports and exports use native dialogs and filesystem APIs.
- AI requests use the Tauri HTTP plugin instead of the Web proxy.
- API keys use macOS Keychain, Windows Credential Manager, or Linux Secret Service through the Rust keyring backend.
- If Linux has no usable Secret Service, the key remains in memory for the current session and the UI shows a warning.
- Capabilities are limited in `src-tauri/capabilities/default.json`; CSP remains enabled.

Packages are intentionally unsigned in v0.2. Release checks install or mount each generated package, start the application, and confirm that its process remains alive before publication.
