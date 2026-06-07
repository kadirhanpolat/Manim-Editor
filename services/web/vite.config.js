import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Use the build that bundles the runtime template compiler so the
      // inline `template:`-string components (Section/Num/ColorRow in
      // PropertiesPanel) render in the production build, not just in dev.
      vue: 'vue/dist/vue.esm-bundler.js',
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
