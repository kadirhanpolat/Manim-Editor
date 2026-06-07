import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    {
      // Remap explicit `.js` imports to `.ts` for NodeNext-style ESM sources.
      name: 'resolve-ts-from-js',
      resolveId(id, importer) {
        if (importer && id.startsWith('./') && id.endsWith('.js')) {
          const tsPath = path.resolve(path.dirname(importer), id.replace(/\.js$/, '.ts'));
          return tsPath;
        }
        if (importer && id.startsWith('../') && id.endsWith('.js')) {
          const tsPath = path.resolve(path.dirname(importer), id.replace(/\.js$/, '.ts'));
          return tsPath;
        }
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
