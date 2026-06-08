import { defineConfig } from 'vitest/config';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      // Remap explicit `.js` imports to `.ts` for NodeNext-style ESM sources.
      // Existence-checked so non-TS `.js` imports fall through to default resolution.
      name: 'resolve-ts-from-js',
      resolveId(id, importer) {
        if (importer && (id.startsWith('./') || id.startsWith('../')) && id.endsWith('.js')) {
          const tsPath = path.resolve(path.dirname(importer), id.replace(/\.js$/, '.ts'));
          if (fs.existsSync(tsPath)) return tsPath;
        }
        return null;
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
