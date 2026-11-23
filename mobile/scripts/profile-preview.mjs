// Production profile components, API client and resource hook; local QA adapters only for platform/session/navigation.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const qa = path.join(root, 'scripts/profile-preview');
const { createServer } = await import(pathToFileURL(path.join(root, '../frontend/node_modules/vite/dist/node/index.js')).href);
const adapter = path.join(qa, 'adapters.jsx');
const server = await createServer({ configFile: false, root: qa, esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 5189, strictPort: true, fs: { allow: [root] } },
  resolve: { dedupe: ['react', 'react-dom'], alias: [
    { find: /^react-native$/, replacement: require.resolve('react-native-web') },
    { find: /^(?:.*\/)?(session|images)$/, replacement: adapter },
    { find: /^expo-router$/, replacement: adapter }, { find: /^@react-navigation\/native$/, replacement: adapter },
    { find: /^@expo\/vector-icons$/, replacement: path.join(root, 'scripts/design-preview/icons.jsx') },
    { find: /^react-native-safe-area-context$/, replacement: path.join(root, 'scripts/design-preview/safe-area.jsx') },
  ] },
  define: { global: 'globalThis', 'process.env.NODE_ENV': JSON.stringify('development'), 'process.env.EXPO_PUBLIC_API_URL': JSON.stringify('https://profile-qa.invalid/api') },
});
await server.listen(); console.log('Profile QA: http://127.0.0.1:5189 — intercepted fixture API only.');
