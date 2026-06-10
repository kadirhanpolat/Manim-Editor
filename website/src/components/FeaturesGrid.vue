<template>
  <section id="features" class="features-section">
    <div class="features-header reveal">
      <div class="section-eyebrow">01 — Core Capabilities</div>
      <h2 class="section-title">Built for the<br><em>Equation</em> Builders</h2>
    </div>

    <div class="bento-grid">

      <!-- Card 1: Visual Geometry Engine -->
      <div class="bento-card bento-1 reveal reveal-delay-1">
        <div class="card-bg-accent"></div>
        <div class="card-number">01 / 05</div>
        <div class="card-icon">⬡</div>
        <div class="card-title">Visual Geometry Engine</div>
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
      </div>

      <!-- Card 2: Cinematic Morphing -->
      <div class="bento-card bento-2 reveal reveal-delay-2">
        <div class="card-bg-accent"></div>
        <div class="card-number">02 / 05</div>
        <div class="card-icon">◈</div>
        <div class="card-title">Cinematic Morphing</div>
        <p class="card-desc">
          Select any two shapes and morph between them with sub-frame
          interpolation, previewed live at 60 fps on the canvas.
          17 easing functions including elastic, bounce, spring, and
          cubic variants give you total control over every transformation.
        </p>
        <div class="mini-canvas-wrap">
          <div class="mini-canvas-dots">
            <div class="shape-morph"></div>
            <div class="morph-arrow">⟶</div>
            <div class="shape-morph target"></div>
          </div>
        </div>
      </div>

      <!-- Card 3: Multi-track Timeline -->
      <div class="bento-card bento-3 reveal reveal-delay-1">
        <div class="card-number">03 / 05</div>
        <div class="card-icon">⏱</div>
        <div class="card-title">Multi-track Timeline</div>
        <p class="card-desc">
          Up to 5 independent tracks with draggable, resizable clips —
          plus per-property keyframe lanes with a draggable Bezier
          easing editor. Set timing, then render to video via Docker.
        </p>
        <div class="mini-timeline">
          <div class="tl-track"><div class="tl-clip tl-clip-1"></div></div>
          <div class="tl-track"><div class="tl-clip tl-clip-2"></div></div>
          <div class="tl-track"><div class="tl-clip tl-clip-3"></div></div>
        </div>
        <span class="card-tag">5 Tracks</span>
        <span class="card-tag card-tag-blue">Keyframes</span>
      </div>

      <!-- Card 4: LaTeX Integration -->
      <div class="bento-card bento-4 reveal reveal-delay-2">
        <div class="card-number">04 / 05</div>
        <div class="card-icon">∑</div>
        <div class="card-title">Native LaTeX</div>
        <p class="card-desc">
          Add MathTex expressions that render natively inside Manim.
          Euler, Maxwell, Schrödinger — animate any formula.
        </p>
        <div class="latex-preview">
          E = mc<sup>2</sup><span class="latex-cursor"></span>
        </div>
      </div>

      <!-- Card 5: Hybrid Workflow -->
      <div class="bento-card bento-5 reveal reveal-delay-3">
        <div class="card-number">05 / 05</div>
        <div class="card-icon">⌨</div>
        <div class="card-title">Hybrid Workflow</div>
        <p class="card-desc">
          Your composition is generated as Manim Python — syntax-highlighted
          code you can edit, copy, or export as a standalone
          <span class="text-accent">scene.py</span> — and importing a
          <span class="text-accent">.py</span> brings it back onto the canvas.
          Attach gTTS or Coqui voiceovers to any clip, then render
          cinema-quality video with one click.
        </p>
        <div class="flex-center-wrap flex-center-wrap--sm">
          <span class="card-tag">Code Round-Trip</span>
          <span class="card-tag card-tag-blue">TTS Voiceover</span>
          <span class="card-tag card-tag-muted">Docker Render</span>
        </div>
      </div>

    </div>
  </section>
</template>
