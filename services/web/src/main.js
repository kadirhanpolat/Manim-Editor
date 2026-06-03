import { createApp } from 'vue';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { pinia } from './store/project.js';
import './styles/main.css';

const app = createApp(App);
app.use(VueKonva);
app.use(pinia);
app.mount('#app');
