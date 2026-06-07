import { createApp } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia } from './store/project.js';
import './styles/main.css';

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);
app.mount('#app');

// Dev-only test affordance: expose the project store so end-to-end (Playwright)
// tests can read/seed project state. Stripped from production builds.
if (import.meta.env.DEV) {
  import('./store/project.js').then(({ useProjectStore }) => {
    window.__projectStore = useProjectStore();
  });
}
