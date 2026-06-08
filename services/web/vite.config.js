import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000';

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
    alias: {
      // Use the build that bundles the runtime template compiler so the
      // inline `template:`-string components (Section/Num/ColorRow in
      // PropertiesPanel) render in the production build, not just in dev.
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor libs into their own chunks so the
        // browser caches them across app deploys and the entry chunk shrinks.
        manualChunks: {
          konva: ['konva', 'vue-konva'],
          'vue-vendor': ['vue', 'pinia'],
          highlight: ['highlight.js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
});
