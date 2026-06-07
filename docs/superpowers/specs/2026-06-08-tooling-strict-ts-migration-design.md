# Tooling Foundation + Strict TypeScript Migration + CI — Design

**Tarih:** 2026-06-08
**Durum:** Onaylandı (tasarım), uygulama planı bekleniyor
**Kapsam:** Bu, çok aşamalı "uçtan uca kod iyileştirme" girişiminin **ilk alt-projesidir**. Diğer alt-projeler (backend mimari, frontend mimari refaktör, a11y/responsive, test derinleştirme, güvenlik sertleştirme) ayrı spec/plan döngülerinde ele alınacaktır.

---

## 1. Bağlam ve Karar Temelleri

- **Tehdit modeli:** Yalnızca yerel, tek kullanıcı (Docker, internete kapalı). Bu nedenle güvenlik bulguları (path traversal, auth yokluğu, CORS, RCE) bu alt-projede **kritik değildir**; "derinlemesine savunma" olarak ileri bir alt-projeye bırakılmıştır.
- **Bu alt-proje neden ilk:** Davranışı değiştirmeden tüm sonraki refaktörleri güvenli kılan temel (lint + format + tip + CI).
- **Maksimal kapsam kararı (kullanıcı):**
  - ESLint: **katı/tam** — tüm ihlaller hata, `--max-warnings 0`.
  - Tip güvenliği: **tam TypeScript migrasyonu**, `tsconfig strict: true`.
  - CI: **GitHub Actions** dahil.
- **Hard kural:** Sıfır regresyon. Dışa dönük davranış byte düzeyinde korunur (codegen parity testleri + e2e ana güvenlik ağı). Her faz bağımsız merge edilebilir, sonunda tüm testler yeşil.

## 2. Mevcut Durum (keşif)

- ~25k satır: web 21k (178 dosya, Vue 3 + Konva + Pinia), api 1.7k, `@manim/codegen` 1.4k, renderer 245, audio 149.
- **Hiç araç yapılandırması yok:** ESLint / Prettier / tsconfig / editorconfig / ruff / black — hiçbiri. CI yok.
- GitHub remote var (origin: kadirhanpolat/Manim-Editor, upstream fork: BlommeJan/Manim-Motion).
- Node **v24** (yerel `.ts` strip destekli).
- `@manim/codegen`: `type: module`, `main: src/index.js`, `exports: { ".": ..., "./src/*": ... }` — hem web (Vite) hem api (saf Node) tüketiyor.
- web: Vite + `@vitejs/plugin-vue`; `vue` → `vue/dist/vue.esm-bundler.js` alias'lı (bazı bileşenler inline `template:` string kullanıyor → vue-tsc denetimi dışında).
- vitest ayrı config (`vitest.config.js`), glob `tests/**/*.test.js`.
- e2e: workspace **dışı** bağımsız paket (Playwright, port 5188, `window.__projectStore` hook). TS'i yerel destekler.
- Python: yalnızca 3 dosya (renderer/audio worker + `tests/helpers/ast_check.py`).

## 3. Migrasyon Stratejisi

- `tsconfig` baştan `strict: true` **+ `allowJs: true`** → `.js` ve `.ts` bir arada; dosyalar **tek tek** taşınır, her commit'te testler yeşil. `allowJs` Faz 6 sonunda kapatılır.
- Geçici `any`/`@ts-expect-error` yalnızca faz *içinde* serbest; faz sonunda kapsam strict-temiz.
- Migrasyon **bağımlılık yönünde aşağıdan yukarı**: types → codegen → engine → store/api-client/parser → Vue bileşenleri → API servisi → testler.

### Çözülen iki yapısal kısıt

1. **`@manim/codegen` çift tüketim:** TS'e taşınınca `tsc` ile `dist/*.js` + `*.d.ts` üretir. `package.json` exports: api derlenmiş `dist`'ten, web Vite üzerinden kaynaktan (HMR korunur) tüketir.
2. **API saf Node ESM:** dev `tsx watch src/index.ts`, prod `tsc` build → `node dist/index.js`. Dockerfile build adımı eklenir. (Node 24 yerel strip daha hafif alternatif; Docker determinizmi için `tsc` build tercih edildi.)

## 4. tsconfig Topolojisi

- **`tsconfig.base.json` (kök):** `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `esModuleInterop`, `skipLibCheck: true`, `isolatedModules: true`, `allowJs: true` (geçici), `target: ES2022`.
- **`packages/manim-codegen/tsconfig.json`:** extends base; `moduleResolution: NodeNext`, `declaration: true`, `outDir: dist`, `rootDir: src`; build script `tsc`.
- **`services/web/tsconfig.json`:** extends base; `moduleResolution: Bundler`, `noEmit: true`, `types: ["vite/client"]`; SFC denetimi `vue-tsc --noEmit`. Ayrı `tsconfig.node.json` → vite/vitest config dosyaları.
- **`services/api/tsconfig.json`:** extends base; `module/moduleResolution: NodeNext`, `outDir: dist`.
- **`e2e/tsconfig.json`:** bağımsız; Playwright + node tipleri.
- **Kök `tsconfig.json`:** IDE için paketlere `references`.

## 5. Araç Yapılandırmaları

- **ESLint (`eslint.config.js`, flat):** `@eslint/js` recommended + `typescript-eslint` `recommendedTypeChecked` + `stylisticTypeChecked` + `eslint-plugin-vue` `flat/recommended`. `<script lang="ts">` için vue parser + ts parser. `eslint-config-prettier` ile format kuralları kapalı. Override: test / api (Node) / web (browser) globals. `ignores`: `dist`, `node_modules`, `coverage`. Gate: `eslint . --max-warnings 0`.
- **Prettier (`.prettierrc.json`):** `singleQuote: true`, `semi: true`, `printWidth: 100`. + `.prettierignore`. (Yalnızca kaynak biçimlenir; codegen'in ürettiği tek-satır Python string'leri etkilenmez.)
- **`.editorconfig`:** UTF-8, LF, 2 boşluk JS/Vue, 4 boşluk Python.
- **Python (`pyproject.toml`):** `[tool.ruff]` + `[tool.black]`, `line-length = 100`.
- **Kök script'ler:** `lint`, `lint:fix`, `format`, `format:check`, `typecheck` (paket başına orkestre). e2e workspace dışı → ayrı çağrılır.

## 6. Fazlar (her biri ayrı merge edilebilir, testler yeşil + kapsamda typecheck temiz)

**Faz 0 — Tooling iskeleti (kod mantığı değişmez)**
- Bağımlılıklar: `typescript`, `vue-tsc`, `tsx`, `typescript-eslint`, `eslint`, `eslint-plugin-vue`, `eslint-config-prettier`, `prettier`.
- Dosyalar: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `pyproject.toml`, kök script'ler, `.git-blame-ignore-revs`.
- Tek seferlik Prettier format commit'i (yalnızca biçim, ayrı commit, blame-ignore'a eklenir). Python: `black` + `ruff --fix`.
- CI iskeleti: `.github/workflows/ci.yml` — şimdilik `format:check` + mevcut testler.
- **Doğrulama:** `format:check` temiz; 515 unit + 114 engine yeşil; `git diff` yalnızca biçim.

**Faz 1 — TS temeli + domain tipleri + codegen**
- `tsconfig.base.json` + paket tsconfig'leri.
- Paylaşılan domain tipleri (`@manim/codegen/src/types.ts`): `Project`, `Stage`, `SceneObject` (discriminated union, `type` alanına göre 2D/3D), `Clip` (union), `Keyframe`, `AudioConfig`, `Camera3d`.
- `@manim/codegen/src/*.js` → `.ts`; `tsc` build → `dist` + `.d.ts`; exports güncellenir.
- **Doğrulama:** codegen parity (`manim-export`, `effects-codegen`, `phase26-effects-codegen`, `codegen-python-validity`) byte-aynı geçer; codegen typecheck temiz.

**Faz 2 — engine/ (saf mantık)**
- `easing, geometry, transform, keyframe, playback, mathExpr, projection3d, polygonVertices` → `.ts`.
- `mathExpr` whitelist ↔ codegen `safeMathExpr` senkronu korunur (CLAUDE.md invariant).
- **Doğrulama:** 114 engine + ilgili unit testleri yeşil.

**Faz 3 — store + api client + export parser**
- `store/project.js` (1743 satır), `api.js`, `export/manim.js` (`parseManimScript`) → `.ts`; `defineStore` domain tipleriyle tiplenir.
- **Doğrulama:** store/component + round-trip parser testleri yeşil.

**Faz 4 — Vue bileşenleri (aşağıdan yukarı)**
- Sıra: `inspector/ui/*` + `useObjectUpdate` → `stage/configs/*` → `stage/composables/*` → `inspector/object-settings/*` + `panels/*` → `timeline/*` → orkestratörler (`App.vue`, `StageCanvas.vue`, `Timeline.vue`, `topbar/*`).
- Her `.vue` → `<script setup lang="ts">`. vue-konva/Konva için gerekirse modül augmentasyonu/shim.
- **Dahil:** inline `template:`-string bileşenleri (Section/Num/ColorRow) SFC `<template>`'e taşınır (davranış aynı; vue-tsc kapsamına girer).
- **Doğrulama:** her alt-grup sonrası ilgili component testleri + snapshot'lar yeşil; `vue-tsc --noEmit` kapsamda temiz.

**Faz 5 — API servisi**
- `services/api/src/**/*.js` → `.ts` (routes, compiler wrappers, queue, ws). `dev → tsx watch`, `start → node dist`. Dockerfile build adımı. `api_node_modules` named-volume gotcha'sı korunur.
- **Doğrulama:** `docker compose up --build` → api `/health` 200; render + audio uçtan uca kontrol.

**Faz 6 — Testler + e2e + kapıların kapatılması**
- Test dosyaları gerektiğinde `.ts`; vitest `include` glob'una `.ts`. e2e → TS.
- `allowJs: false`. ESLint kuralları **hata** (`--max-warnings 0`). CI tam kapı: `format:check + lint + typecheck + unit + engine (+ e2e)`.
- **Doğrulama:** CI tüm işlerde yeşil; config dışı `.js` kaynak kalmaz.

**Faz 7 — Bağımlılık denetimi + dokümantasyon**
- `npm audit` (kritik/yüksek=0 veya gerekçeli istisna), `pip-audit`, `depcheck` ile kullanılmayan bağımlılık temizliği.
- README + CLAUDE.md güncellemesi (TS + araç zinciri).
- **Doğrulama:** `npm audit` temiz; README adımları doğrulanmış.

## 7. CI (`.github/workflows/ci.yml`)

- Tetik: push + pull_request.
- **`node` job:** setup-node@v4 (Node 24, npm cache) → `npm ci` → codegen build → `format:check` → `lint` → `typecheck` → `test:unit` (web) → engine test → codegen testleri. `codegen-python-validity` için setup-python (stdlib).
- **`python` job:** `ruff check` + `black --check`.
- **`e2e` job:** `playwright install chromium` + `npm test`.
- Kapılar kademeli: Faz 0'da yalnızca `format:check` + testler; `lint`/`typecheck` Faz 6'da tam kapı.

## 8. Riskler ve Azaltımlar

- **Devasa diff (TS migrasyonu 178 dosya):** Faz + alt-grup bölünmesi, her adımda yeşil testler. Prettier format ayrı commit (blame-ignore).
- **Davranış regresyonu:** codegen parity + e2e ana ağ; faz sonu doğrulama zorunlu.
- **Vue inline-template bileşenleri:** SFC'ye taşınarak denetime alınır.
- **vue-konva tip boşlukları:** modül augmentasyonu/shim; gerektiğinde dar `unknown`+narrowing (asla geniş `any` bırakılmaz).
- **API runtime değişimi (tsx/build):** Dockerfile + named-volume gotcha; `docker compose up --build` ile doğrulama.
- **Faz takılması:** her faz bağımsız merge edilebilir; öncekiler bozulmadan durur.

## 9. Kapsam Dışı (sonraki alt-projeler)

- Backend güvenlik sertleştirme (path traversal sanitizasyonu, auth, CORS, least-privilege sandbox).
- Frontend mimari refaktör (dev dosyaların parçalanması: project.js, manim.js, App.vue, playback.js).
- a11y/responsive, test coverage derinleştirme, performans profilleme.
- Tam `.vue`/`.js` → TS migrasyonu bu spec'e dahildir; ileri mimari bölme değildir.
