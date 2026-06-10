# Wave 1 Track A — Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the marketing site in `website/` as a finished English landing page with a 5-video demo gallery and a copy-pasteable quickstart, commit the `demo-videos/` source assets, and add a Showcase section to `README.md`.
**Branch:** feat/wave1-showcase (worktree+branch created by the orchestrator)
**Architecture:** `website/` is a standalone Vite 5 + Vue 3 + Tailwind 3.4 single-page site (outside the npm workspaces, deployed via root `netlify.toml`, base `website`, publish `dist`). All work is additive on the existing component structure: one new `GallerySection.vue`, surgical edits to 6 existing components, static assets copied into `website/public/demo/`, plus a README section. Nothing outside `website/`, `demo-videos/`, and `README.md` is touched.
**Tech Stack:** Vue 3.4 (`<script setup>`), Vite 5, Tailwind CSS 3.4 (present but the design system is hand-rolled CSS custom properties in `App.vue`), plain `<video controls>` embeds, PowerShell for file ops, git.

---

## Reality check (read before executing — the spec's assumptions vs. what is actually on disk)

The Wave-1 spec calls `website/` an "unfinished Vite+Tailwind skeleton" and suggests a framework-free static page. **That is not what exists.** What exists (committed, working):

- A **polished, fully designed Vue 3 landing page**: `App.vue` (1209 lines — global design system: dark "blueprint" theme `--obsidian #030305`, `--blueprint #3B82F6`, `--acid #84cc16`, Space Grotesk + JetBrains Mono), plus 12 components: `NavBar`, `HeroSection`, `StatsBar`, `FeaturesGrid` (bento grid, `id="features"`, eyebrow `01`), `SplitSection` (`id="interface"`, eyebrow `02`), `WorkflowSection` (`id="workflow"`, eyebrow `03`), `MarqueeSection`, `CtaSection`, `FooterSection`, `ShaderBackground`, `CustomCursor`, and a `useReveal` IntersectionObserver composable. Already in English, already dark-themed, already responsive + accessible (skip link, focus rings, reduced-motion support).
- **Decision: keep the Vue site and finish it** (add what's missing) instead of demolishing it for a static page. Rationale: the page is production quality, `netlify.toml` already deploys it, and a teardown would be a large risky diff for zero user value. "Single page" is still true — it is one page.
- **What's actually missing / broken** (this plan's scope):
  1. No demo-video gallery (the core Track A deliverable).
  2. No copy-pasteable quickstart block (the CTA only *mentions* `docker compose up` in prose).
  3. All 9 GitHub links point to the **wrong repository** `https://github.com/BlommeJan/Manim-Motion` (a leftover); the real repo per `README.md` is `https://github.com/kadirhanpolat/Manim-Editor`.
  4. Feature copy is stale: "16+ primitive types" (the editor now has 40+ 2D types + 8 3D types) and no mention of keyframes, 3D scenes, TTS voiceover, or the 60 fps preview.
- **Gate safety:** `website/` is in `.prettierignore` (line `website`) and in `eslint.config.js` `ignores: ['website/**']`; `*.md` is also prettier-ignored. So the repo-root `npm run lint` / `npm run format:check` gates cannot be broken by this track — we still run them at the end as proof.
- `.gitignore` contains `dist/` and `node_modules/`, so `website/dist` and `website/node_modules` stay untracked automatically.
- The site hides the OS cursor globally (`cursor: none !important` + custom cursor). The gallery's `<video>` element must restore `cursor: auto` or native video controls (and fullscreen) get an invisible pointer — handled in Task 5's CSS.
- Demo assets: 10 files in `demo-videos/` (Turkish filenames, keep verbatim), 172.1 KB total — no LFS needed:
  `1-formul-tanitim.mp4` (14.3 KB), `1-formul-tanitim.png` (9.6 KB), `2-sekil-donusumu.mp4` (22.4 KB), `2-sekil-donusumu.png` (10.1 KB), `3-baslik-slaydi.mp4` (26.4 KB), `3-baslik-slaydi.png` (28.3 KB), `4-koordinat-sistemi.mp4` (17.7 KB), `4-koordinat-sistemi.png` (10.9 KB), `4b-koordinat-latex.mp4` (18.6 KB), `4b-koordinat-latex.png` (13.8 KB).

**Out of scope (do not do):** no new CI job; no changes to any file outside `website/`, `demo-videos/`, `README.md`; no removal of Vue/Tailwind; no edits to `netlify.toml`, `ShaderBackground.vue`, `CustomCursor.vue`, `MarqueeSection.vue`, `SplitSection.vue`, `WorkflowSection.vue`, `useReveal.js`.

**Testing note:** this track has no unit-test surface (static marketing site; `website/` is outside every test suite). Every task therefore ends with explicit VERIFICATION steps (exact command + expected output) instead of TDD steps. `npm run build` inside `website/` is the regression gate between tasks; Task 11 runs the repo-root lint/format gates as final proof of no regressions.

All commands below assume the current directory is the **worktree root** (the repo root of the `feat/wave1-showcase` worktree) and PowerShell as the shell. PowerShell 5.1 has no `&&` — chain with `;` exactly as written.

---

### Task 1: Worktree sanity + root dependency install

**Files:**
- None modified (environment preparation only)

- [ ] **Step 1: Confirm you are on the right branch in the worktree.**
  ```powershell
  git branch --show-current
  git status --porcelain
  ```
  Expected output: `feat/wave1-showcase` and (only at the very start) a single untracked entry `?? demo-videos/`. If the branch name differs, STOP and report — the orchestrator owns branch creation.

- [ ] **Step 2: Install root workspace dependencies** (a fresh worktree has no `node_modules`; the Task 11 lint/format gates need the root toolchain).
  ```powershell
  npm install
  ```
  Expected output: ends with a line like `added 1234 packages, and audited ... packages in ...s` and exit code 0 (a few warnings about deprecated transitive deps are normal). Verify the gate binaries resolved:
  ```powershell
  Test-Path node_modules/.bin/eslint; Test-Path node_modules/.bin/prettier
  ```
  Expected output: `True` twice.

*(No commit — nothing changed in git.)*

---

### Task 2: Commit the demo source assets (`demo-videos/`)

**Files:**
- Create (track in git): `demo-videos/1-formul-tanitim.mp4`, `demo-videos/1-formul-tanitim.png`, `demo-videos/2-sekil-donusumu.mp4`, `demo-videos/2-sekil-donusumu.png`, `demo-videos/3-baslik-slaydi.mp4`, `demo-videos/3-baslik-slaydi.png`, `demo-videos/4-koordinat-sistemi.mp4`, `demo-videos/4-koordinat-sistemi.png`, `demo-videos/4b-koordinat-latex.mp4`, `demo-videos/4b-koordinat-latex.png`

- [ ] **Step 1: Verify the 10 files exist with the expected sizes.**
  ```powershell
  Get-ChildItem demo-videos | Select-Object Name, Length
  ```
  Expected output: exactly 10 rows — the 5 `.mp4` + 5 `.png` pairs listed in the Reality-check section above, each between ~9,000 and ~30,000 bytes (172 KB total).

- [ ] **Step 2: Stage and commit.**
  ```powershell
  git add demo-videos
  git commit -m "chore(assets): commit demo videos and posters (5 MP4 + 5 PNG, 172 KB)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `10 files changed` in the commit summary. Then `git status --porcelain` prints nothing.

---

### Task 3: Copy videos + posters into `website/public/demo/`

**Files:**
- Create: `website/public/demo/` (10 copied files, same names as `demo-videos/`)

- [ ] **Step 1: Create the directory and copy with PowerShell.**
  ```powershell
  New-Item -ItemType Directory -Force website/public/demo | Out-Null
  Copy-Item demo-videos/* website/public/demo/
  ```
  Expected output: none (silent success).

- [ ] **Step 2: Verify the copy.**
  ```powershell
  (Get-ChildItem website/public/demo).Count
  Get-ChildItem website/public/demo | Select-Object Name
  ```
  Expected output: `10`, then the 10 filenames (`1-formul-tanitim.mp4` … `4b-koordinat-latex.png`). Vite serves `public/` at the site root, so these will be reachable as `/demo/<name>` in dev, preview, and the Netlify deploy.

- [ ] **Step 3: Stage and commit.**
  ```powershell
  git add website/public/demo
  git commit -m "feat(website): ship demo videos and posters as public gallery assets" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `10 files changed`.

---

### Task 4: Install website deps + baseline build (prove the site builds BEFORE changes)

**Files:**
- None committed (`website/node_modules` and `website/dist` are gitignored)

- [ ] **Step 1: Install (website/ is standalone — own `package.json` + `package-lock.json`, outside the npm workspaces).**
  ```powershell
  cd website; npm install
  ```
  Expected output: `added ~XX packages ... in Xs`, exit code 0. Then verify: `Test-Path node_modules/.bin/vite` → `True`.

- [ ] **Step 2: Lockfile-drift guard.** If your npm version rewrote metadata:
  ```powershell
  git status --porcelain package-lock.json
  ```
  Expected output: empty. If it shows ` M website/package-lock.json`, discard it (lockfile churn is out of scope): `git checkout -- package-lock.json`.

- [ ] **Step 3: Baseline production build.**
  ```powershell
  npm run build
  ```
  Expected output:
  ```
  > manim-motion-website@1.1.0 build
  > vite build

  vite v5.x.x building for production...
  ✓ NN modules transformed.
  dist/index.html  ...
  dist/assets/index-XXXXXXXX.css  ...
  dist/assets/index-XXXXXXXX.js   ...
  ✓ built in X.XXs
  ```
  The key line is `✓ built`. Also verify the public assets were copied into the build:
  ```powershell
  (Get-ChildItem dist/demo).Count; cd ..
  ```
  Expected output: `10`.

*(No commit — build artifacts are gitignored. If this baseline build FAILS, stop and report: the pre-existing site is broken and that is news for the orchestrator.)*

---

### Task 5: Gallery section — new `GallerySection.vue` + wiring in `App.vue`

**Files:**
- Create: `website/src/components/GallerySection.vue`
- Modify: `website/src/App.vue` (template block lines 1–16: section order; script imports around lines 19–31)

- [ ] **Step 1: Create `website/src/components/GallerySection.vue` with exactly this content** (uses the existing global design tokens/classes from `App.vue` — `section-eyebrow`, `section-title`, `reveal`, CSS variables; eyebrow number `04` continues the existing `01/02/03` sequence; the `cursor: auto` override is required because the site sets `cursor: none` globally for its custom cursor):

  ```vue
  <template>
    <section id="gallery" class="gallery-section">
      <div class="gallery-header reveal">
        <div class="section-eyebrow">04 — Showcase</div>
        <h2 class="section-title">Straight from the<br><em>Render Queue</em></h2>
        <p class="gallery-intro">
          Five animations composed on the visual canvas and rendered by the
          built-in Docker + Manim pipeline. Press play — every clip below is a
          real MP4 produced by this editor.
        </p>
      </div>

      <div class="gallery-grid">
        <figure
          v-for="(demo, i) in demos"
          :key="demo.src"
          class="gallery-card reveal"
          :class="'reveal-delay-' + ((i % 3) + 1)"
        >
          <div class="gallery-video-wrap">
            <video
              class="gallery-video"
              controls
              preload="none"
              :poster="demo.poster"
              :aria-label="'Demo video: ' + demo.title"
            >
              <source :src="demo.src" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <figcaption class="gallery-caption">
            <div class="gallery-caption-meta">Render {{ String(i + 1).padStart(2, '0') }} / 05</div>
            <div class="gallery-caption-title">{{ demo.title }}</div>
            <p class="gallery-caption-desc">{{ demo.desc }}</p>
          </figcaption>
        </figure>
      </div>
    </section>
  </template>

  <script setup>
  const demos = [
    {
      src: '/demo/1-formul-tanitim.mp4',
      poster: '/demo/1-formul-tanitim.png',
      title: 'Formula Introduction',
      desc: 'A LaTeX formula written onto the screen with the Write animation — composed entirely on the visual canvas, without typing a line of Python.',
    },
    {
      src: '/demo/2-sekil-donusumu.mp4',
      poster: '/demo/2-sekil-donusumu.png',
      title: 'Shape Morphing',
      desc: 'One geometry morphing into another with eased interpolation — the signature Manim transform, created with two clicks and a timeline clip.',
    },
    {
      src: '/demo/3-baslik-slaydi.mp4',
      poster: '/demo/3-baslik-slaydi.png',
      title: 'Title Slide',
      desc: 'An animated title card with staged text entrances, sequenced on the multi-track timeline.',
    },
    {
      src: '/demo/4-koordinat-sistemi.mp4',
      poster: '/demo/4-koordinat-sistemi.png',
      title: 'Coordinate System',
      desc: 'Configurable axes with a plotted function graph animating into view — set up entirely from the Axes inspector.',
    },
    {
      src: '/demo/4b-koordinat-latex.mp4',
      poster: '/demo/4b-koordinat-latex.png',
      title: 'Coordinates + LaTeX',
      desc: 'The same coordinate scene labeled with native MathTex — the formula typeset in a real math font, straight from the LaTeX object.',
    },
  ]
  </script>

  <style scoped>
  .gallery-section {
    padding: 120px 48px;
    max-width: 1400px;
    margin: 0 auto;
    border-top: 1px solid var(--stroke);
  }
  .gallery-header {
    margin-bottom: 72px;
  }
  .gallery-intro {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 300;
    color: var(--latex-dim);
    margin-top: 20px;
    max-width: 560px;
    line-height: 1.8;
  }
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .gallery-card {
    margin: 0;
    background: var(--surface);
    border: 1px solid var(--stroke);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
  }
  .gallery-card:hover {
    border-color: var(--stroke-bright);
    transform: translateY(-4px);
    box-shadow: 0 24px 60px var(--shadow);
  }
  .gallery-card:first-child {
    grid-column: span 2;
  }
  .gallery-video-wrap {
    background: var(--deep);
    border-bottom: 1px solid var(--stroke);
  }
  .gallery-video {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    background: #000;
    /* The site hides the OS cursor globally (custom-cursor design);
       native <video> controls need a real pointer — restore it here. */
    cursor: auto !important;
  }
  .gallery-caption {
    padding: 24px 28px 28px;
  }
  .gallery-caption-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--acid);
    margin-bottom: 10px;
  }
  .gallery-caption-title {
    font-family: var(--font-head);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--latex-white);
    margin-bottom: 8px;
  }
  .gallery-caption-desc {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 300;
    line-height: 1.9;
    color: var(--latex-dim);
  }
  @media (max-width: 900px) {
    .gallery-section {
      padding: 80px 24px;
    }
    .gallery-grid {
      grid-template-columns: 1fr;
    }
    .gallery-card:first-child {
      grid-column: span 1;
    }
  }
  </style>
  ```

- [ ] **Step 2: Mount the section in `website/src/App.vue` template** (between Workflow and Marquee, matching the eyebrow numbering). Edit — old string:
  ```
      <WorkflowSection />
      <MarqueeSection />
  ```
  New string:
  ```
      <WorkflowSection />
      <GallerySection />
      <MarqueeSection />
  ```

- [ ] **Step 3: Add the import in `website/src/App.vue` script.** Edit — old string:
  ```
  import WorkflowSection from './components/WorkflowSection.vue'
  import MarqueeSection from './components/MarqueeSection.vue'
  ```
  New string:
  ```
  import WorkflowSection from './components/WorkflowSection.vue'
  import GallerySection from './components/GallerySection.vue'
  import MarqueeSection from './components/MarqueeSection.vue'
  ```
  (`useReveal()` runs in `App.vue`'s `onMounted`, which fires after children mount — the new section's `.reveal` elements are picked up automatically, no other wiring needed.)

- [ ] **Step 4: Verify with a build.**
  ```powershell
  cd website; npm run build
  ```
  Expected output: `✓ built in X.XXs` (no errors). Then confirm the gallery data is compiled into the bundle:
  ```powershell
  Select-String -Path dist/assets/*.js -Pattern "1-formul-tanitim" -List | Select-Object -First 1; cd ..
  ```
  Expected output: one matching line from `dist/assets/index-*.js`.

- [ ] **Step 5: Stage and commit.**
  ```powershell
  git add website/src/components/GallerySection.vue website/src/App.vue
  git commit -m "feat(website): add demo video gallery section (5 rendered MP4s with posters)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `2 files changed`.

---

### Task 6: Quickstart terminal block — rewrite `CtaSection.vue`

**Files:**
- Modify: `website/src/components/CtaSection.vue` (full rewrite — currently 23 lines, no `<style>`, two wrong-repo links)

- [ ] **Step 1: Replace the ENTIRE content of `website/src/components/CtaSection.vue` with exactly this** (adds `id="quickstart"`, a mac-chrome terminal block reusing the global `panel-dot`/`panel-title`/`code-cm`/`code-str` classes from `App.vue`, and fixes both GitHub URLs to the real repo):

  ```vue
  <template>
    <section id="quickstart" class="cta-section">
      <div class="cta-content">
      <h2 class="cta-title reveal">
        Your First<br><em>Mathematical</em><br>Masterpiece Awaits
      </h2>
      <p class="cta-desc reveal reveal-delay-1">
        Open source. Self-hosted. No subscription. Clone the repo,
        run <span class="text-accent">docker compose up</span>,
        and start animating in under 60 seconds. Screenshots and full docs on GitHub.
      </p>
      <div class="cta-terminal reveal reveal-delay-2">
        <div class="cta-terminal-header">
          <span class="panel-dot panel-dot-r"></span>
          <span class="panel-dot panel-dot-y"></span>
          <span class="panel-dot panel-dot-g"></span>
          <span class="panel-title">Quickstart — Terminal</span>
        </div>
        <pre class="cta-terminal-body"><code><span class="code-cm"># clone</span>
  git clone https://github.com/kadirhanpolat/Manim-Editor.git
  cd Manim-Editor

  <span class="code-cm"># boot the full stack: editor + API + render queue + Manim worker</span>
  docker compose up --build

  <span class="code-cm"># then open</span>
  <span class="code-str">http://localhost:8080</span></code></pre>
      </div>
      <div class="flex-center-wrap reveal reveal-delay-3">
        <a href="https://github.com/kadirhanpolat/Manim-Editor" target="_blank" rel="noopener noreferrer" class="btn-primary btn-primary--cta magnet">
          ⟶ &nbsp;Clone on GitHub
        </a>
        <a href="https://github.com/kadirhanpolat/Manim-Editor#readme" target="_blank" rel="noopener noreferrer" class="btn-ghost magnet">
          Read docs
        </a>
      </div>
      </div>
    </section>
  </template>

  <style scoped>
  .cta-terminal {
    max-width: 640px;
    margin: 0 auto 56px;
    text-align: left;
    border: 1px solid var(--stroke);
    border-radius: 12px;
    overflow: hidden;
    background: var(--deep);
    box-shadow: 0 24px 60px var(--shadow);
  }
  .cta-terminal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--stroke);
    background: var(--surface);
  }
  .cta-terminal-body {
    margin: 0;
    padding: 20px 24px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 300;
    line-height: 2;
    color: var(--latex-white);
    overflow-x: auto;
  }
  </style>
  ```

  **Caution:** the `<pre>` content is whitespace-significant — the command lines (`git clone …`, `cd Manim-Editor`, `docker compose up --build`) must start at column 0 inside the `<pre>` exactly as shown above (they intentionally break the surrounding indentation).

- [ ] **Step 2: Verify with a build.**
  ```powershell
  cd website; npm run build
  ```
  Expected output: `✓ built in X.XXs`. Then:
  ```powershell
  Select-String -Path dist/assets/*.js -Pattern "docker compose up --build" -List | Select-Object -First 1; cd ..
  ```
  Expected output: one matching line.

- [ ] **Step 3: Stage and commit.**
  ```powershell
  git add website/src/components/CtaSection.vue
  git commit -m "feat(website): add quickstart terminal block to CTA (git clone + docker compose up)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `1 file changed`.

---

### Task 7: Fix wrong GitHub repo links + add Gallery nav item

**Files:**
- Modify: `website/src/components/NavBar.vue` (`NavBar.vue:9-13` desktop links, `NavBar.vue:16` CTA URL, `NavBar.vue:48-52` drawer links, `NavBar.vue:53` drawer CTA URL)
- Modify: `website/src/components/HeroSection.vue` (`HeroSection.vue:23` primary button URL)
- Modify: `website/src/components/FooterSection.vue` (`FooterSection.vue:17-22` link list)

All remaining `https://github.com/BlommeJan/Manim-Motion` occurrences (7 after Task 6 fixed CtaSection's 2) become `https://github.com/kadirhanpolat/Manim-Editor`.

- [ ] **Step 1: NavBar desktop links — add Gallery.** Edit `website/src/components/NavBar.vue` — old string:
  ```
      <li><a href="#interface">Interface</a></li>
    </ul>
  ```
  New string:
  ```
      <li><a href="#interface">Interface</a></li>
      <li><a href="#gallery">Gallery</a></li>
    </ul>
  ```

- [ ] **Step 2: NavBar desktop CTA URL.** Edit — old string:
  ```
      <a href="https://github.com/BlommeJan/Manim-Motion" target="_blank" rel="noopener noreferrer" class="nav-cta magnet"><span>Get it on GitHub</span></a>
  ```
  New string:
  ```
      <a href="https://github.com/kadirhanpolat/Manim-Editor" target="_blank" rel="noopener noreferrer" class="nav-cta magnet"><span>Get it on GitHub</span></a>
  ```

- [ ] **Step 3: NavBar mobile drawer links — add Gallery.** Edit — old string:
  ```
          <li><a href="#interface" @click="closeMenu">Interface</a></li>
        </ul>
  ```
  New string:
  ```
          <li><a href="#interface" @click="closeMenu">Interface</a></li>
          <li><a href="#gallery" @click="closeMenu">Gallery</a></li>
        </ul>
  ```

- [ ] **Step 4: NavBar drawer CTA URL.** Edit — old string:
  ```
        <a href="https://github.com/BlommeJan/Manim-Motion" target="_blank" rel="noopener noreferrer" class="nav-drawer-cta" @click="closeMenu">
  ```
  New string:
  ```
        <a href="https://github.com/kadirhanpolat/Manim-Editor" target="_blank" rel="noopener noreferrer" class="nav-drawer-cta" @click="closeMenu">
  ```

- [ ] **Step 5: HeroSection primary button URL.** Edit `website/src/components/HeroSection.vue` — old string:
  ```
        <a href="https://github.com/BlommeJan/Manim-Motion" target="_blank" rel="noopener noreferrer" class="btn-primary magnet">
  ```
  New string:
  ```
        <a href="https://github.com/kadirhanpolat/Manim-Editor" target="_blank" rel="noopener noreferrer" class="btn-primary magnet">
  ```

- [ ] **Step 6: FooterSection link list (4 URLs).** Edit `website/src/components/FooterSection.vue` — old string:
  ```
    <ul class="footer-links">
      <li><a href="https://github.com/BlommeJan/Manim-Motion#readme" target="_blank" rel="noopener noreferrer">Docs</a></li>
      <li><a href="https://github.com/BlommeJan/Manim-Motion" target="_blank" rel="noopener noreferrer">GitHub</a></li>
      <li><a href="https://github.com/BlommeJan/Manim-Motion/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">License</a></li>
      <li><a href="https://github.com/BlommeJan/Manim-Motion/releases" target="_blank" rel="noopener noreferrer">Releases</a></li>
    </ul>
  ```
  New string:
  ```
    <ul class="footer-links">
      <li><a href="https://github.com/kadirhanpolat/Manim-Editor#readme" target="_blank" rel="noopener noreferrer">Docs</a></li>
      <li><a href="https://github.com/kadirhanpolat/Manim-Editor" target="_blank" rel="noopener noreferrer">GitHub</a></li>
      <li><a href="https://github.com/kadirhanpolat/Manim-Editor/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">License</a></li>
      <li><a href="https://github.com/kadirhanpolat/Manim-Editor/releases" target="_blank" rel="noopener noreferrer">Releases</a></li>
    </ul>
  ```

- [ ] **Step 7: Verify zero stale links remain, then build.**
  ```powershell
  Get-ChildItem website/src -Recurse -Include *.vue,*.js | Select-String -Pattern "BlommeJan"
  ```
  Expected output: nothing (empty).
  ```powershell
  cd website; npm run build; cd ..
  ```
  Expected output: `✓ built in X.XXs`.

- [ ] **Step 8: Stage and commit.**
  ```powershell
  git add website/src/components/NavBar.vue website/src/components/HeroSection.vue website/src/components/FooterSection.vue
  git commit -m "fix(website): point GitHub links at kadirhanpolat/Manim-Editor + add Gallery nav item" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `3 files changed`.

---

### Task 8: Refresh feature copy — keyframes, 3D, TTS, 60 fps, 40+ objects

**Files:**
- Modify: `website/src/components/FeaturesGrid.vue` (`FeaturesGrid.vue:16-23` card 1, `:32-37` card 2, `:52-55` + `:61` card 3, `:83-93` card 5)
- Modify: `website/src/components/StatsBar.vue` (`StatsBar.vue:5-6`)

These bring the cards in line with the real product (CLAUDE.md: 41 2D + 8 3D object types, per-property keyframes with Bezier easing editor, 3D scenes with split viewport, gTTS/Coqui voiceover, `.py` import round-trip, 60 fps rAF preview).

- [ ] **Step 1: Card 1 (Visual Geometry Engine) — counts + 3D.** Edit `website/src/components/FeaturesGrid.vue` — old string:
  ```
          <p class="card-desc">
            A Konva.js-powered infinite canvas with 16+ primitive types —
            rectangles, circles, stars, polygons, hearts, arrows, grids —
            all with resize handles, rotation, multi-select, grid snapping,
            and precise z-ordering.
          </p>
          <span class="card-tag">Drag &amp; Drop</span>
          <span class="card-tag card-tag-blue">16+ Shapes</span>
  ```
  New string:
  ```
          <p class="card-desc">
            A Konva.js-powered infinite canvas with 40+ object types —
            rectangles, stars, hearts, LaTeX, axes, matrices, graphs,
            vector fields — plus a full 3D mode with spheres, surfaces,
            and a split-viewport editor. Resize handles, rotation,
            multi-select, grid snapping, precise z-ordering.
          </p>
          <span class="card-tag">Drag &amp; Drop</span>
          <span class="card-tag card-tag-blue">40+ Objects</span>
          <span class="card-tag card-tag-blue">3D Scenes</span>
  ```
  (Indentation note: the real file indents these lines with 8 spaces for `<p>`/`<span>` and 10 spaces for the paragraph text — match the file, the blocks above show the exact original indentation.)

- [ ] **Step 2: Card 2 (Cinematic Morphing) — 60 fps preview.** Edit — old string:
  ```
            Select any two shapes and morph between them with sub-frame
            interpolation. 17 easing functions including elastic,
            bounce, spring, and cubic variants give you total control
            over every transformation in your scene.
  ```
  New string:
  ```
            Select any two shapes and morph between them with sub-frame
            interpolation, previewed live at 60 fps on the canvas.
            17 easing functions including elastic, bounce, spring, and
            cubic variants give you total control over every transformation.
  ```

- [ ] **Step 3: Card 3 (Multi-track Timeline) — keyframes.** Edit — old string:
  ```
          <p class="card-desc">
            Up to 5 independent tracks with draggable, resizable clips.
            Set timing, easing, and duration — then render to video via Docker.
          </p>
  ```
  New string:
  ```
          <p class="card-desc">
            Up to 5 independent tracks with draggable, resizable clips —
            plus per-property keyframe lanes with a draggable Bezier
            easing editor. Set timing, then render to video via Docker.
          </p>
  ```
  And the card 3 tag — old string:
  ```
          <span class="card-tag">5 Tracks</span>
  ```
  New string:
  ```
          <span class="card-tag">5 Tracks</span>
          <span class="card-tag card-tag-blue">Keyframes</span>
  ```

- [ ] **Step 4: Card 5 (Hybrid Workflow) — round-trip + TTS.** Edit — old string:
  ```
          <p class="card-desc">
            Your composition is generated as Manim Python — syntax-highlighted
            code you can edit, copy, or export as a standalone
            <span class="text-accent">scene.py</span>.
            Build visually, then render to cinema-quality video with one click.
          </p>
  ```
  New string:
  ```
          <p class="card-desc">
            Your composition is generated as Manim Python — syntax-highlighted
            code you can edit, copy, or export as a standalone
            <span class="text-accent">scene.py</span> — and importing a
            <span class="text-accent">.py</span> brings it back onto the canvas.
            Attach gTTS or Coqui voiceovers to any clip, then render
            cinema-quality video with one click.
          </p>
  ```
  And the card 5 tags — old string:
  ```
            <span class="card-tag">Generated Code</span>
            <span class="card-tag card-tag-blue">Export .py</span>
            <span class="card-tag card-tag-muted">Docker Render</span>
  ```
  New string:
  ```
            <span class="card-tag">Code Round-Trip</span>
            <span class="card-tag card-tag-blue">TTS Voiceover</span>
            <span class="card-tag card-tag-muted">Docker Render</span>
  ```

- [ ] **Step 5: StatsBar first stat.** Edit `website/src/components/StatsBar.vue` — old string:
  ```
          <div class="stat-num">16+</div>
          <div class="stat-label">Shape Primitives</div>
  ```
  New string:
  ```
          <div class="stat-num">40+</div>
          <div class="stat-label">Object Types</div>
  ```

- [ ] **Step 6: Verify with a build.**
  ```powershell
  cd website; npm run build; cd ..
  ```
  Expected output: `✓ built in X.XXs`.

- [ ] **Step 7: Stage and commit.**
  ```powershell
  git add website/src/components/FeaturesGrid.vue website/src/components/StatsBar.vue
  git commit -m "feat(website): refresh feature copy - 40+ objects, keyframes, 3D, TTS voiceover, 60fps preview" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `2 files changed`.

---

### Task 9: Full site verification (build artifacts + preview smoke)

**Files:**
- None modified

- [ ] **Step 1: Final clean build + artifact checks.**
  ```powershell
  cd website; npm run build
  Test-Path dist/index.html
  (Get-ChildItem dist/demo).Count
  Select-String -Path dist/assets/*.js -Pattern "4b-koordinat-latex" -List | Select-Object -First 1
  Select-String -Path dist/assets/*.js -Pattern "kadirhanpolat/Manim-Editor" -List | Select-Object -First 1
  cd ..
  ```
  Expected output: `✓ built in X.XXs`; `True`; `10`; one match for each `Select-String` (gallery data and corrected repo URL are in the bundle).

- [ ] **Step 2: Preview smoke test.** Start the preview server in the background (it blocks the terminal otherwise — agentic workers: use the run-in-background facility):
  ```powershell
  cd website; npm run preview
  ```
  Expected output: `➜  Local:   http://localhost:4173/`. Then from another shell:
  ```powershell
  (Invoke-WebRequest -UseBasicParsing http://localhost:4173/).StatusCode
  (Invoke-WebRequest -UseBasicParsing -Method Head http://localhost:4173/demo/1-formul-tanitim.mp4).StatusCode
  (Invoke-WebRequest -UseBasicParsing -Method Head http://localhost:4173/demo/3-baslik-slaydi.png).StatusCode
  ```
  Expected output: `200` three times (the page serves; the video and poster assets serve).

- [ ] **Step 3: Manual visual checklist (open http://localhost:4173/ in a browser — if running headless/agentic, the Step 2 checks + Task 5/6/7/8 bundle greps stand in for this):**
  - Nav shows `Features / Workflow / Interface / Gallery`; clicking **Gallery** scrolls to the section.
  - Gallery shows 5 cards (first one full-width), each with a poster image; clicking play streams the MP4 with native controls and a visible cursor.
  - CTA section shows the terminal block with `git clone https://github.com/kadirhanpolat/Manim-Editor.git`, `docker compose up --build`, `http://localhost:8080`.
  - Hero/Nav/Footer GitHub links point at `kadirhanpolat/Manim-Editor` (hover the buttons, check the status bar).
  - Stats strip reads `40+ Object Types`.
  Then stop the preview server (Ctrl+C / kill the background process).

*(No commit — verification only.)*

---

### Task 10: README showcase section

**Files:**
- Modify: `README.md` (insert between the badge block's closing `---` at `README.md:23` and `## Screenshots` at `README.md:25`)

- [ ] **Step 1: Insert the Showcase section.** Edit `README.md` — old string (unique anchor — the version badge, end of the badge block, divider, and the Screenshots heading):
  ```
    <img src="https://img.shields.io/badge/version-3.21.0-6B7280" alt="Version">
  </p>

  ---

  ## Screenshots
  ```
  New string:
  ```
    <img src="https://img.shields.io/badge/version-3.21.0-6B7280" alt="Version">
  </p>

  ---

  ## Showcase

  *Demo animations built entirely in the visual editor and rendered by the built-in Manim pipeline. Click a poster to watch the MP4 (each clip is under 30 KB).*

  | | |
  |---|---|
  | [![Formula Introduction](demo-videos/1-formul-tanitim.png)](demo-videos/1-formul-tanitim.mp4)<br>*Formula Introduction — LaTeX written on screen* | [![Shape Morphing](demo-videos/2-sekil-donusumu.png)](demo-videos/2-sekil-donusumu.mp4)<br>*Shape Morphing — eased transform between shapes* |
  | [![Title Slide](demo-videos/3-baslik-slaydi.png)](demo-videos/3-baslik-slaydi.mp4)<br>*Title Slide — staged text entrances* | [![Coordinate System](demo-videos/4-koordinat-sistemi.png)](demo-videos/4-koordinat-sistemi.mp4)<br>*Coordinate System — axes + plotted graph* |
  | [![Coordinates with LaTeX](demo-videos/4b-koordinat-latex.png)](demo-videos/4b-koordinat-latex.mp4)<br>*Coordinates + LaTeX — native MathTex labels* | |

  The same five clips are embedded as a video gallery on the **landing page** in [`website/`](website/) — run it locally with `cd website && npm install && npm run dev` (port 5174), or see the Netlify deploy notes in the Quick Start section below.

  ---

  ## Screenshots
  ```
  (Important: in the old/new strings above, the README's real lines have NO leading indentation — strip the two leading spaces this plan uses for step formatting. The `<img …>` line keeps its original two-space indent inside the `<p>` block, exactly as it is in the file today.)

- [ ] **Step 2: Verify rendering-safe markdown** (poster paths resolve — they were committed in Task 2):
  ```powershell
  Select-String -Path README.md -Pattern "## Showcase"
  Test-Path demo-videos/1-formul-tanitim.png
  ```
  Expected output: one match at ~line 25, then `True`.

- [ ] **Step 3: Stage and commit.**
  ```powershell
  git add README.md
  git commit -m "docs(readme): add showcase section with demo posters and website pointer" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  Expected output: `1 file changed`.

---

### Task 11: Repo-root quality gates + final sanity

**Files:**
- None modified

- [ ] **Step 1: Run the lint gate from the worktree root.**
  ```powershell
  npm run lint
  ```
  Expected output: exit code 0 with no error lines (warnings are allowed; `website/**` is in the ESLint `ignores` list so this track cannot affect it — this run proves no accidental out-of-scope edit happened).

- [ ] **Step 2: Run the format gate from the worktree root.**
  ```powershell
  npm run format:check
  ```
  Expected output: `All matched files use Prettier code style!` and exit code 0 (`website` and `*.md` are in `.prettierignore`; the prettier globs only cover `services/`, `packages/`, `e2e/`).

- [ ] **Step 3: Final git sanity.**
  ```powershell
  git status --porcelain
  git log --oneline main..HEAD
  ```
  Expected output: empty status (clean tree — if `website/package-lock.json` shows modified, restore it: `git checkout -- website/package-lock.json`); and exactly 7 commits, newest first:
  ```
  docs(readme): add showcase section with demo posters and website pointer
  feat(website): refresh feature copy - 40+ objects, keyframes, 3D, TTS voiceover, 60fps preview
  fix(website): point GitHub links at kadirhanpolat/Manim-Editor + add Gallery nav item
  feat(website): add quickstart terminal block to CTA (git clone + docker compose up)
  feat(website): add demo video gallery section (5 rendered MP4s with posters)
  feat(website): ship demo videos and posters as public gallery assets
  chore(assets): commit demo videos and posters (5 MP4 + 5 PNG, 172 KB)
  ```

- [ ] **Step 4: Report completion to the orchestrator** with: the 7 commit hashes, the Task 9 verification results, and the note that no files outside `website/`, `demo-videos/`, `README.md` were touched (the orchestrator merges Track A first, before B/C/D).

---

## Spec-line → task traceability (self-review)

| Track A spec line | Task |
|---|---|
| English landing page: hero | Already exists; its broken GitHub link fixed in Task 7 |
| Feature sections (real features: canvas, 60fps preview, round-trip, keyframes, 3D, TTS) | Task 8 (+ existing FeaturesGrid) |
| Quickstart (`git clone` → `docker compose up --build` → localhost:8080) | Task 6 |
| Gallery: 5 demo videos, `.png` poster + `.mp4` source, `<video controls>` | Task 5 |
| Copy videos+posters into `website/public/demo/` via PowerShell `Copy-Item` | Task 3 |
| Commit `demo-videos/` itself | Task 2 |
| README showcase section (posters + pointer to `website/`) | Task 10 |
| Verify `npm install` + `npm run build` in `website/` | Tasks 4 (baseline) and 9 (final), per-task builds in 5–8 |
| No new CI job / no changes outside the 3 paths | Enforced throughout; proven in Task 11 |
| Dark-theme product aesthetic | Reuses the existing blueprint design tokens (`--obsidian`/`--blueprint`/`--acid`) |
| Final `npm run lint` + `npm run format:check` from repo root | Task 11 |
