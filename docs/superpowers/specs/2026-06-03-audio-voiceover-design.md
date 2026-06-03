# Ses / Seslendirme (manim-voiceover) — Tasarım Spec

**Tarih:** 2026-06-03  
**Kapsam:** Clip düzeyinde ses desteği — dosya yükleme, gTTS ve Coqui TTS; auto/manual senkronizasyon; VoiceoverScene codegen entegrasyonu  
**Phase:** 3 — Özellik 1

---

## 1. Mimari

Mevcut 4 Docker servisine 1 yeni servis eklenir:

```
services/audio/        # YENİ: Python, gTTS + Coqui TTS işleyici
services/renderer/     # Mevcut: manim-voiceover paketi eklenir
services/api/          # Mevcut: audio job endpoint'leri eklenir
services/web/          # Mevcut: timeline audio track + Inspector "Ses" sekmesi
redis                  # Mevcut: audio job kuyruğu da buraya girer
```

**İş akışı:**

1. Kullanıcı clip'e ses ekler (dosya yükleme veya TTS metni girer)
2. API → Redis kuyruğuna `audio_job` koyar
3. `audio` servisi işler → `/data/assets/audio/<id>.wav` üretir
4. API, clip'in `audio.status` alanını `ready` olarak günceller (WebSocket push)
5. Render tetiklendiğinde renderer `.wav` dosyasını `VoiceoverScene` ile kullanır
6. manim-voiceover + ffmpeg ses ve videoyu birleştirir; son `.mp4` çıkar

**Coqui opsiyonelliği:**  
`docker-compose.yml`'de `profiles: ["coqui"]` ile tanımlanır. Varsayılan `docker compose up` Coqui'yi başlatmaz; `docker compose --profile coqui up` ile etkinleştirilir (~1.5 GB model indirmesi gerekir).

---

## 2. Veri Modeli

Her clip'e opsiyonel `audio` alanı eklenir. Alan yoksa clip sessiz kalır (mevcut davranış korunur).

```js
clip.audio = {
  type: 'file' | 'gtts' | 'coqui',      // ses kaynağı
  src: '/data/assets/audio/<id>.wav',    // üretilen veya yüklenen dosya yolu
  text: 'Merhaba dünya',                 // TTS tipler için zorunlu, file için boş
  lang: 'tr',                            // TTS dil kodu (BCP-47), varsayılan 'tr'
  syncMode: 'auto' | 'manual',           // senkronizasyon modu
  offset: 0.0,                           // manual modda başlangıç offseti (saniye)
  status: 'pending' | 'ready' | 'error', // audio job durumu
  duration: null                         // ready olduğunda doldurulur (saniye, float)
}
```

**syncMode davranışı:**
- `auto` — `audio.status` `ready` olduğunda `clip.duration` otomatik olarak `audio.duration`'a eşitlenir. Kullanıcı clip süresini elle değiştiremez (timeline'da resize devre dışı).
- `manual` — `clip.duration` bağımsız kalır. `offset` ile sesin başlangıcı kaydırılabilir.

**Kısıtlamalar:**
- Bir clip'e en fazla 1 ses bağlanabilir.
- `status: 'pending'` olan audio içeren projede render butonu kilitlenir; kullanıcıya uyarı gösterilir.
- `audio.src` her zaman `/data/assets/audio/` altındadır; dosya proje JSON'ından bağımsız volume'de saklanır.

---

## 3. Yeni Servis: `services/audio/`

```
services/audio/
  Dockerfile           # python:3.11-slim, gtts, coqui-tts (profil), redis-py
  worker.py            # Redis'ten job alır, ses üretir, tamamlandığını bildirir
  requirements.txt
```

**worker.py iş akışı:**

```python
# Redis'ten job al
job = { "id": "abc123", "type": "gtts"|"coqui"|"file", "text": "...", "lang": "tr" }

# Üret
if job["type"] == "gtts":
    from gtts import gTTS
    tts = gTTS(text=job["text"], lang=job["lang"])
    tts.save(f"/data/assets/audio/{job['id']}.mp3")
    # ffmpeg ile wav'a çevir
elif job["type"] == "coqui":
    # Coqui TTS inference → wav
    ...

# API'ye bildir (Redis pub veya HTTP callback)
# audio.status = 'ready', audio.duration = <float>
```

**Dosya yükleme (`type: 'file'`):**  
Audio servisi devreye girmez. API endpoint doğrudan dosyayı `/data/assets/audio/<id>.wav`'a kaydeder, süreyi ffprobe ile okur, `audio.status = 'ready'` olarak set eder.

---

## 4. API Değişiklikleri

```
POST /api/audio/upload          # Dosya yükleme — multipart/form-data
POST /api/audio/tts             # TTS job oluştur — { clipId, type, text, lang }
GET  /api/audio/:id/status      # Job durumu
DELETE /api/audio/:id           # Ses sil
```

**WebSocket bildirimi:**  
Mevcut `ws.js` altyapısı kullanılır. `audio_ready` ve `audio_error` event'leri eklenir:
```json
{ "event": "audio_ready", "clipId": "...", "duration": 2.34 }
```

---

## 5. Codegen & Renderer

### codegen.js

Projede herhangi bir clip'te `audio` alanı varsa base class `VoiceoverScene`'e yükseltilir:

```python
from manim_voiceover import VoiceoverScene
from manim_voiceover.services.gtts import GTTSService  # veya CoquiService

class GeneratedScene(VoiceoverScene):
    def construct(self):
        self.set_speech_service(GTTSService(lang="tr"))
```

Sesli her clip animasyonlarını `with self.voiceover(...)` bloğuna alır:

```python
# syncMode: 'auto'
with self.voiceover(audio="/data/assets/audio/abc123.wav") as tracker:
    self.play(FadeIn(obj), run_time=clip.duration)
    self.wait(tracker.duration - clip.duration)

# syncMode: 'manual', offset > 0
self.wait(clip.audio.offset)
with self.voiceover(audio="/data/assets/audio/abc123.wav"):
    self.play(...)
```

TTS tipler için `text=` parametresi kullanılır (manim-voiceover cache'ler):
```python
with self.voiceover(text="Merhaba dünya") as tracker:
    ...
```

### manim.js (client-side exporter)

`codegen.js` ile aynı semantiği yansıtır:
- `VoiceoverScene` import satırları
- `with self.voiceover(...)` blokları
- `set_speech_service(...)` çağrısı

**Her iki dosya senkron tutulacak** — yeni clip/obje tipi eklendiğinde her ikisi de güncellenir (mevcut convention).

### worker.py (renderer)

Render başlamadan önce `/data/assets/audio/` dizinindeki ses dosyaları render geçici dizinine sembolik link ile bağlanır; manim-voiceover bu yolu bulur. `manim-voiceover` paketi `requirements.txt`'e eklenir, Dockerfile güncellenir.

---

## 6. Frontend Değişiklikleri

### Timeline.vue

Her clip'in altına ince ses şeridi eklenir (audio alanı doluysa görünür):

| Durum | Görünüm |
|-------|---------|
| `pending` | Gri, animasyonlu yükleme çubuğu |
| `ready` | Mavi dalga ikonu + süre etiketi (ör. `2.3s`) |
| `error` | Kırmızı uyarı ikonu |

Şerit tıklandığında Inspector'da "Ses" sekmesi aktif olur.

`syncMode: 'auto'` durumunda timeline'da clip resize tutamacı gizlenir.

### PropertiesPanel.vue — Yeni "Ses" Sekmesi

```
[ Nesne ] [ Klip ] [ Ses ]
───────────────────────────
Kaynak:   ○ Dosya  ○ gTTS  ○ Coqui
─ Dosya seçildiyse ─────────────
  [Dosya Yükle]  filename.wav  ✓ 2.3s
─ TTS seçildiyse ────────────────
  Metin: [________________________]
  Dil:   [Türkçe ▾]
  [Oluştur]   ● hazır / ⟳ üretiliyor
─ Her zaman ─────────────────────
Sync:  ○ Otomatik  ○ Manuel
Offset: [0.0] s   ← yalnızca Manuel aktifse
[Sesi Kaldır]
```

**Dil seçenekleri (gTTS):** `tr`, `en`, `de`, `fr`, `es`, `ja` (genişletilebilir liste).

### App.vue / store

- `store.project` üzerindeki clip audio alanları `Vue.set` ile eklenir (Vue 2 reaktivite kuralı)
- `actions.setClipAudio(clipId, audioObj)` ve `actions.removeClipAudio(clipId)` eklenir
- WebSocket `audio_ready` / `audio_error` event'leri dinlenir; clip audio durumu güncellenir

---

## 7. Test Planı

| Test | Tür | Kapsam |
|------|-----|--------|
| `clip audio alanı ekleme/kaldırma` | Unit (Vitest) | store actions |
| `syncMode auto clip.duration güncelleme` | Unit (Vitest) | store + playback engine |
| `codegen VoiceoverScene üretimi` | Unit (Vitest) | codegen.js |
| `manim.js VoiceoverScene üretimi` | Engine (Node) | manim.js |
| `audio API upload endpoint` | Integration | API servis |
| `audio servisi gTTS job işleme` | Integration | audio worker |
| `render butonu pending audio'da kilitli` | Component (Vitest) | RenderPanel.vue |

---

## 8. Kapsam Dışı

- Ses dalga formu (waveform) görselleştirmesi timeline'da — scope dışı
- Çoklu ses per clip — scope dışı (bir clip = bir ses)
- Ses düzenleme (kesme, fade) — scope dışı
- Azure TTS, ElevenLabs vb. — scope dışı (gTTS + Coqui yeterli)
- 3D sahne ses desteği — scope dışı (Phase 3 ayrı kalemi)
