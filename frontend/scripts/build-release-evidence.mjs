import { build } from 'vite';
import { writeFile } from 'node:fs/promises';

// Reuse the real production config; inspect emitted chunks, not installed files.
const target = process.argv[2];
if (!target) throw new Error('An evidence output path is required.');
await build({ plugins: [{
  name: 'release-bundle-evidence',
  async generateBundle(_options, bundle) {
    const modules = [...new Set(Object.values(bundle).flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : []))];
    const contains = fragment => modules.filter(id => id.replaceAll('\\', '/').includes(fragment));
    const serverOnly = Object.fromEntries(['nodemailer', 'form-data', 'passport', 'axios/lib/adapters/http.js', 'axios/lib/platform/node'].map(name => [name, contains('/node_modules/' + name)]));
    const relevant = modules.filter(id => /[/\\](shared[/\\]|node_modules[/\\](axios|@tiptap|dompurify|react-router))/.test(id))
      .map(id => id.replaceAll('\\', '/').replace(/^.*?\/(node_modules|shared)\//, '$1/'));
    await writeFile(target, JSON.stringify({ emittedModuleCount: modules.length, serverOnly, relevant }, null, 2));
    if (Object.values(serverOnly).some(items => items.length)) throw new Error('Unexpected server-only dependency emitted in browser chunks.');
  },
}] });
