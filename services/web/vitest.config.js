import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'resolve-ts-from-js',
      enforce: 'pre',
      resolveId(id, importer) {
        if (importer && (id.startsWith('./') || id.startsWith('../')) && id.endsWith('.js')) {
          const tsPath = path.resolve(path.dirname(importer), id.replace(/\.js$/, '.ts'));
          if (fs.existsSync(tsPath)) return tsPath;
        }
        return null;
      },
    },
  ],
  resolve: {
    conditions: ['source', 'import', 'module', 'browser', 'default'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'tests/engine.test.mjs'],
  },
});
