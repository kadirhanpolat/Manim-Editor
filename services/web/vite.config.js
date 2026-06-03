import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        compatConfig: { MODE: 2 }
      }
    }
  })],
  resolve: {
    alias: {
      'vue': '@vue/compat'
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true }
    }
  }
});
