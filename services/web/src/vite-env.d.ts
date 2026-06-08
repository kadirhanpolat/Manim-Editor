/// <reference types="vite/client" />
import type { useProjectStore } from './store/project.js';
declare global {
  interface Window {
    __projectStore?: ReturnType<typeof useProjectStore>;
  }
}
export {};
