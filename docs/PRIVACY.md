# InkCV privacy and AI key handling

InkCV is local-first and does not implement accounts, analytics, a user database, or cloud résumé sync.

## Résumé data

- Web documents are stored in the browser's IndexedDB on the current device.
- Desktop documents use the same local application data model.
- PDF, Markdown, LaTeX/ZIP, and `.inkcv` files are created only when the user asks to export them.
- `.inkcv` backups include the résumé document and an inline photo, but never AI credentials.

## AI requests

- AI is optional and uses a key supplied by the user.
- The web app keeps the key only in JavaScript memory. It is cleared on reload or close and is not written to localStorage, IndexedDB, exports, logs, or screenshots by InkCV.
- The web app sends the key to the same-origin `/api/ai/chat` Function for that request. The Function sets `Cache-Control: no-store`, does not persist the request, and maps upstream errors without echoing the key.
- The desktop app sends requests directly with Tauri's native HTTP client. It stores the key in the operating system credential manager when available, otherwise only for the current app session.
- Prompt text and résumé content selected for AI processing are sent to the chosen provider and are subject to that provider's terms and privacy policy.

## Network boundaries

The production proxy accepts only built-in provider hosts and administrator-configured extra public HTTPS hosts. Local development and desktop custom providers must also use public HTTPS. Private, loopback, local-network and redirecting endpoints are rejected.

## User control

AI configuration can be cleared from the AI settings dialog. Documents can be deleted from the résumé list, and browser site data can be removed through browser settings. Exported files remain wherever the user saved them.
