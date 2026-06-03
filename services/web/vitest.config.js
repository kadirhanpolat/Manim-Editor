import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        compatConfig: { MODE: 2 }
      }
    }
  })],
  resolve: {
    alias: { 'vue': '@vue/compat' }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'tests/engine.test.mjs'],
  },
});
