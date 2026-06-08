<template>
  <div
    id="app"
    class="h-screen flex flex-col overflow-hidden"
    style="z-index: var(--z-stage); background: var(--studio-bg); color: var(--studio-text)"
  >
    <!-- Top Bar -->
    <Topbar />

    <!-- Main: Sidebar | Canvas/Code | Properties -->
    <div class="flex-1 flex overflow-hidden min-h-0" role="main">
      <AssetSidebar />
      <div class="flex-1 min-w-0 flex flex-col relative" style="background: var(--studio-bg)">
        <!-- Stage / Code toggle pill (hidden in code-only mode) -->
        <div
          v-if="!isCodeMode"
          class="absolute top-2.5 right-2.5 z-20 flex items-center backdrop-blur-sm rounded-lg p-0.5"
          style="background: var(--studio-surface3); border: 1px solid var(--studio-border)"
        >
          <button
            class="stage-tab-btn"
            :class="{ active: stageViewMode === 'canvas' }"
            @click="stageViewMode = 'canvas'"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            Canvas
          </button>
          <button
            class="stage-tab-btn"
            :class="{ active: stageViewMode === 'code' }"
            @click="switchToCode"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </button>
        </div>
        <!-- Code-only mode badge -->
        <div
          v-if="isCodeMode"
          class="absolute top-2.5 right-2.5 z-20 flex items-center backdrop-blur-sm rounded-lg px-3 py-1"
          style="background: var(--studio-surface3); border: 1px solid var(--studio-border)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            style="margin-right: 5px"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span class="text-[10px] font-semibold" style="color: var(--studio-accent)"
            >Code Only</span
          >
        </div>

        <!-- Canvas view (hidden in code-only mode) -->
        <ErrorBoundary label="canvas"
          ><StageCanvas v-show="stageViewMode === 'canvas' && !isCodeMode"
        /></ErrorBoundary>

        <!-- Code view -->
        <div
          v-show="stageViewMode === 'code' || isCodeMode"
          class="flex-1 flex flex-col overflow-hidden rounded-xl m-0"
          style="background: var(--studio-surface)"
        >
          <!-- Code toolbar -->
          <div
            class="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
            style="border-bottom: 1px solid var(--studio-divider)"
          >
            <span
              class="text-[11px] font-semibold uppercase tracking-wider"
              style="color: var(--studio-text-muted)"
              >Manim Scene</span
            >
            <span
              v-if="codeEdited && !isCodeMode"
              class="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style="background: rgb(var(--c-warning) / 0.2); color: var(--studio-warning)"
              >edited</span
            >
            <div class="flex-1"></div>
            <button
              v-if="codeEdited && !isCodeMode"
              class="code-stage-btn apply-btn"
              title="Parse this code and update the canvas"
              @click="applyCodeToCanvas"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Apply to Canvas
            </button>
            <button
              v-if="codeEdited && !isCodeMode"
              class="code-stage-btn"
              title="Discard edits and regenerate"
              @click="resetCode"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              Reset
            </button>
            <button
              class="code-stage-btn"
              :title="stageCopied ? 'Copied!' : 'Copy to clipboard'"
              @click="copyStageCode"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {{ stageCopied ? 'Copied!' : 'Copy' }}
            </button>
            <button class="code-stage-btn" @click="downloadStageCode">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              .py
            </button>
          </div>
          <!-- Editable code area with Python syntax highlighting (mirror overlay) -->
          <div class="code-stage-body flex-1 min-h-0 relative">
            <pre
              ref="highlightPre"
              class="code-highlight-mirror"
              aria-hidden="true"
              v-html="highlightedCode"
            ></pre>
            <textarea
              ref="codeArea"
              class="code-stage-textarea"
              :value="stageCode"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              aria-label="Manim Python scene code"
              @input="onCodeInput"
              @scroll="syncCodeScroll"
            ></textarea>
          </div>
          <!-- Footer -->
          <div
            class="flex items-center justify-between px-4 py-2 flex-shrink-0"
            style="border-top: 1px solid var(--studio-divider)"
          >
            <span
              v-if="parseMessage && !isCodeMode"
              class="text-[10px]"
              :style="
                parseMessageOk ? 'color: var(--studio-success)' : 'color: var(--studio-danger)'
              "
              >{{ parseMessage }}</span
            >
            <span
              v-else-if="isCodeMode"
              class="text-[10px]"
              style="color: var(--studio-text-muted); opacity: 0.5"
              >Write any valid Manim code and render directly</span
            >
            <span v-else class="text-[10px]" style="color: var(--studio-text-muted); opacity: 0.5"
              >Edit the code, then "Apply to Canvas" to update objects</span
            >
            <button
              v-if="!isCodeMode"
              class="text-[10px] transition-colors"
              style="color: var(--studio-accent)"
              @click="stageViewMode = 'canvas'"
            >
              ← Back to Canvas
            </button>
          </div>
        </div>
      </div>
      <ErrorBoundary v-if="!isCodeMode" label="properties panel"><PropertiesPanel /></ErrorBoundary>
    </div>

    <!-- Bottom Timeline (hidden in code-only mode) -->
    <ErrorBoundary v-if="!isCodeMode" label="timeline"><Timeline /></ErrorBoundary>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Export Dialog (client-side .py download) -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <transition name="fade">
      <div
        v-if="showExport"
        class="fixed inset-0 bg-black/60 flex items-center justify-center"
        style="z-index: var(--z-modal)"
        @click.self="closeExport"
      >
        <div
          class="rounded-xl w-[700px] max-h-[80vh] flex flex-col shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          style="background: var(--studio-surface); border: 1px solid var(--studio-border)"
        >
          <div
            class="px-5 py-4 flex items-center justify-between"
            style="border-bottom: 1px solid var(--studio-border)"
          >
            <div>
              <h2 id="export-dialog-title" class="text-base font-semibold">Export to Manim</h2>
              <p class="text-[11px] mt-0.5" style="color: var(--studio-text-muted)">
                Download a self-contained scene.py
              </p>
            </div>
            <button
              class="text-lg"
              style="color: var(--studio-text-muted)"
              aria-label="Close"
              @click="closeExport"
            >
              &times;
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <div class="mb-3 flex items-center gap-2">
              <button class="btn btn-primary text-sm flex items-center gap-2" @click="downloadPy">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download scene.py
              </button>
              <button class="btn btn-secondary text-sm flex items-center gap-2" @click="copyCode">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                {{ copied ? 'Copied!' : 'Copy Code' }}
              </button>
            </div>
            <div
              class="rounded-lg p-4"
              style="background: var(--studio-bg); border: 1px solid var(--studio-border)"
            >
              <p
                class="text-[10px] mb-2 font-medium uppercase tracking-wider"
                style="color: var(--studio-text-muted)"
              >
                Run this command:
              </p>
              <code
                class="text-sm font-mono block mb-3 select-all"
                style="color: var(--studio-accent)"
                >manim -qh scene.py MainScene</code
              >
              <p
                class="text-[10px] mb-2 font-medium uppercase tracking-wider"
                style="color: var(--studio-text-muted)"
              >
                Generated Python:
              </p>
              <pre
                class="text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed"
                style="color: var(--studio-text-muted)"
                >{{ exportCode }}</pre
              >
            </div>
            <div
              v-if="hasImages"
              class="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
            >
              <p class="text-xs text-amber-400">
                <strong>Note:</strong> Your project uses images. Place the image files in the same
                directory as <code>scene.py</code> before rendering.
              </p>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Server Render Dialog -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <transition name="fade">
      <div
        v-if="showRender"
        class="fixed inset-0 bg-black/60 flex items-center justify-center"
        style="z-index: var(--z-modal)"
        @click.self="closeRender"
      >
        <div
          class="rounded-xl w-[540px] max-h-[85vh] flex flex-col shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="render-dialog-title"
          style="background: var(--studio-surface); border: 1px solid var(--studio-border)"
        >
          <div
            class="px-5 py-4 flex items-center justify-between"
            style="border-bottom: 1px solid var(--studio-border)"
          >
            <div>
              <h2 id="render-dialog-title" class="text-base font-semibold">Render with Manim</h2>
              <p class="text-[11px] mt-0.5" style="color: var(--studio-text-muted)">
                High-quality render via Docker
              </p>
            </div>
            <button
              class="text-lg"
              style="color: var(--studio-text-muted)"
              aria-label="Close"
              @click="closeRender"
            >
              &times;
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <!-- Quality selector (before render starts) -->
            <div v-if="!renderStatus">
              <label
                class="block text-xs font-medium text-studio-text-muted mb-1.5 uppercase tracking-wider"
                >Quality</label
              >
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="q in qualities"
                  :key="q.value"
                  class="quality-btn"
                  :class="{ active: selectedQuality === q.value }"
                  @click="selectedQuality = q.value"
                >
                  <span class="text-xs font-semibold">{{ q.label }}</span>
                  <span class="text-[9px] text-studio-text-muted">{{ q.desc }}</span>
                </button>
              </div>
              <!-- Text size disclaimer -->
              <div
                v-if="hasTextElements"
                class="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg"
              >
                <p class="text-[10px] text-amber-400 leading-relaxed">
                  <strong>Note:</strong> Text size on the canvas preview may differ from the final
                  rendered output.
                </p>
              </div>
              <button
                :disabled="hasPendingAudio"
                :title="hasPendingAudio ? 'Waiting for audio generation...' : ''"
                class="mt-4 w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                :class="{ 'opacity-50 cursor-not-allowed': hasPendingAudio }"
                @click="startRender"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {{ hasPendingAudio ? 'Waiting for audio...' : 'Start Render' }}
              </button>
            </div>

            <!-- Progress -->
            <div v-if="renderStatus && renderStatus !== 'completed'" class="text-center py-4">
              <div class="inline-flex items-center gap-3 mb-4">
                <div class="render-spinner"></div>
                <span class="text-sm font-medium">{{ renderStatusText }}</span>
              </div>
              <div class="w-full bg-studio-bg rounded-full h-2 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="renderStatus === 'failed' ? 'bg-red-500' : 'bg-studio-accent'"
                  :style="{ width: renderProgress + '%' }"
                ></div>
              </div>
              <div v-if="renderLog" class="mt-3">
                <div class="flex justify-end mb-1">
                  <button
                    class="text-[10px] text-studio-accent hover:opacity-80"
                    @click="copyRenderLog"
                  >
                    {{ renderCopied ? '✓ Copied' : '⧉ Copy log' }}
                  </button>
                </div>
                <p
                  class="text-[10px] text-studio-text-muted text-left font-mono bg-studio-bg rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap select-text"
                  style="user-select: text"
                >
                  {{ renderLog }}
                </p>
              </div>
            </div>

            <!-- Error -->
            <div
              v-if="renderStatus === 'failed'"
              class="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-1">
                <p class="text-xs text-red-400 font-medium">Render Failed</p>
                <button class="text-[10px] text-red-300 hover:text-red-100" @click="copyRenderLog">
                  {{ renderCopied ? '✓ Copied' : '⧉ Copy error' }}
                </button>
              </div>
              <p
                class="text-[11px] text-red-300 whitespace-pre-wrap select-text max-h-40 overflow-y-auto"
                style="user-select: text"
              >
                {{ renderError }}
              </p>
              <button
                class="mt-3 px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                @click="retryRender"
              >
                Retry
              </button>
            </div>

            <!-- Success: video preview -->
            <div v-if="renderStatus === 'completed'">
              <div
                class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-3 flex items-center gap-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="text-emerald-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span class="text-sm text-emerald-300 font-medium">Render complete!</span>
              </div>
              <video
                v-if="renderVideoUrl"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                controls
                class="w-full rounded-lg bg-black"
                autoplay
              ></video>
              <div class="flex gap-2 mt-3">
                <a
                  v-if="renderVideoUrl"
                  :href="renderVideoUrl"
                  download="render.mp4"
                  class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-studio-accent hover:bg-studio-accent-hover text-white text-sm font-medium transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download MP4
                </a>
                <button
                  class="px-4 py-2.5 rounded-lg bg-studio-border hover:bg-studio-border/80 text-studio-text text-sm font-medium transition-colors"
                  @click="resetRender"
                >
                  Render Again
                </button>
              </div>
              <!-- Render History -->
              <div v-if="renderHistory.length > 0" class="mt-4">
                <p
                  class="text-xs font-medium uppercase tracking-wider mb-2"
                  style="color: var(--studio-text-muted)"
                >
                  Render Geçmişi
                </p>
                <div class="space-y-1.5">
                  <div
                    v-for="r in renderHistory"
                    :key="r.name"
                    class="flex items-center justify-between px-3 py-2 rounded-lg"
                    style="background: var(--studio-bg)"
                  >
                    <span class="text-[11px] font-mono" style="color: var(--studio-text-muted)">{{
                      formatRenderDate(r.name)
                    }}</span>
                    <a
                      :href="r.url"
                      download
                      class="text-[11px] px-2 py-1 rounded"
                      style="color: var(--studio-accent); background: var(--studio-accent-subtle)"
                      >İndir</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- Server Project Browser -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <transition name="fade">
      <div
        v-if="showProjectBrowser"
        class="fixed inset-0 bg-black/60 flex items-center justify-center"
        style="z-index: var(--z-modal)"
        @click.self="closeProjectBrowser"
      >
        <div
          class="rounded-xl w-[500px] max-h-[70vh] flex flex-col shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-browser-title"
          style="background: var(--studio-surface); border: 1px solid var(--studio-border)"
        >
          <div
            class="px-5 py-4 flex items-center justify-between"
            style="border-bottom: 1px solid var(--studio-border)"
          >
            <div>
              <h2 id="project-browser-title" class="text-base font-semibold">Server Projects</h2>
              <p class="text-[11px] mt-0.5" style="color: var(--studio-text-muted)">
                Load a project from the Docker server
              </p>
            </div>
            <button
              class="text-lg"
              style="color: var(--studio-text-muted)"
              aria-label="Close"
              @click="closeProjectBrowser"
            >
              &times;
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <div
              v-if="serverLoading"
              class="text-center py-8 text-studio-text-muted text-sm"
              role="status"
            >
              Loading project…
            </div>
            <div
              v-else-if="serverProjects.length === 0"
              class="text-center py-8 text-studio-text-muted"
            >
              <p class="text-sm mb-1">No projects on server</p>
              <p class="text-[11px]">Render a project first to create it on the server.</p>
            </div>
            <div v-else class="space-y-1.5">
              <div
                v-for="p in serverProjects"
                :key="p.id"
                class="w-full px-4 py-3 rounded-lg hover:bg-studio-border/60 transition-colors flex items-center justify-between group"
              >
                <div class="flex-1 cursor-pointer min-w-0" @click="openServerProject(p.id)">
                  <span class="text-sm font-medium text-studio-text">{{ p.name }}</span>
                  <span
                    v-if="p.editorMode === 'code'"
                    class="text-[9px] px-1.5 py-0.5 rounded font-semibold ml-2"
                    style="background: var(--studio-accent-subtle); color: var(--studio-accent)"
                    >CODE</span
                  >
                  <span class="text-[10px] text-studio-text-muted ml-2"
                    >{{ p.objectsCount || 0 }} objects</span
                  >
                  <span
                    class="text-[9px] text-studio-text-muted font-mono ml-2 hidden group-hover:inline"
                    >{{ p.id }}</span
                  >
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    class="p-1.5 rounded-md text-studio-text-muted opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                    title="Delete project"
                    aria-label="Delete project"
                    @click.stop="deleteServerProject(p.id, p.name)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path
                        d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                      />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                  <button
                    class="p-1.5 rounded-md text-studio-text-muted hover:text-studio-accent transition-colors"
                    title="Open project"
                    aria-label="Open project"
                    @click="openServerProject(p.id)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Error Toast -->
    <transition name="slide-up">
      <div
        v-if="error"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3"
        style="
          z-index: var(--z-overlay);
          background: var(--studio-surface);
          border: 1px solid rgb(var(--c-danger) / 0.3);
          color: var(--studio-text);
        "
      >
        <span style="color: var(--studio-danger)">!</span>
        <span class="text-sm">{{ error }}</span>
        <button
          class="ml-2"
          style="color: var(--studio-text-muted)"
          aria-label="Dismiss notification"
          @click="clearError"
        >
          &times;
        </button>
      </div>
    </transition>

    <!-- Success / info Toast -->
    <transition name="slide-up">
      <div
        v-if="notice"
        class="fixed bottom-16 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3"
        style="
          z-index: var(--z-overlay);
          background: var(--studio-surface);
          border: 1px solid rgb(var(--c-success) / 0.4);
          color: var(--studio-text);
        "
        role="status"
      >
        <span style="color: var(--studio-success)">&#10003;</span>
        <span class="text-sm">{{ notice }}</span>
        <button
          class="ml-2"
          style="color: var(--studio-text-muted)"
          aria-label="Dismiss notification"
          @click="clearNotice"
        >
          &times;
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
hljs.registerLanguage('python', python);
import * as api from './api.js';
import { useProjectStore } from './store/project.js';
import { getPlaybackEngine } from './engine/playback.js';
import { generateManimScript, downloadManimScript, parseManimScript } from './export/manim.js';
import Topbar from './components/topbar/Topbar.vue';
import AssetSidebar from './components/sidebar/AssetSidebar.vue';
import StageCanvas from './components/stage/StageCanvas.vue';
import PropertiesPanel from './components/inspector/PropertiesPanel.vue';
import Timeline from './components/timeline/Timeline.vue';
import ErrorBoundary from './components/ErrorBoundary.vue';

const store = useProjectStore();

// ── Reactive state ──
const copied = ref(false);
const selectedQuality = ref('high');
const renderHistory = ref<Array<{ name: string; url: string }>>([]);
const stageViewMode = ref('canvas');
const stageCode = ref('# Add objects to see generated Manim code');
const stageCopied = ref(false);
const codeEdited = ref(false);
const parseMessage = ref('');
const parseMessageOk = ref(false);

// Static data (never mutated, no reactivity needed)
const qualities = [
  { value: 'low', label: 'Low', desc: '480p 15fps (fastest)' },
  { value: 'medium', label: 'Medium', desc: '720p 30fps' },
  { value: 'high', label: 'High', desc: '1080p 60fps (recommended)' },
  { value: 'production', label: 'Production', desc: '1440p 60fps (2K)' },
  { value: '4k', label: '4K', desc: '2160p 60fps (slowest)' },
];

// Non-reactive timer IDs
let _stageCodeTimer: ReturnType<typeof setTimeout> | undefined;
let _parseMessageTimer: ReturnType<typeof setTimeout> | undefined;

// Template refs
const highlightPre = ref<HTMLPreElement | null>(null);
const codeArea = ref<HTMLTextAreaElement | null>(null);

// ── Computed ──
const projectId = computed(() => store.project.id);
const isCodeMode = computed(() => store.project.editorMode === 'code');
const error = computed(() => store.error);
const notice = computed(() => store.notice);
const serverLoading = computed(() => store.loading);
const showExport = computed(() => store.showExportDialog);
const exportCode = computed(() => store.exportCode);
const hasImages = computed(() =>
  store.project.objects.some((o) => o.type === 'image' || o.type === 'svg_asset')
);
const hasTextElements = computed(() =>
  store.project.objects.some((o) => o.type === 'text' || o.type === 'latex')
);
const showRender = computed(() => store.showRenderDialog);
const hasPendingAudio = computed(() => store.hasPendingAudio);
const renderStatus = computed(() => store.renderStatus);
const renderError = computed(() => store.renderError);
const renderVideoUrl = computed(() => store.renderVideoUrl);
const renderLog = computed(() => store.renderLog);
interface ServerProject {
  id: string;
  name: string;
  editorMode?: string;
  objectsCount?: number;
}
const showProjectBrowser = computed(() => store.showProjectBrowser);
const serverProjects = computed(() => store.serverProjects as ServerProject[]);

const renderStatusText = computed(() => {
  const map: Record<string, string> = {
    uploading: 'Uploading assets to server...',
    saving: 'Saving project...',
    queued: 'In render queue, waiting for worker...',
    running: 'Manim is rendering (this can take 30s-2min)...',
    failed: 'Render failed',
  };
  return (store.renderStatus && map[store.renderStatus]) || 'Processing...';
});

const renderProgress = computed(() => {
  const map: Record<string, number> = {
    uploading: 15,
    saving: 30,
    queued: 45,
    running: 70,
    completed: 100,
    failed: 100,
  };
  return (store.renderStatus && map[store.renderStatus]) || 0;
});

const highlightedCode = computed(() => {
  try {
    return hljs.highlight(stageCode.value, { language: 'python' }).value;
  } catch (_) {
    return escapeHtml(stageCode.value);
  }
});

// ── Watchers ──
watch(
  () => store.project.keyframeDefaults,
  (defaults) => {
    if (defaults?.mode != null) getPlaybackEngine().setKeyframeDefaults({ mode: defaults.mode });
  },
  { immediate: true, deep: true }
);

watch(
  () => store.project.camera3d,
  (cam) => {
    getPlaybackEngine().setCamera3dBase(cam);
  },
  { deep: true, immediate: true }
);

watch(renderStatus, (status) => {
  if (status === 'completed' && projectId.value) {
    loadRenderHistory();
  }
});

watch(
  () => store.project.objects,
  () => {
    if (!isCodeMode.value && stageViewMode.value === 'code' && !codeEdited.value)
      _debouncedUpdateCode();
  },
  { deep: true }
);

watch(
  () => store.project.tracks,
  () => {
    if (!isCodeMode.value && stageViewMode.value === 'code' && !codeEdited.value)
      _debouncedUpdateCode();
  },
  { deep: true }
);

watch(
  () => store.project.editorMode,
  (mode) => {
    if (mode === 'code') {
      stageViewMode.value = 'code';
      stageCode.value = store.project.codeSource || '';
      codeEdited.value = false;
    }
  },
  { immediate: true }
);

// ── Lifecycle ──
onMounted(() => {
  const engine = getPlaybackEngine();
  engine.onTimeUpdate((t) => store.setPlaybackTime(t));
  engine.onFrame((state) => store.setFrameState(state));
  window.addEventListener('keydown', handleKeydown);

  // Check API availability on startup
  store.checkApi();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  getPlaybackEngine().destroy();
  store._stopPollRender();
});

// ── Methods ──
function handleKeydown(e: KeyboardEvent) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

  if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
    store.setActiveTool('select');
    e.preventDefault();
  }
  if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) {
    store.setActiveTool('hand');
    e.preventDefault();
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) {
    if (store.selectedClipId) {
      // Check if it's a camera clip first (camera clips live in cameraTrack, not regular tracks)
      const isCameraClip = store.project.cameraTrack?.some((c) => c.id === store.selectedClipId);
      if (isCameraClip) {
        store.deleteCameraClip(store.selectedClipId);
      } else {
        store.deleteClip(store.selectedClipId);
      }
      store.selectedClipId = null;
      e.preventDefault();
    } else if (store.selectedObjectIds.length > 0) {
      [...store.selectedObjectIds].forEach((id) => store.deleteObject(id));
      e.preventDefault();
    }
  }

  if (e.key === 'Escape') {
    store.deselectAll();
    closeExport();
    closeRender();
    closeProjectBrowser();
    e.preventDefault();
  }
  if (e.key === ' ') {
    togglePlayback();
    e.preventDefault();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    store.saveToFile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
    e.preventDefault();
    if (store.selectedObjectIds.length >= 2) store.groupObjects([...store.selectedObjectIds]);
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    store.undo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
    e.preventDefault();
    store.redo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    store.redo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    store.copySelection();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    store.pasteSelection();
  }
}

function togglePlayback() {
  const engine = getPlaybackEngine();
  if (store.playbackPlaying) {
    engine.pause();
    store.setPlaybackPlaying(false);
  } else {
    engine.play(
      store.project.tracks as never,
      store.project.objects as never,
      store.computedDuration,
      (store.project.cameraTrack || []) as never
    );
    store.setPlaybackPlaying(true);
  }
}

// ── Export dialog ──
function closeExport() {
  store.showExportDialog = false;
}
function downloadPy() {
  if (isCodeMode.value) {
    const blob = new Blob([store.exportCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.project.name || 'scene'}.py`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    downloadManimScript(store.project);
  }
}
function copyCode() {
  navigator.clipboard.writeText(store.exportCode).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
}

// ── Render dialog ──
function closeRender() {
  // Allow closing at any time; if still rendering, polling continues in bg
  store.showRenderDialog = false;
  // Reset status ONLY if completed or failed so user can re-open cleanly
  if (store.renderStatus === 'completed' || store.renderStatus === 'failed') {
    // keep it so user can reopen and see the video / error
  }
}

function startRender() {
  if (store.hasPendingAudio) return;
  store.renderOnServer(selectedQuality.value);
}

function retryRender() {
  store.renderStatus = null;
  store.renderError = null;
}

function resetRender() {
  store.renderStatus = null;
  store.renderError = null;
  store.renderVideoUrl = null;
  store.renderLog = '';
}

const renderCopied = ref(false);
function copyRenderLog() {
  const text = [store.renderError, store.renderLog].filter(Boolean).join('\n\n');
  const done = () => {
    renderCopied.value = true;
    setTimeout(() => {
      renderCopied.value = false;
    }, 1500);
  };
  navigator.clipboard
    ?.writeText(text)
    .then(done)
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      ta.remove();
      done();
    });
}

// ── Project browser ──
function closeProjectBrowser() {
  store.showProjectBrowser = false;
}
async function openServerProject(id: string) {
  if (store.isDirty && !confirm('Discard unsaved changes?')) return;
  const ok = await store.loadFromServer(id);
  if (ok) store.showProjectBrowser = false;
}

async function deleteServerProject(id: string, name: string) {
  if (
    !confirm(
      `Delete "${name}" from the server?\n\nThis will remove the project, its assets, and all renders. This cannot be undone.`
    )
  )
    return;
  try {
    await store.deleteServerProject(id);
  } catch (err) {
    store.setError('Delete failed: ' + (err instanceof Error ? err.message : String(err)));
  }
}

// ── Stage code view ──
function switchToCode() {
  stageViewMode.value = 'code';
  codeEdited.value = false;
  parseMessage.value = '';
  if (isCodeMode.value) {
    stageCode.value = store.project.codeSource || '';
  } else {
    updateStageCode();
  }
  nextTick(() => syncCodeScroll());
}
function updateStageCode() {
  try {
    stageCode.value = generateManimScript(store.project);
    codeEdited.value = false;
  } catch (err) {
    stageCode.value =
      '# Error generating code: ' + (err instanceof Error ? err.message : String(err));
  }
}
function _debouncedUpdateCode() {
  clearTimeout(_stageCodeTimer);
  _stageCodeTimer = setTimeout(() => updateStageCode(), 300);
}
function syncCodeScroll() {
  const ta = codeArea.value;
  const pre = highlightPre.value;
  if (ta && pre) {
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  }
}
function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function onCodeInput(e: Event) {
  stageCode.value = (e.target as HTMLTextAreaElement).value;
  if (isCodeMode.value) {
    store.project.codeSource = stageCode.value;
    store.isDirty = true;
  } else {
    codeEdited.value = true;
  }
}
function resetCode() {
  codeEdited.value = false;
  parseMessage.value = '';
  updateStageCode();
}
function applyCodeToCanvas() {
  try {
    const result = parseManimScript(
      stageCode.value,
      store.project.stage.width,
      store.project.stage.height
    );

    if (result.objects.length === 0) {
      parseMessage.value = 'No objects found in code. Check your syntax.';
      parseMessageOk.value = false;
      _clearParseMsg();
      return;
    }

    // Apply parsed data to the project
    store.project.stage.backgroundColor = result.stage.backgroundColor;
    store.project.objects = result.objects;
    store.project.tracks = result.tracks;
    if (result.cameraType) store.setCameraType(result.cameraType);
    if (Array.isArray(result.cameraTrack) && result.cameraTrack.length > 0) {
      store.project.cameraTrack = result.cameraTrack;
    }
    store.deselectAll();

    codeEdited.value = false;
    parseMessage.value = `Applied: ${result.objects.length} objects, ${result.tracks.reduce((s, t) => s + t.clips.length, 0)} animations`;
    parseMessageOk.value = true;
    _clearParseMsg();

    // Switch back to canvas to see the result
    setTimeout(() => {
      stageViewMode.value = 'canvas';
    }, 800);
  } catch (err) {
    parseMessage.value = 'Parse error: ' + (err instanceof Error ? err.message : String(err));
    parseMessageOk.value = false;
    _clearParseMsg();
  }
}
function _clearParseMsg() {
  clearTimeout(_parseMessageTimer);
  _parseMessageTimer = setTimeout(() => {
    parseMessage.value = '';
  }, 4000);
}
function copyStageCode() {
  navigator.clipboard.writeText(stageCode.value).then(() => {
    stageCopied.value = true;
    setTimeout(() => {
      stageCopied.value = false;
    }, 2000);
  });
}
function downloadStageCode() {
  if (isCodeMode.value) {
    const blob = new Blob([stageCode.value], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.project.name || 'scene'}.py`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    downloadManimScript(store.project);
  }
}

// ── Render history ──
async function loadRenderHistory() {
  if (!projectId.value) return;
  try {
    const info = (await api.renders.getInfo(projectId.value)) as {
      history?: Array<{ name: string; url: string }>;
    };
    renderHistory.value = info.history || [];
  } catch {
    /* ignore */
  }
}

function formatRenderDate(filename: string) {
  const m = filename.match(/render_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
  if (!m) return filename;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

// ── Error ──
function clearError() {
  store.clearError();
}
function clearNotice() {
  store.clearNotice();
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter,
.slide-up-leave-to {
  transform: translateY(20px) translateX(-50%);
  opacity: 0;
}

.quality-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--studio-border);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
}
.quality-btn:hover {
  border-color: var(--studio-accent);
}
.quality-btn.active {
  border-color: var(--studio-accent);
  background: var(--studio-accent-subtle);
  color: var(--studio-accent);
}

.render-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--studio-border);
  border-top-color: var(--studio-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.stage-tab-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--studio-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  background: transparent;
}
.stage-tab-btn:hover {
  color: var(--studio-text);
}
.stage-tab-btn.active {
  background: var(--studio-accent-subtle);
  color: var(--studio-accent);
}

.code-stage-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  color: var(--studio-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--studio-border);
  background: transparent;
}
.code-stage-btn:hover {
  color: var(--studio-text);
  background: var(--studio-border);
}
.code-stage-btn.apply-btn {
  background: var(--studio-success-subtle);
  border-color: var(--studio-success);
  color: var(--studio-success);
}
.code-stage-btn.apply-btn:hover {
  background: rgb(var(--c-success) / 0.2);
}

.code-stage-body {
  overflow: hidden;
}
.code-highlight-mirror,
.code-stage-textarea {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: 12px;
  line-height: 1.625;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  tab-size: 4;
  -moz-tab-size: 4;
  overflow: auto;
  white-space: pre;
  border: none;
  outline: none;
  resize: none;
}
.code-highlight-mirror {
  pointer-events: none;
  background: var(--studio-surface2);
  color: var(--studio-text);
}
.code-highlight-mirror code {
  padding: 0;
  background: transparent;
  font: inherit;
}
.code-stage-textarea {
  background: transparent;
  color: transparent;
  caret-color: var(--studio-text);
}
.code-stage-textarea::placeholder {
  color: var(--studio-text-muted);
}
.code-stage-textarea::selection {
  background: rgb(var(--c-accent) / 0.35);
}

/* Python syntax highlighting (theme-aware) */
.code-highlight-mirror .hljs-keyword,
.code-highlight-mirror .hljs-selector-tag,
.code-highlight-mirror .hljs-built_in {
  color: var(--studio-code-keyword);
}
.code-highlight-mirror .hljs-string {
  color: var(--studio-code-string);
}
.code-highlight-mirror .hljs-number {
  color: var(--studio-code-number);
}
.code-highlight-mirror .hljs-comment {
  color: var(--studio-code-comment);
  font-style: italic;
}
.code-highlight-mirror .hljs-title.class_,
.code-highlight-mirror .hljs-title.function_ {
  color: var(--studio-code-function);
}
.code-highlight-mirror .hljs-params,
.code-highlight-mirror .hljs-attr {
  color: var(--studio-text);
}
.code-highlight-mirror .hljs-meta,
.code-highlight-mirror .hljs-doctag {
  color: var(--studio-code-comment);
}
.code-highlight-mirror .hljs-literal,
.code-highlight-mirror .hljs-name {
  color: var(--studio-text);
}
</style>
