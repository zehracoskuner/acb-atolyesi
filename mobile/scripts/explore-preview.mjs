// Isolated visual/interaction harness. Production screens, hooks and API client;
// only native navigation/session are adapted. HTTP fixtures live in the checker.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const qa = path.join(root, 'scripts/design-preview');
const { createServer } = await import(pathToFileURL(path.join(root, '../frontend/node_modules/vite/dist/node/index.js')).href);
const adapter = path.join(qa, 'explore-adapters.jsx');
const server = await createServer({ configFile: false, root: qa, cacheDir: path.join(root, '.tools/explore-vite'), esbuild: { jsx: 'automatic' },
  plugins: [{ name: 'explore-preview', transformIndexHtml: html => html.replaceAll('Z:/acbAstra/mobile', root.replaceAll('\\', '/')).replace('/App.jsx', '/ExplorePreview.jsx') }],
  server: { host: '127.0.0.1', port: 5188, strictPort: true, fs: { allow: [root] } },
  resolve: { dedupe: ['react', 'react-dom'], extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'], alias: [
    { find: /^react-native$/, replacement: path.join(qa, 'explore-native.jsx') },
    { find: /^(?:.*\/)?(session|sync|studioStorage|images)$/, replacement: adapter },
    { find: /^expo-router$/, replacement: adapter },
    { find: /^@react-navigation\/native$/, replacement: adapter },
    { find: /^@react-native-community\/netinfo$/, replacement: adapter },
    { find: /^@react-native-google-signin\/google-signin$/, replacement: adapter },
    { find: /^react-native-webview$/, replacement: path.join(qa, 'webview.jsx') },
    { find: /^@expo\/vector-icons$/, replacement: path.join(qa, 'icons.jsx') },
    { find: /^react-native-safe-area-context$/, replacement: path.join(qa, 'safe-area.jsx') },
  ] },
  define: { global: 'globalThis', 'process.env.NODE_ENV': JSON.stringify('development'), 'process.env.EXPO_PUBLIC_API_URL': JSON.stringify('https://visual-qa.invalid/api') },
  optimizeDeps: { entries: ['ExplorePreview.jsx'], include: ['react', 'react-dom/client', 'react-native-web'] },
});
await server.listen();
console.log('Explore QA: http://127.0.0.1:5188/#/explore — isolated HTTP fixtures required.');
