<template>
  <transition name="menu-pop">
    <div v-if="show" class="ps-overlay" @click.self="close">
      <div class="ps-dialog" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title">
        <div class="ps-head">
          <div>
            <h2 id="ps-dialog-title" class="ps-title">Project Snapshots</h2>
            <p class="ps-subtitle">Save and restore named project states from this browser.</p>
          </div>
          <button class="ps-btn ps-btn-secondary" @click="createSnapshot">Create Snapshot</button>
        </div>

        <label class="ps-label" for="ps-label-input">Snapshot label</label>
        <input
          id="ps-label-input"
          v-model="snapshotLabel"
          class="ps-input"
          placeholder="My Animation Snapshot"
          @keydown.enter="createSnapshot"
        />

        <div v-if="snapshots.length === 0" class="ps-empty">
          No snapshots saved yet.
        </div>

        <div v-else class="ps-list">
          <article v-for="snap in snapshots" :key="snap.id" class="ps-item">
            <div class="ps-item-main">
              <div class="ps-item-title">{{ snap.label }}</div>
              <div class="ps-item-meta">{{ formatDate(snap.createdAt) }}</div>
              <div class="ps-item-meta">
                {{ snap.projectName }} · {{ snap.objectCount }} objects · {{ snap.assetCount }} assets
              </div>
              <div v-if="snap.renderStatus" class="ps-item-meta">
                Render {{ snap.renderStatus }} · {{ snap.renderFormat }}
              </div>
            </div>
            <div class="ps-item-actions">
              <button class="ps-btn" @click="restoreSnapshot(snap.id)">Restore</button>
              <button class="ps-btn ps-btn-danger" @click="deleteSnapshot(snap.id)">Delete</button>
            </div>
          </article>
        </div>

        <div class="ps-footer">
          <button class="ps-btn ps-btn-secondary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore } from '../../store/project.js';

interface SnapshotSummary {
  id: string;
  label: string;
  createdAt: number;
  projectName: string;
  projectId: string | null;
  objectCount: number;
  assetCount: number;
  renderStatus: string | null;
  renderFormat: string;
}

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const store = useProjectStore();

const snapshotLabel = ref('');
const snapshots = ref<SnapshotSummary[]>([]);

const defaultLabel = computed(() => `${store.project.name || 'Project'} Snapshot`);

watch(
  () => props.show,
  (open) => {
    if (!open) return;
    snapshotLabel.value = defaultLabel.value;
    refreshSnapshots();
  }
);

function refreshSnapshots() {
  snapshots.value = [...store.listProjectSnapshots()].sort((a, b) => b.createdAt - a.createdAt);
}

function close() {
  emit('close');
}

function createSnapshot() {
  store.createProjectSnapshot(snapshotLabel.value);
  refreshSnapshots();
  snapshotLabel.value = defaultLabel.value;
}

function restoreSnapshot(snapshotId: string) {
  if (store.isDirty && !confirm('Discard unsaved changes and restore this snapshot?')) return;
  if (store.restoreProjectSnapshot(snapshotId)) close();
}

function deleteSnapshot(snapshotId: string) {
  if (!confirm('Delete this snapshot?')) return;
  if (store.deleteProjectSnapshot(snapshotId)) refreshSnapshots();
}

function formatDate(ms: number) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}
</script>

<style scoped>
.ps-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}
.ps-dialog {
  background: var(--studio-surface);
  border: 1px solid var(--studio-border);
  border-radius: 12px;
  padding: 24px;
  width: 680px;
  max-width: 96vw;
  max-height: 82vh;
  overflow: auto;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}
.ps-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.ps-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--studio-text);
}
.ps-subtitle {
  margin: 4px 0 0;
  color: var(--studio-text-muted);
  font-size: 12px;
}
.ps-label {
  display: block;
  margin: 14px 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--studio-text-muted);
}
.ps-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--studio-border);
  background: var(--studio-bg);
  color: var(--studio-text);
  outline: none;
}
.ps-input:focus {
  border-color: var(--studio-accent);
  box-shadow: 0 0 0 2px rgb(var(--c-accent) / 0.2);
}
.ps-empty {
  margin-top: 16px;
  padding: 18px;
  border: 1px dashed var(--studio-border);
  border-radius: 10px;
  color: var(--studio-text-muted);
  font-size: 13px;
}
.ps-list {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}
.ps-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--studio-border);
  background: color-mix(in srgb, var(--studio-surface) 92%, transparent);
}
.ps-item-main {
  min-width: 0;
}
.ps-item-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--studio-text);
  margin-bottom: 2px;
}
.ps-item-meta {
  color: var(--studio-text-muted);
  font-size: 12px;
  line-height: 1.45;
}
.ps-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.ps-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.ps-btn {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--studio-border);
  background: var(--studio-bg);
  color: var(--studio-text);
  cursor: pointer;
}
.ps-btn:hover {
  border-color: var(--studio-accent);
}
.ps-btn-secondary {
  background: color-mix(in srgb, var(--studio-surface) 92%, transparent);
}
.ps-btn-danger {
  border-color: rgb(var(--c-danger) / 0.45);
  color: var(--studio-danger);
}
</style>
