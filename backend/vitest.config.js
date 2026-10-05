import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// JSX component tests live alongside API tests but must use the frontend's
// React instance. Do not rely on incidental root node_modules installations.
export default defineConfig({
  resolve: {
    alias: {
      react: fileURLToPath(new URL('../frontend/node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('../frontend/node_modules/react-dom', import.meta.url)),
      'react-router-dom': fileURLToPath(new URL('../frontend/node_modules/react-router-dom', import.meta.url)),
    },
  },
});
