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
