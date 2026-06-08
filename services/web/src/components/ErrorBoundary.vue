<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const props = defineProps({
  label: { type: String, default: 'panel' },
});

const failed = ref(false);
const message = ref('');

// Isolate a render/lifecycle error in this subtree so one panel crashing can't
// white-screen the whole editor (and lose unsaved work). Returning false stops
// the error from propagating further up the component tree.
onErrorCaptured((err: unknown): boolean => {
  failed.value = true;
  message.value = err instanceof Error ? err.message : String(err);
  console.error(`[ErrorBoundary:${props.label}]`, err);
  return false;
});

function retry(): void {
  failed.value = false;
  message.value = '';
}
</script>

<template>
  <div v-if="failed" class="error-boundary" role="alert">
    <p class="eb-title">The {{ label }} hit an error and was isolated to keep your work safe.</p>
    <p v-if="message" class="eb-msg">{{ message }}</p>
    <button class="eb-retry" @click="retry">Retry</button>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  padding: 12px;
  margin: 8px;
  border: 1px solid var(--studio-border, #444);
  border-radius: 6px;
  background: var(--studio-surface, #2a2a2a);
  color: var(--studio-text, #ddd);
  font-size: 12px;
}
.eb-title {
  font-weight: 600;
}
.eb-msg {
  margin-top: 6px;
  opacity: 0.7;
  font-family: monospace;
  font-size: 11px;
  word-break: break-word;
}
.eb-retry {
  margin-top: 8px;
  padding: 4px 12px;
  border: 1px solid var(--studio-border, #444);
  border-radius: 4px;
  cursor: pointer;
}
</style>
