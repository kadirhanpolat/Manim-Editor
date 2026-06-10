# PNG Dizisi + Saydam WebM Export — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut MP4/GIF/WebM export altyapısına `png` (frame dizisi → ZIP indir) ve `webm_transparent` (alfa kanallı WebM) formatlarını ekle.

**Architecture:** Wave1'de kurulan format tablosu (`FORMAT_FLAGS`, `FORMAT_EXT`, zod enum, `RENDER_EXTS`) satır eklenerek genişletilir; yeni bileşen oluşturulmaz. `png` formatı worker'da ZIP üretir → `latest.zip`; `webm_transparent` standart `latest.webm` üretir. Frontend `renderFormat` store alanı her zaman gerçek dosya uzantısını tutar (`png → zip`, `webm_transparent → webm`), böylece `getLatestUrl` değişmez.

**Tech Stack:** Python stdlib (`zipfile`, `glob`), TypeScript strict, Vue 3 `<script setup lang="ts">`, Zod, Vitest

---

## Dosya Haritası

| Dosya | Değişiklik |
|---|---|
| `services/renderer/render_args.py` | `FORMAT_FLAGS` + `FORMAT_EXT`'e `png` ve `webm_transparent` satırı |
| `services/api/src/compiler/validator.ts` | `format` zod enum'a `'png'` ve `'webm_transparent'` |
| `services/api/src/util/renderFiles.ts` | `RENDER_EXTS`, `CONTENT_TYPES`, `RENDER_FILE_RE`'ye `zip` |
| `services/web/src/api.ts` | `RenderOptions.format` tipine `'png' \| 'webm_transparent'` |
| `services/renderer/worker.py` | `find_output_png_dir` yardımcısı + PNG → ZIP kolu |
| `services/web/src/components/RenderOptionsDialog.vue` | `FORMATS` array'ine 2 yeni giriş |
| `services/web/src/store/project.ts` | `renderFormat` atanırken `FORMAT_TO_EXT` eşlemesi |
| `services/web/src/App.vue` | Tamamlandı diyaloğuna `renderFormat === 'zip'` kolu |
| `services/api/tests/render-options.test.ts` | `png`/`webm_transparent` allowlist testleri |
| `services/api/tests/render-files.test.ts` | `zip` uzantısı testleri |

---

## Task 1: render_args.py — 2 yeni format satırı

**Files:**
- Modify: `services/renderer/render_args.py`

- [ ] **Step 1: `FORMAT_FLAGS`'a 2 yeni giriş ekle**

`services/renderer/render_args.py` dosyasını aç. Şu bloğu bul:

```python
FORMAT_FLAGS = {
    "mp4": [],  # manim default container — no flag keeps legacy argv
    "gif": ["--format", "gif"],
    "webm": ["--format", "webm"],
}
```

Şu hale getir:

```python
FORMAT_FLAGS = {
    "mp4":              [],                                          # manim default
    "gif":              ["--format", "gif"],
    "webm":             ["--format", "webm"],
    "png":              ["--format", "png"],
    "webm_transparent": ["--format", "webm", "--transparent"],
}
```

- [ ] **Step 2: `FORMAT_EXT`'e 2 yeni giriş ekle**

Şu bloğu bul:

```python
FORMAT_EXT = {"mp4": "mp4", "gif": "gif", "webm": "webm"}
```

Şu hale getir:

```python
FORMAT_EXT = {
    "mp4":              "mp4",
    "gif":              "gif",
    "webm":             "webm",
    "png":              "zip",   # frame dizisi → zip
    "webm_transparent": "webm",  # alfa kanallı webm
}
```

- [ ] **Step 3: Smoke doğrulama**

```bash
python -c "
import sys; sys.path.insert(0, 'services/renderer')
from render_args import build_render_args, output_ext
print(build_render_args({'options': {'format': 'png', 'resolution': '1920x1080', 'fps': 60}}))
print(build_render_args({'options': {'format': 'webm_transparent', 'resolution': '1920x1080', 'fps': 60}}))
print(output_ext({'options': {'format': 'png'}}))
print(output_ext({'options': {'format': 'webm_transparent'}}))
"
```

Beklenen çıktı:
```
['-qh', '--format', 'png']
['-qh', '--format', 'webm', '--transparent']
zip
webm
```

- [ ] **Step 4: Commit**

```bash
git add services/renderer/render_args.py
git commit -m "feat(renderer): add png and webm_transparent to FORMAT_FLAGS/FORMAT_EXT"
```

---

## Task 2: validator.ts — format enum genişletme

**Files:**
- Modify: `services/api/src/compiler/validator.ts`
- Modify: `services/api/tests/render-options.test.ts`

- [ ] **Step 1: Önce başarısız testleri yaz**

`services/api/tests/render-options.test.ts` dosyasını aç. `'accepts every allowlisted combination'` testini bul. Format listesini genişlet:

```ts
  it('accepts every allowlisted combination (5 formats x 5 resolutions x 3 fps)', () => {
    for (const format of ['mp4', 'gif', 'webm', 'png', 'webm_transparent'] as const) {
```

Ayrıca ilk `describe` bloğunun sonuna şu iki testi ekle:

```ts
  it('accepts png format', () => {
    const r = parseRenderOptions({ format: 'png', resolution: '1920x1080', fps: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options.format).toBe('png');
  });

  it('accepts webm_transparent format', () => {
    const r = parseRenderOptions({ format: 'webm_transparent', resolution: '1920x1080', fps: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options.format).toBe('webm_transparent');
  });
```

- [ ] **Step 2: Testlerin başarısız olduğunu doğrula**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace services/api -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|png|webm_transparent"
```

Beklenen: `png` ve `webm_transparent` testleri FAIL (zod henüz kabul etmiyor).

- [ ] **Step 3: validator.ts'deki format enum'u genişlet**

`services/api/src/compiler/validator.ts` dosyasını aç. Şu satırı bul:

```ts
  format: z.enum(['mp4', 'gif', 'webm']).default('mp4'),
```

Şu hale getir:

```ts
  format: z.enum(['mp4', 'gif', 'webm', 'png', 'webm_transparent']).default('mp4'),
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace services/api -- --reporter=verbose 2>&1 | tail -10
```

Beklenen: tüm testler PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/compiler/validator.ts services/api/tests/render-options.test.ts
git commit -m "feat(api): add png and webm_transparent to render format enum allowlist"
```

---

## Task 3: renderFiles.ts — zip uzantısı

**Files:**
- Modify: `services/api/src/util/renderFiles.ts`
- Modify: `services/api/tests/render-files.test.ts`

- [ ] **Step 1: Önce başarısız testleri yaz**

`services/api/tests/render-files.test.ts` dosyasını aç. `'allowlists exactly mp4, gif, webm'` testini bul:

```ts
  it('allowlists exactly mp4, gif, webm, zip', () => {
    expect([...RENDER_EXTS]).toEqual(['mp4', 'gif', 'webm', 'zip']);
    expect(isRenderExt('mp4')).toBe(true);
    expect(isRenderExt('webm')).toBe(true);
    expect(isRenderExt('zip')).toBe(true);
    expect(isRenderExt('mov')).toBe(false);
    expect(isRenderExt('mp4/..')).toBe(false);
  });
```

`'maps extensions to content types'` testine şunu ekle:

```ts
    expect(contentTypeFor('zip')).toBe('application/zip');
```

`'accepts history filenames...'` testine şunları ekle:

```ts
    expect(isRenderFilename('latest.zip')).toBe(true);
    expect(isRenderFilename('render_20260610_120000.zip')).toBe(false); // zip history tutulmuyor ama format geçerli olmalı
```

> **Not:** `isRenderFilename` yalnızca dosya adı güvenliğini kontrol eder — uzantı geçerliyse `true` döner. `latest.zip` geçerlidir.

Testi daha doğru hale getir:

```ts
    expect(isRenderFilename('latest.zip')).toBe(true);
```

- [ ] **Step 2: Testlerin başarısız olduğunu doğrula**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace services/api -- --reporter=verbose 2>&1 | grep -E "render-files|FAIL|PASS"
```

Beklenen: `render-files` testleri FAIL.

- [ ] **Step 3: renderFiles.ts'i güncelle**

`services/api/src/util/renderFiles.ts` dosyasını aç. Tüm içeriğini şu hale getir:

```ts
/**
 * Render output file helpers — the extension allowlist shared by the
 * render routes and the serve/download endpoints.
 *
 * Keep FORMAT_EXT in render_args.py in sync with RENDER_EXTS here.
 */

export const RENDER_EXTS = ['mp4', 'gif', 'webm', 'zip'] as const;
export type RenderExt = (typeof RENDER_EXTS)[number];

const CONTENT_TYPES: Record<RenderExt, string> = {
  mp4:  'video/mp4',
  gif:  'image/gif',
  webm: 'video/webm',
  zip:  'application/zip',
};

export function isRenderExt(s: unknown): s is RenderExt {
  return RENDER_EXTS.includes(s as RenderExt);
}

export function contentTypeFor(ext: RenderExt): string {
  return CONTENT_TYPES[ext];
}

// Allowlisted extensions. \w.- cannot express a path separator or "..%2f".
const RENDER_FILE_RE = /^[\w.-]+\.(mp4|gif|webm|zip)$/;

export function isRenderFilename(name: string): boolean {
  return RENDER_FILE_RE.test(name);
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace services/api -- --reporter=verbose 2>&1 | tail -10
```

Beklenen: tüm API testleri PASS.

- [ ] **Step 5: Typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/util/renderFiles.ts services/api/tests/render-files.test.ts
git commit -m "feat(api): add zip to RENDER_EXTS/CONTENT_TYPES/RENDER_FILE_RE for PNG sequence download"
```

---

## Task 4: api.ts — RenderOptions tipi

**Files:**
- Modify: `services/web/src/api.ts`

- [ ] **Step 1: RenderOptions.format tipini genişlet**

`services/web/src/api.ts` dosyasını aç. Şu satırı bul:

```ts
  format: 'mp4' | 'gif' | 'webm';
```

Şu hale getir:

```ts
  format: 'mp4' | 'gif' | 'webm' | 'png' | 'webm_transparent';
```

- [ ] **Step 2: Typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add services/web/src/api.ts
git commit -m "feat(api-client): add png and webm_transparent to RenderOptions format type"
```

---

## Task 5: RenderOptionsDialog.vue — 2 yeni format butonu

**Files:**
- Modify: `services/web/src/components/RenderOptionsDialog.vue`

- [ ] **Step 1: FORMATS array'ini genişlet**

`services/web/src/components/RenderOptionsDialog.vue` dosyasını aç. Şu bloğu bul:

```ts
const FORMATS = [
  { value: 'mp4', label: 'MP4', desc: 'H.264 video' },
  { value: 'gif', label: 'GIF', desc: 'Animated image' },
  { value: 'webm', label: 'WebM', desc: 'VP9 video' },
] as const;
```

Şu hale getir:

```ts
const FORMATS = [
  { value: 'mp4',              label: 'MP4',      desc: 'H.264 video' },
  { value: 'gif',              label: 'GIF',       desc: 'Animated image' },
  { value: 'webm',             label: 'WebM',      desc: 'VP9 video' },
  { value: 'png',              label: 'PNG Frames', desc: 'ZIP of frames' },
  { value: 'webm_transparent', label: 'WebM α',    desc: 'Transparent WebM' },
] as const;
```

- [ ] **Step 2: `.ro-row` grid sütun sayısını güncelle**

`<style scoped>` içindeki `.ro-row` kuralını bul:

```css
.ro-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
```

Format satırı artık 5 buton içeriyor; diğer satırlar (resolution, fps) 5 ve 3 sütunlu. `ro-row` genel stil olduğu için format satırı için özel sınıf yerine mevcut `repeat(3, 1fr)`'ı `repeat(auto-fill, minmax(70px, 1fr))`'ya değiştir:

```css
.ro-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 4: Unit testleri çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: tüm testler PASS.

- [ ] **Step 5: Commit**

```bash
git add services/web/src/components/RenderOptionsDialog.vue
git commit -m "feat(ui): add PNG Frames and WebM transparent options to RenderOptionsDialog"
```

---

## Task 6: store/project.ts — FORMAT_TO_EXT eşlemesi

**Files:**
- Modify: `services/web/src/store/project.ts`

Amaç: `renderFormat` store alanı her zaman gerçek dosya uzantısını tutmalı (`png → zip`, `webm_transparent → webm`). Bu sayede `getLatestUrl(projectId, renderFormat)` değişiklik gerektirmez.

- [ ] **Step 1: FORMAT_TO_EXT eşlemesini ekle**

`services/web/src/store/project.ts` dosyasını aç. `this.renderFormat = opts.format;` satırını bul (yaklaşık satır 1985). Bu satırın üstüne şu bloğu ekle ve satırı değiştir:

```ts
        // Map format names to actual output file extensions.
        // png renders as a ZIP archive; webm_transparent renders as webm.
        const FORMAT_TO_EXT: Record<string, string> = {
          png: 'zip',
          webm_transparent: 'webm',
        };
        this.renderFormat = FORMAT_TO_EXT[opts.format] ?? opts.format;
```

Yani değiştirilen satır:
```ts
        this.renderFormat = opts.format;
```
→
```ts
        const FORMAT_TO_EXT: Record<string, string> = { png: 'zip', webm_transparent: 'webm' };
        this.renderFormat = FORMAT_TO_EXT[opts.format] ?? opts.format;
```

- [ ] **Step 2: Typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 3: Unit testleri çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: tüm testler PASS.

- [ ] **Step 4: Commit**

```bash
git add services/web/src/store/project.ts
git commit -m "feat(store): map png→zip and webm_transparent→webm in renderFormat"
```

---

## Task 7: App.vue — ZIP indirme kolu

**Files:**
- Modify: `services/web/src/App.vue`

Tamamlandı diyaloğuna üçüncü format kolu ekle: `renderFormat === 'zip'` → `<a download>` butonu.

- [ ] **Step 1: `<img>` ve `<video>` bloklarının yerini bul**

`services/web/src/App.vue` içinde şu bloğu bul (yaklaşık satır 496–510):

```html
              <img
                v-if="renderVideoUrl && renderFormat === 'gif'"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                alt="Rendered GIF"
                class="w-full rounded-lg bg-black"
              />
              <video
                v-else-if="renderVideoUrl"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                controls
                class="w-full rounded-lg bg-black"
                autoplay
              ></video>
```

Şu hale getir:

```html
              <img
                v-if="renderVideoUrl && renderFormat === 'gif'"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                alt="Rendered GIF"
                class="w-full rounded-lg bg-black"
              />
              <div
                v-else-if="renderVideoUrl && renderFormat === 'zip'"
                class="flex flex-col items-center justify-center gap-3 py-8 rounded-lg bg-studio-surface border border-studio-border"
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-studio-accent">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                  <polyline points="9 15 12 18 15 15" />
                </svg>
                <span class="text-sm text-studio-text-muted">PNG frame dizisi hazır</span>
                <a
                  :href="renderVideoUrl"
                  download="frames.zip"
                  class="px-4 py-2 rounded-lg bg-studio-accent hover:bg-studio-accent-hover text-white text-sm font-medium transition-colors"
                >
                  ZIP İndir
                </a>
              </div>
              <video
                v-else-if="renderVideoUrl"
                :key="renderVideoUrl"
                :src="renderVideoUrl"
                controls
                class="w-full rounded-lg bg-black"
                autoplay
              ></video>
```

- [ ] **Step 2: Mevcut `<a>` download butonundaki dosya adını düzelt**

Yaklaşık satır 515'te şu satırı bul:

```html
                  :download="'render.' + renderFormat"
```

Bu satır zaten doğru çalışır (`renderFormat = 'zip'` için `render.zip`, `'webm'` için `render.webm`). Değiştirme gerekmez — sadece doğruladığını not et.

- [ ] **Step 3: Typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run typecheck 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 4: Lint**

```bash
cd D:/PYTHON/Manim-Editor && npm run lint 2>&1 | tail -5
```

Beklenen: hata yok.

- [ ] **Step 5: Unit testleri çalıştır**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: 714+ test PASS.

- [ ] **Step 6: Commit**

```bash
git add services/web/src/App.vue
git commit -m "feat(ui): add ZIP download branch for PNG frames in render completed dialog"
```

---

## Task 8: worker.py — PNG ZIP mantığı

**Files:**
- Modify: `services/renderer/worker.py`

Bu task Docker gerektirdiği için manuel smoke-test ile doğrulanır.

- [ ] **Step 1: `find_output_png_dir` yardımcısını ekle**

`services/renderer/worker.py` dosyasını aç. `find_output_video` fonksiyonunun hemen **altına** şu fonksiyonu ekle:

```python
def find_output_png_dir(media_dir: str, scene_name: str) -> str | None:
    """Find the directory containing Manim's PNG frame output."""
    patterns = [
        f"{media_dir}/videos/**/{scene_name}",
        f"{media_dir}/images/**/{scene_name}",
        f"{media_dir}/images/{scene_name}",
        f"{media_dir}/**/{scene_name}",
    ]
    for pattern in patterns:
        matches = [m for m in glob.glob(pattern, recursive=True) if os.path.isdir(m)]
        if matches:
            return max(matches, key=os.path.getmtime)
    return None
```

- [ ] **Step 2: `render_job` içine PNG ZIP kolunu ekle**

`render_job` fonksiyonunda şu satırı bul:

```python
    ext = output_ext(payload)
```

Bu satırdan sonra, `latest_link` tanımlanmadan önce değil, `os.makedirs(media_dir, ...)` sonrasındaki `if not os.path.exists(scene_file):` bloğunun **bitiminden** (`return {...}`) hemen sonra, `# Clean up old renders` yorumunun **önüne** şu import ekle (dosyanın üst kısmına):

```python
import zipfile
```

> **Not:** `import zipfile` satırını dosyanın üst kısmına, mevcut `import` bloğuna ekle (satır ~10 civarı).

Ardından `render_job` içinde, `result = subprocess.run(...)` bloğunun **sonundaki** `output_video = find_output_video(...)` satırından ÖNCE şu bloğu ekle:

```python
        # PNG sequence: zip the frame directory and return early
        if ext == "zip":
            png_dir = find_output_png_dir(media_dir, scene_name)
            if png_dir:
                # Remove stale latest.zip
                stale = os.path.join(media_dir, "latest.zip")
                if os.path.exists(stale):
                    os.remove(stale)
                with zipfile.ZipFile(latest_link, "w", zipfile.ZIP_DEFLATED) as zf:
                    for png in sorted(glob.glob(os.path.join(png_dir, "*.png"))):
                        zf.write(png, os.path.basename(png))
                print(f"[render] PNG frames zipped to: {latest_link}")
                return {
                    "ok": result.returncode == 0,
                    "stdout": result.stdout[-8000:] if result.stdout else "",
                    "stderr": result.stderr[-8000:] if result.stderr else "",
                    "outputPath": latest_link,
                    "exitCode": result.returncode,
                }
            # No PNG dir found — fall through to error path
            return {
                "ok": False,
                "error": f"PNG output directory not found in {media_dir}",
                "stdout": result.stdout[-8000:] if result.stdout else "",
                "stderr": result.stderr[-8000:] if result.stderr else "",
                "exitCode": result.returncode,
            }
```

Bu blok `subprocess.run` çağrısından sonra, `find_output_video` satırından önce gelir. Tam bağlam:

```python
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=os.path.dirname(scene_file),
        )

        # PNG sequence: zip the frame directory and return early
        if ext == "zip":
            ... (yukarıdaki blok) ...

        # Find the output video
        output_video = find_output_video(media_dir, scene_name, ext)
```

- [ ] **Step 3: Python sözdizimi doğrula**

```bash
python -m py_compile services/renderer/worker.py && echo "OK"
```

Beklenen: `OK` (sözdizim hatası yok).

- [ ] **Step 4: Commit**

```bash
git add services/renderer/worker.py
git commit -m "feat(renderer): add find_output_png_dir + PNG frame ZIP logic"
```

---

## Task 9: Final entegrasyon kontrolü

**Files:** Değişiklik yok — sadece doğrulama.

- [ ] **Step 1: Tam unit test suite**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm run test:unit 2>&1 | tail -5
```

Beklenen: 714+ test PASS.

- [ ] **Step 2: Engine testleri**

```bash
cd D:/PYTHON/Manim-Editor/services/web && npm test 2>&1 | tail -5
```

Beklenen: 114 test PASS.

- [ ] **Step 3: API testleri**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace services/api 2>&1 | tail -5
```

Beklenen: 53+ test PASS (render-options + render-files güncellemeleri dahil).

- [ ] **Step 4: Codegen testleri**

```bash
cd D:/PYTHON/Manim-Editor && npm test --workspace packages/manim-codegen 2>&1 | tail -5
```

Beklenen: 12 test PASS.

- [ ] **Step 5: Lint + format + typecheck**

```bash
cd D:/PYTHON/Manim-Editor && npm run lint 2>&1 | tail -5 && npm run format:check 2>&1 | tail -3 && npm run typecheck 2>&1 | tail -5
```

Beklenen: lint → 0 hata; format → `All matched files use Prettier code style!`; typecheck → hata yok.

- [ ] **Step 6: Prettier uygula (gerekirse)**

Eğer `format:check` hata verdiyse:

```bash
cd D:/PYTHON/Manim-Editor && npm run format && git add services/web/src/components/RenderOptionsDialog.vue services/web/src/App.vue services/web/src/store/project.ts services/web/src/api.ts services/api/src/compiler/validator.ts services/api/src/util/renderFiles.ts && git commit -m "style: prettier format PNG/transparent-webm export"
```

- [ ] **Step 7: Docker smoke test (isteğe bağlı, Docker mevcut ise)**

```bash
docker compose up --build -d
```

1. `http://localhost:8080` adresine git
2. Yeni proje oluştur → 1-2 nesne ekle
3. Render → **PNG Frames** seçimi → render başlat
4. Tamamlandı diyaloğunda "ZIP İndir" butonu görünüyor mu?
5. Render → **WebM α** seçimi → render başlat
6. Tamamlandı diyaloğunda video oynatıcı görünüyor mu?
