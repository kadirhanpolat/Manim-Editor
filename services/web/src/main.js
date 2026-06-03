import { createApp, configureCompat } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia } from './store/project.js';
import './styles/main.css';

configureCompat({ MODE: 2 });

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);
app.mount('#app');
