<template>
  <div class="audio-panel px-4 py-3 border-t border-studio-border">
    <div class="text-xs font-medium text-studio-text-muted mb-3">Audio</div>

    <!-- Source selector -->
    <div class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Source</label>
      <div class="flex gap-2">
        <button
          v-for="opt in sourceOptions"
          :key="opt.value"
          class="px-2 py-1 text-xs rounded border transition-colors"
          :class="localType === opt.value
            ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
            : 'border-studio-border text-studio-text-muted hover:border-studio-accent/50'"
          @click="localType = opt.value"
        >{{ opt.label }}</button>
      </div>
    </div>

    <!-- File upload -->
    <div v-if="localType === 'file'" class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Audio file</label>
      <div v-if="hasAudio && audio.type === 'file'" class="flex items-center gap-2 text-xs">
        <span class="text-studio-accent">&#10003;</span>
        <span class="text-studio-text truncate">{{ audioFilename }}</span>
        <span class="text-studio-text-muted">{{ formattedDuration }}</span>
      </div>
      <label
        v-else
        class="flex items-center gap-2 px-3 py-2 border border-dashed border-studio-border rounded cursor-pointer hover:border-studio-accent/50 transition-colors"
      >
        <span class="text-xs text-studio-text-muted">Choose file (.mp3, .wav, .ogg)</span>
        <input type="file" accept="audio/*" class="hidden" @change="onFileChange" />
      </label>
    </div>

    <!-- TTS -->
    <div v-if="localType === 'gtts' || localType === 'coqui'" class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Text</label>
      <textarea
        v-model="localText"
        class="input text-xs resize-none w-full"
        rows="3"
        placeholder="Enter text to synthesize..."
      ></textarea>
      <div class="flex items-center gap-2 mt-2">
        <div class="flex-1">
          <label class="block text-xs text-studio-text-muted mb-1">Language</label>
          <select v-model="localLang" class="input text-xs w-full">
            <option v-for="l in langs" :key="l.code" :value="l.code">{{ l.label }}</option>
          </select>
        </div>
        <button
          class="btn btn-primary text-xs mt-4 px-3"
          :disabled="!localText.trim() || ttsLoading"
          @click="generateTTS"
        >
          <span v-if="ttsLoading">&#8987;</span>
          <span v-else>Generate</span>
        </button>
      </div>
      <div v-if="hasAudio && audio.status === 'ready'" class="mt-2 text-xs text-studio-accent">
        &#10003; Ready ({{ formattedDuration }})
      </div>
      <div v-if="hasAudio && audio.status === 'pending'" class="mt-2 text-xs text-studio-text-muted">
        &#8987; Generating...
      </div>
      <div v-if="hasAudio && audio.status === 'error'" class="mt-2 text-xs text-studio-error">
        &#9888; Failed. Try again.
      </div>
    </div>

    <!-- Sync mode (only shown when audio is attached) -->
    <div v-if="hasAudio" class="mb-3">
      <label class="block text-xs text-studio-text-muted mb-1">Sync</label>
      <div class="flex gap-2">
        <button
          v-for="opt in syncOptions"
          :key="opt.value"
          class="px-2 py-1 text-xs rounded border transition-colors"
          :class="localSyncMode === opt.value
            ? 'border-studio-accent bg-studio-accent/10 text-studio-accent'
            : 'border-studio-border text-studio-text-muted hover:border-studio-accent/50'"
          @click="localSyncMode = opt.value; onSyncModeChange()"
        >{{ opt.label }}</button>
      </div>
      <div v-if="localSyncMode === 'manual'" class="mt-2">
        <label class="block text-xs text-studio-text-muted mb-1">Offset (s)</label>
        <input
          type="number"
          v-model.number="localOffset"
          min="0"
          step="0.1"
          class="input text-xs w-24"
          @change="onOffsetChange"
        />
      </div>
    </div>

    <!-- Remove button -->
    <div v-if="hasAudio" class="mt-2">
      <button
        class="text-xs text-studio-error hover:underline"
        @click="removeAudio"
      >Remove audio</button>
    </div>
  </div>
</template>

<script>
import { actions } from '../../store/project.js';
import api, { connectAudioWebSocket } from '../../api.js';

export default {
  name: 'AudioPanel',

  props: {
    clip: { type: Object, required: true }
  },

  data() {
    return {
      localType: this.clip.audio?.type || 'file',
      localText: this.clip.audio?.text || '',
      localLang: this.clip.audio?.lang || 'tr',
      localSyncMode: this.clip.audio?.syncMode || 'auto',
      localOffset: this.clip.audio?.offset || 0,
      ttsLoading: false,
      sourceOptions: [
        { value: 'file', label: 'File' },
        { value: 'gtts', label: 'gTTS' },
        { value: 'coqui', label: 'Coqui' },
      ],
      syncOptions: [
        { value: 'auto', label: 'Auto' },
        { value: 'manual', label: 'Manual' },
      ],
      langs: [
        { code: 'tr', label: 'Turkish' },
        { code: 'en', label: 'English' },
        { code: 'de', label: 'German' },
        { code: 'fr', label: 'French' },
        { code: 'es', label: 'Spanish' },
        { code: 'ja', label: 'Japanese' },
      ],
    };
  },

  computed: {
    audio() { return this.clip.audio; },
    hasAudio() { return !!this.clip.audio; },
    audioFilename() {
      if (!this.audio?.src) return '';
      return this.audio.src.split('/').pop();
    },
    formattedDuration() {
      if (this.audio?.duration == null) return '';
      return `${parseFloat(this.audio.duration).toFixed(1)}s`;
    }
  },

  methods: {
    async onFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const result = await api.audio.upload(file, this.clip.id);
        actions.setClipAudio(this.clip.id, {
          type: 'file',
          src: result.src,
          duration: result.duration,
          syncMode: this.localSyncMode,
          offset: this.localOffset,
          status: 'ready'
        });
      } catch (err) {
        console.error('[AudioPanel] Upload failed:', err);
      }
    },

    async generateTTS() {
      if (!this.localText.trim() || this.ttsLoading) return;
      this.ttsLoading = true;
      try {
        actions.setClipAudio(this.clip.id, {
          type: this.localType,
          text: this.localText,
          lang: this.localLang,
          syncMode: this.localSyncMode,
          offset: this.localOffset,
          status: 'pending'
        });

        const { jobId } = await api.audio.tts(
          this.clip.id, this.localType, this.localText, this.localLang
        );

        connectAudioWebSocket(jobId, (data) => {
          if (data.event === 'audio_ready') {
            actions.setClipAudio(this.clip.id, {
              type: this.localType,
              text: this.localText,
              lang: this.localLang,
              syncMode: this.localSyncMode,
              offset: this.localOffset,
              src: data.src,
              duration: data.duration,
              status: 'ready'
            });
          } else {
            actions.setClipAudio(this.clip.id, {
              ...(this.clip.audio || {}),
              status: 'error'
            });
          }
          this.ttsLoading = false;
        });
      } catch (err) {
        actions.setClipAudio(this.clip.id, { ...(this.clip.audio || {}), status: 'error' });
        this.ttsLoading = false;
      }
    },

    onSyncModeChange() {
      if (!this.hasAudio) return;
      actions.setClipAudio(this.clip.id, { ...this.clip.audio, syncMode: this.localSyncMode });
    },

    onOffsetChange() {
      if (!this.hasAudio) return;
      actions.setClipAudio(this.clip.id, { ...this.clip.audio, offset: this.localOffset });
    },

    removeAudio() {
      actions.removeClipAudio(this.clip.id);
      this.localType = 'file';
      this.localText = '';
      this.ttsLoading = false;
    }
  }
};
</script>
