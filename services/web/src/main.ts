import { createApp } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia, useProjectStore } from './store/project.js';
import './styles/main.css';

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);

// Global safety net: surface unexpected component errors via the existing error
// toast instead of silently white-screening. Per-panel <ErrorBoundary> wrappers
// isolate most failures; this catches anything that escapes them.
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue error]', info, err);
  try {
    useProjectStore().setError('An unexpected error occurred. Your work is safe — please retry.');
  } catch {
    /* store not ready */
  }
};
window.addEventListener('unhandledrejection', (ev) => {
  console.error('[Unhandled promise rejection]', ev.reason);
});

app.mount('#app');

// Dev-only test affordance: expose the project store so end-to-end (Playwright)
// tests can read/seed project state. Stripped from production builds.
if (import.meta.env.DEV) {
  import('./store/project.js').then(({ useProjectStore }) => {
    window.__projectStore = useProjectStore();
  });
}
