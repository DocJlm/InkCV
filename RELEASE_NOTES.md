# InkCV v0.2.0 Public Beta / 公测版

[Web app / 在线版](https://inkcv.vercel.app) · [Privacy / 隐私说明](https://github.com/DocJlm/InkCV/blob/v0.2.0/docs/PRIVACY.md) · [Discussions / 反馈](https://github.com/DocJlm/InkCV/discussions)

## 中文

InkCV v0.2 是首个 Web、手机与三平台桌面端功能闭环的公开公测版。

### 新功能

- 表单与 Markdown 双向编辑，预览和导出共用同一条 PDF 编译路径。
- Onyx、Lapis、Classic、Minimal ATS 四款中英文模板，支持照片、跨页、黑色、蓝色与自定义配色。
- PDF、Markdown、LaTeX/带照片 ZIP 和 `.inkcv` 完整备份导入导出。
- OpenAI、DeepSeek、Anthropic、Moonshot/Kimi 与自定义 OpenAI-compatible BYO-key AI 导入和润色。
- `<900px` 完整手机编辑/预览工作台。
- Windows、macOS Intel/Apple Silicon 与 Linux 安装包。

### 安装

- Windows x64：选择 NSIS `.exe` 或 `.msi`。
- macOS：Apple Silicon 选择 `aarch64.dmg`，Intel 选择 `x64.dmg`。
- Linux x64：选择 `.AppImage` 或 Debian/Ubuntu `.deb`。

安装包尚未签名。Windows SmartScreen 可在核对校验值后选择“更多信息 → 仍要运行”；macOS 可按住 Control 点击应用并选择“打开”。每个安装包都有同名 `.sha256` 文件，可用 `sha256sum -c <file>.sha256` 或系统等价命令验证。

### 隐私与限制

简历留在当前设备；没有账号、数据库、云同步或公共 AI 额度。Web Key 只在当前页面内存中，桌面 Key 优先存入系统凭据库。数据导出和备份不包含 Key。Minimal ATS 是机器可读性友好设计，不代表任何 ATS 认证。v0.2 不含代码签名、公证、应用商店、自动更新或 DOCX 导出。

## English

InkCV v0.2 is the first public beta with complete Web, mobile, and cross-platform desktop workflows.

### What's new

- Bidirectional form/Markdown editing with one shared PDF preview and export pipeline.
- Four bilingual templates with photos, pagination, black, blue, and custom colors.
- PDF, Markdown, LaTeX/photo ZIP, and complete `.inkcv` backup import/export.
- BYO-key AI import and polishing for OpenAI, DeepSeek, Anthropic, Moonshot/Kimi, and compatible providers.
- A complete mobile edit/preview workspace below 900px.
- Packages for Windows, Intel/Apple Silicon macOS, and x64 Linux.

### Install

- Windows x64: use the NSIS `.exe` or `.msi`.
- macOS: use `aarch64.dmg` for Apple Silicon or `x64.dmg` for Intel.
- Linux x64: use the `.AppImage` or Debian/Ubuntu `.deb`.

Packages are unsigned. After verifying the checksum, use “More info → Run anyway” in Windows SmartScreen or Control-click the macOS app and choose “Open.” Every package has a matching `.sha256` file; verify it with `sha256sum -c <file>.sha256` or the platform equivalent.

### Privacy and known limits

Résumé data stays on the current device. There are no accounts, database, cloud sync, or bundled AI credits. Web keys live only in page memory; desktop keys prefer the OS credential store. Exports and backups never contain keys. Minimal ATS favors readable extraction but is not a certification. v0.2 does not include signing, notarization, app-store distribution, auto-update, or DOCX export.
