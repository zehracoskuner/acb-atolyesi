import { readFile, readdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['shared/features.js', 'shared/drawingProtocol.js'];
const hashes = {};
const imports = { frontend: [], backend: [] };
async function scan(directory, side) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'tests', '.git', '.cache'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(full, side);
    else if (/\.(js|jsx)$/.test(entry.name)) {
      const source = await readFile(full, 'utf8');
      for (const match of source.matchAll(/from\s+["']([^"']*shared\/[^"']+)["']/g)) {
        const resolved = await realpath(path.resolve(path.dirname(full), match[1]));
        const relative = path.relative(root, resolved).replaceAll('\\', '/');
        if (!files.includes(relative)) throw new Error(`Unexpected shared import: ${relative}`);
        imports[side].push({ source: path.relative(root, full).replaceAll('\\', '/'), target: relative });
      }
    }
  }
}
for (const file of files) hashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
await scan(path.join(root, 'frontend/src'), 'frontend');
await scan(path.join(root, 'backend'), 'backend');
for (const side of Object.keys(imports)) for (const file of files) {
  if (!imports[side].some(item => item.target === file)) throw new Error(`${side} does not resolve ${file}`);
}
for (const file of files) await import(new URL('../' + file, import.meta.url));
if (process.argv.includes('--committed')) {
  // A release must use committed, unchanged source for both services.
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  for (const file of files) {
    if (git(['ls-files', '--error-unmatch', file]).status !== 0) throw new Error(`Release source is untracked: ${file}`);
    if (git(['check-ignore', '--no-index', file]).status === 0) throw new Error(`Release source is ignored: ${file}`);
  }
  if (git(['diff', '--exit-code', 'HEAD', '--', ...files]).status !== 0) throw new Error('Shared release source differs from HEAD.');
  console.log('Shared release commit:', git(['rev-parse', 'HEAD']).stdout.trim());
}
console.log(JSON.stringify({ hashes, imports }, null, 2));
