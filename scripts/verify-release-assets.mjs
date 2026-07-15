import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/verify-release-assets.mjs <asset-directory>');

const bundleExtensions = new Set(['.exe', '.msi', '.dmg', '.appimage', '.deb']);
const bundles = [];
const checksums = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith('.sha256')) checksums.push(path);
    else if (bundleExtensions.has(extname(entry.name).toLowerCase())) bundles.push(path);
  }
}

await visit(root);
if (bundles.length !== 6) throw new Error(`Expected 6 bundles, found ${bundles.length}.`);
if (checksums.length !== 6) throw new Error(`Expected 6 checksum files, found ${checksums.length}.`);

const names = bundles.map((bundle) => basename(bundle));
const requirements = [
  [/\.exe$/i, 'Windows NSIS'],
  [/\.msi$/i, 'Windows MSI'],
  [/_x64\.dmg$/i, 'macOS Intel DMG'],
  [/_aarch64\.dmg$/i, 'macOS ARM DMG'],
  [/\.AppImage$/i, 'Linux AppImage'],
  [/\.deb$/i, 'Linux DEB'],
];
for (const [pattern, label] of requirements) {
  if (!names.some((name) => pattern.test(name))) throw new Error(`${label} is missing.`);
}

for (const bundle of bundles) {
  const checksumPath = `${bundle}.sha256`;
  const expected = createHash('sha256').update(await readFile(bundle)).digest('hex');
  const content = (await readFile(checksumPath, 'utf8')).trim();
  if (content !== `${expected}  ${basename(bundle)}`) {
    throw new Error(`Checksum mismatch for ${basename(bundle)}.`);
  }
}

console.log(`Verified ${bundles.length} bundles and ${checksums.length} SHA-256 files.`);
