// Downloads the Noto Sans/Serif SC subset OTF faces used by the PDF renderer.
// Idempotent: files that already exist are skipped. Run with `node scripts/fetch-fonts.mjs`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '..', 'assets', 'fonts');

// Each font is available from jsdelivr; raw.githubusercontent.com is the fallback mirror.
const JSDELIVR = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main';
const RAW = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main';

/** @type {{ file: string; path: string }[]} */
const FONTS = [
  { file: 'NotoSansSC-Regular.otf', path: 'Sans/SubsetOTF/SC/NotoSansSC-Regular.otf' },
  { file: 'NotoSansSC-Bold.otf', path: 'Sans/SubsetOTF/SC/NotoSansSC-Bold.otf' },
  { file: 'NotoSerifSC-Regular.otf', path: 'Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf' },
  { file: 'NotoSerifSC-Bold.otf', path: 'Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf' },
];

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 1000) throw new Error(`suspiciously small response (${buf.byteLength} bytes)`);
  return buf;
}

async function main() {
  mkdirSync(fontsDir, { recursive: true });

  for (const { file, path } of FONTS) {
    const dest = join(fontsDir, file);
    if (existsSync(dest)) {
      console.log(`[skip]  ${file} (already present)`);
      continue;
    }

    const sources = [`${JSDELIVR}/${path}`, `${RAW}/${path}`];
    let saved = false;
    let lastErr;
    for (const url of sources) {
      try {
        process.stdout.write(`[fetch] ${file} <- ${url} ... `);
        const buf = await download(url);
        writeFileSync(dest, buf);
        console.log(`ok (${(buf.byteLength / 1024).toFixed(0)} KB)`);
        saved = true;
        break;
      } catch (err) {
        console.log(`failed: ${err instanceof Error ? err.message : String(err)}`);
        lastErr = err;
      }
    }
    if (!saved) {
      throw new Error(`Could not download ${file} from any source: ${lastErr}`);
    }
  }

  console.log(`\nFonts ready in ${fontsDir}`);
}

main().catch((err) => {
  console.error('\nfetch-fonts failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
