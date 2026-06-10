# PNG Dizisi + Saydam WebM Export — Tasarım

**Tarih:** 2026-06-10
**Kapsam:** Mevcut export sistemine 2 yeni format ekle: PNG frame dizisi (ZIP olarak indir) ve alfa kanallı saydam WebM.
**Base branch:** `main`

---

## Hedef

Wave1'de kurulan MP4/GIF/WebM export altyapısını minimal değişiklikle genişlet:

- `format='png'` → `manim --format png` → PNG kare dizisi → `latest.zip` olarak paketle → indir
- `format='webm_transparent'` → `manim --format webm --transparent` → alfa kanallı `latest.webm` → indir

Her iki çıktı da mevcut `latest.<ext>` servis mantığıyla uyumludur; kullanıcı değerleri asla argv'ye interpolate edilmez (mevcut güvenlik duruşu korunur).

## Non-Goals

- Tarayıcıda tek kare önizleme (ZIP içeriği)
- ZIP içinde alt dizin yapısı (düz `0001.png`, `0002.png`, … yeterli)
- Renderer'ın kare sayısını API'ye bildirmesi
- PNG için history (ZIP geçmişi — yalnızca `latest.zip` tutulur; karmaşıklık/depolama oranı kötü)

---

## Mimari

Wave1 boru hattının doğrudan genişletmesidir; yeni bileşen eklenmez.

```
RenderOptionsDialog  →  API validator (zod enum)  →  Redis job
    ↓                                                    ↓
  2 yeni seçenek                               render_args.py (sabit sözlük)
                                                         ↓
                                               worker.py (render + ZIP)
                                                         ↓
                                               latest.<ext>  →  API serve
                                                         ↓
                                               App.vue (video | img | <a>)
```

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `services/api/src/compiler/validator.ts` | `format` enum: `'png'` ve `'webm_transparent'` ekle |
| `services/renderer/render_args.py` | `FORMAT_FLAGS` + `FORMAT_EXT` satırı |
| `services/renderer/worker.py` | PNG kare dizini bul → zip → `latest.zip` yaz; history prune'a `.zip` ekle |
| `services/api/src/util/renderFiles.ts` | `RENDER_EXTS` + `CONTENT_TYPES` + `RENDER_FILE_RE`'ye `zip` ekle |
| `services/web/src/components/RenderOptionsDialog.vue` | 2 yeni `<option>` |
| `services/web/src/components/App.vue` (render tamamlandı diyaloğu) | ZIP için `<a download>` dalı |
| `services/api/tests/render_args.test.ts` | 2 yeni format için `build_render_args` testleri |
| `services/api/tests/compiler.test.ts` | `png`/`webm_transparent` allowlist testleri |

---

## Detay: render_args.py

```python
FORMAT_FLAGS = {
    "mp4":              [],
    "gif":              ["--format", "gif"],
    "webm":             ["--format", "webm"],
    "png":              ["--format", "png"],
    "webm_transparent": ["--format", "webm", "--transparent"],
}

FORMAT_EXT = {
    "mp4":              "mp4",
    "gif":              "gif",
    "webm":             "webm",
    "png":              "zip",       # dizin → zip; ext=zip
    "webm_transparent": "webm",      # saydam WebM; ext=webm
}
```

`output_ext(payload)` zaten `FORMAT_EXT` üzerinden çalışıyor — değişiklik gerekmez.

---

## Detay: worker.py — PNG ZIP mantığı

Manim CE, `--format png` ile çalıştırıldığında kare dosyalarını şu yapıda yazar:
`<media_dir>/videos/<scene_file_stem>/<quality_dir>/<SceneName>/`
(Tam yol Manim sürümüne göre farklılık gösterebilir; implementasyon sırasında `glob` ile doğrula.)

Worker'a eklenmesi gereken mantık — `render_job` içinde, `output_video = find_output_video(...)` satırından önce:

```python
if ext == "zip":
    png_dir = find_output_png_dir(media_dir, scene_name)   # yeni yardımcı
    if png_dir:
        # Eski latest.zip'leri temizle
        for f in os.listdir(media_dir):
            if f.startswith("latest.") or (f.startswith("render_") and f.endswith(".zip")):
                os.remove(os.path.join(media_dir, f))
        import zipfile
        with zipfile.ZipFile(latest_link, "w", zipfile.ZIP_DEFLATED) as zf:
            for png in sorted(glob.glob(os.path.join(png_dir, "*.png"))):
                zf.write(png, os.path.basename(png))
        return {"ok": True, "stdout": ..., "stderr": ..., "outputPath": latest_link, "exitCode": 0}
    # png_dir bulunamadıysa → normal hata dönüşü
```

`find_output_png_dir` — `find_output_video`'nun dizin arayan kardeşi:
```python
def find_output_png_dir(media_dir: str, scene_name: str) -> str | None:
    patterns = [
        f"{media_dir}/videos/**/{scene_name}",
        f"{media_dir}/images/**/{scene_name}",
        f"{media_dir}/**/{scene_name}",
    ]
    for pattern in patterns:
        matches = [m for m in glob.glob(pattern, recursive=True) if os.path.isdir(m)]
        if matches:
            return max(matches, key=os.path.getmtime)
    return None
```

PNG için history dosyaları tutulmaz (ZIP boyutu büyük, depolama verimsiz). Mevcut history prune kodu `.zip` içermeyen tuple ile çalışır — değişiklik gerekmez.

---

## Detay: renderFiles.ts

```ts
export const RENDER_EXTS = ['mp4', 'gif', 'webm', 'zip'] as const;

const CONTENT_TYPES = {
  mp4:  'video/mp4',
  gif:  'image/gif',
  webm: 'video/webm',
  zip:  'application/zip',
};

const RENDER_FILE_RE = /^[\w.-]+\.(mp4|gif|webm|zip)$/;
```

---

## Detay: RenderOptionsDialog.vue

Format `<select>` seçeneklerine ekleme:
```html
<option value="png">PNG Frames (ZIP)</option>
<option value="webm_transparent">WebM (Saydam)</option>
```

---

## Detay: App.vue — tamamlandı diyaloğu

Mevcut mantık:
```
format=gif → <img>
diğer      → <video>
```

Yeni mantık:
```
format=gif              → <img>
format=png              → <a href="..." download="frames.zip">ZIP İndir</a>
format=mp4|webm|webm_transparent → <video>
```

`getLatestUrl(projectId, ext)` zaten `ext` parametresiyle çalışıyor; PNG için `ext='zip'` geçilir.

---

## Test Stratejisi

- **render_args unit (Python):** `build_render_args({'options':{'format':'png',...}})` → `['--format','png',...]` içeriyor; `output_ext` → `'zip'`. Aynısı `webm_transparent` için.
- **API compiler testleri:** `parseRenderOptions({format:'png',...})` başarılı; `parseRenderOptions({format:'invalid',...})` hata fırlatır.
- **render_args.test.ts (Node):** Mevcut test dosyasına 2 yeni case.

ZIP mantığı ve frontend render diyaloğu için otomatik test yok (Docker + tarayıcı gerektirir); smoke-test listesi plan dosyasına girecek.

---

## Güvenlik

- `format` zod enum allowlist'e girecek (`'png'`, `'webm_transparent'`) — kullanıcı değeri argv'ye interpolate edilmez.
- ZIP içeriği yalnızca Manim'in yazdığı PNG'lerden oluşur; `zipfile.write(png, os.path.basename(png))` yol geçişini önler.
- `RENDER_FILE_RE` ZIP dosya adı için de `/^[\w.-]+\.zip$/` koşuluna uymak zorunda.

---

## Riskler

| Risk | Azaltma |
|---|---|
| Manim'in PNG çıktı dizin yolu sürümden sürüme değişebilir | `find_output_png_dir` birden çok glob pattern dener; bulamazsa hata mesajı açık |
| `--transparent` bayrağı Manim CE 0.19'da desteklenmeyebilir | Renderer Dockerfile'daki Manim sürümüne karşı kontrol edilmeli; plan adımına not ekle |
| `webm_transparent`'ın çıktı uzantısı `webm` — mevcut `webm` ile `latest.webm`'i ezebilir | `render_job` zaten tüm `latest.*` varyantlarını temizliyor; sıraya alınmış iş yoksa sorun değil |
