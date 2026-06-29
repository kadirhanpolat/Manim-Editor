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
<span class="code-str">http://localhost:8758</span></code></pre>
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
