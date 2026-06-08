import { defineConfig } from 'vitest/config';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'resolve-ts-from-js',
      enforce: 'pre',
      resolveId(id: string, importer: string | undefined) {
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
    environment: 'node',
  },
});
