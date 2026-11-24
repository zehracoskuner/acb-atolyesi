// Local visual QA only. The native screens are real; API/session adapters use explicit fixtures.
// Run from mobile/: node scripts/design-preview.mjs. No real credentials or network API calls.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const qa = path.join(root, 'scripts/design-preview');
const { createServer } = await import(pathToFileURL(path.join(root, '../frontend/node_modules/vite/dist/node/index.js')).href);
const adapter = path.join(qa, 'adapters.jsx');
const server = await createServer({ configFile: false, root: qa,
  esbuild: { jsx: 'automatic' },
  plugins: [{ name: 'qa-font-paths', transformIndexHtml: html => html.replaceAll('Z:/acbAstra/mobile', root.replaceAll('\\', '/')) }],
  server: { host: '127.0.0.1', port: Number(process.env.MOBILE_QA_PORT) || 5186, strictPort: true, fs: { allow: [root] } },
  resolve: { dedupe: ['react', 'react-dom'], extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'], alias: [
    { find: /^react-native$/, replacement: require.resolve('react-native-web') },
    { find: /^react-native-svg$/, replacement: require.resolve('react-native-svg/lib/module/elements.web.js') },
    { find: /^(?:.*\/)?(useResource|session|sync|studioStorage|images)$/, replacement: adapter },
    { find: /^expo-router$/, replacement: adapter },
    { find: /^@react-navigation\/native$/, replacement: adapter },
    { find: /^@react-native-google-signin\/google-signin$/, replacement: adapter },
    { find: /^@react-native-community\/netinfo$/, replacement: adapter },
    { find: /^@expo\/vector-icons$/, replacement: path.join(qa, 'icons.jsx') },
    { find: /^react-native-webview$/, replacement: path.join(qa, 'webview.jsx') },
    { find: /^react-native-safe-area-context$/, replacement: path.join(qa, 'safe-area.jsx') },
  ] },
  define: { global: 'globalThis', 'process.env.NODE_ENV': JSON.stringify('development'), 'process.env.EXPO_PUBLIC_API_URL': JSON.stringify('https://visual-qa.invalid/api'), 'process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID': JSON.stringify('') },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-native-web'] },
});
await server.listen();
if (!process.env.MOBILE_QA_PORT) writeFileSync(path.join(root, '.tools/design-preview.pid'), String(process.pid));
console.log(`Visual QA: http://127.0.0.1:${Number(process.env.MOBILE_QA_PORT) || 5186} — fixture data, no backend connection.`);
