// Build-only source/dependency check. Never starts the server or reads .env.
import { readFile, readdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.join(root, 'backend');
const dependencyRoot = await realpath(path.join(backend, 'node_modules'));
const manifest = JSON.parse(await readFile(path.join(backend, 'package.json'), 'utf8'));
const requireBackend = createRequire(path.join(backend, 'package.json'));
for (const name of Object.keys(manifest.dependencies)) {
  const resolved = await realpath(requireBackend.resolve(name));
  if (!resolved.startsWith(dependencyRoot + path.sep)) throw new Error(`Dependency outside backend installation: ${name}`);
}
let references = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'tests', 'scripts', '.cache'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(full);
    else if (entry.name.endsWith('.js') && entry.name !== 'vitest.config.js') {
      const source = (await readFile(full, 'utf8'))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g)) {
        const resolved = await realpath(path.resolve(directory, match[1]));
        if (!resolved.startsWith(root.endsWith(path.sep) ? root : root + path.sep)) throw new Error('Relative import escapes release source');
        references++;
      }
    }
  }
}
await scan(backend);
await import(new URL('../shared/features.js', import.meta.url));
await import(new URL('../shared/drawingProtocol.js', import.meta.url));
// Sharp's native runtime is required by image validation.
requireBackend('sharp');
console.log(`Backend release source OK: ${Object.keys(manifest.dependencies).length} production dependencies, ${references} relative imports, 2 shared modules.`);
