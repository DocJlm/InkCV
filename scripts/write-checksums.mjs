import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/write-checksums.mjs <bundle-directory>');

const bundleExtensions = new Set(['.exe', '.msi', '.dmg', '.appimage', '.deb']);

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (bundleExtensions.has(extname(entry.name).toLowerCase())) {
      const digest = createHash('sha256').update(await readFile(path)).digest('hex');
      await writeFile(`${path}.sha256`, `${digest}  ${basename(path)}\n`, 'utf8');
    }
  }
}

await visit(root);
