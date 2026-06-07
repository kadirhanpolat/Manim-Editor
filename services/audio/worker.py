"""
Audio Worker — processes gTTS and Coqui TTS jobs from Redis.
Notifies API via HTTP when complete.
"""

import json
import os
import subprocess
import time
import urllib.request

import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATA_DIR = os.environ.get("DATA_DIR", "/data")
API_URL = os.environ.get("API_URL", "http://api:3000")
ENABLE_COQUI = os.environ.get("ENABLE_COQUI", "0") == "1"

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

if ENABLE_COQUI:
    from TTS.api import TTS as CoquiTTS

    _coqui = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
    print("[audio] Coqui TTS model loaded")


def audio_dir():
    d = os.path.join(DATA_DIR, "assets", "audio")
    os.makedirs(d, exist_ok=True)
    return d


def mp3_to_wav(mp3_path, wav_path):
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", mp3_path, wav_path], capture_output=True, timeout=60
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:500]}")


def get_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {path}: {result.stderr[:200]}")
    data = json.loads(result.stdout)
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "audio":
            return float(stream.get("duration", 0))
    return 0.0


def process_gtts(job):
    from gtts import gTTS

    d = audio_dir()
    mp3 = os.path.join(d, f"{job['jobId']}.mp3")
    wav = os.path.join(d, f"{job['jobId']}.wav")
    tts = gTTS(text=job["text"], lang=job.get("lang", "tr"))
    tts.save(mp3)
    try:
        mp3_to_wav(mp3, wav)
    finally:
        if os.path.exists(mp3):
            os.remove(mp3)
    return wav


def process_coqui(job):
    d = audio_dir()
    wav = os.path.join(d, f"{job['jobId']}.wav")
    _coqui.tts_to_file(text=job["text"], language=job.get("lang", "tr"), file_path=wav)
    return wav


def notify_api(job_id, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API_URL}/api/audio/{job_id}/complete",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[audio] API notification failed for {job_id}: {e}")


def process_job(job):
    job_id = job["jobId"]
    clip_id = job["clipId"]
    jtype = job["type"]

    print(f"[audio] Processing job {job_id}, type={jtype}")
    r.hSet(f"audio:job:{job_id}", "status", "running")

    try:
        if jtype == "gtts":
            wav = process_gtts(job)
        elif jtype == "coqui" and ENABLE_COQUI:
            wav = process_coqui(job)
        else:
            raise RuntimeError(f"Unsupported job type: {jtype}")

        duration = get_duration(wav)
        r.hSet(
            f"audio:job:{job_id}",
            mapping={"status": "ready", "duration": str(duration), "outputPath": wav},
        )
        notify_api(job_id, {"status": "ready", "clipId": clip_id, "duration": duration})
        print(f"[audio] Job {job_id} done, duration={duration:.2f}s")

    except Exception as e:
        print(f"[audio] Job {job_id} failed: {e}")
        r.hSet(f"audio:job:{job_id}", mapping={"status": "error", "error": str(e)})
        notify_api(job_id, {"status": "error", "clipId": clip_id, "error": str(e)})


def main():
    print(f"[audio] Worker started (coqui={'on' if ENABLE_COQUI else 'off'})")
    print(f"[audio] Redis: {REDIS_URL}, API: {API_URL}")
    os.makedirs(os.path.join(DATA_DIR, "assets", "audio"), exist_ok=True)

    queue_key = "audio:queue:coqui" if ENABLE_COQUI else "audio:queue:gtts"
    print(f"[audio] Listening on {queue_key}")

    while True:
        try:
            item = r.blpop(queue_key, timeout=5)
            if not item:
                continue
            _, raw = item
            job = json.loads(raw)
            process_job(job)
        except Exception as e:
            print(f"[audio] Worker loop error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    main()
