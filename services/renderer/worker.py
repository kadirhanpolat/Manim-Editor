"""
Manim Studio Renderer Worker

Listens to Redis queue for render jobs, executes Manim, and stores results.
"""

import glob
import json
import os
import shutil
import subprocess
import time
import uuid
import zipfile

import redis

from history import rotate_render_history
from safety import resolve_scene_file, terminate_process_tree
from render_args import FORMAT_EXT, build_render_args, output_ext

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATA_DIR = os.environ.get("DATA_DIR", "/data")
WORKER_ID = os.environ.get("WORKER_ID") or os.environ.get("HOSTNAME") or f"worker-{uuid.uuid4().hex[:8]}"
WORKER_KEY = f"render:worker:{WORKER_ID}"
HEARTBEAT_INTERVAL = 5
MAX_RENDER_SECONDS = 600

# The renderer runs as root and writes render output to the shared /data volume.
# Default umask (022) makes new dirs root:755, so the API container (runs as the
# unprivileged `node` user) cannot delete render output (DELETE /api/projects/:id
# -> EACCES). umask(0) makes everything the worker + the manim subprocess create
# world-writable (dirs 777 / files 666), so any container sharing /data can clean
# it up. The volume is already chmod 777 by the init service, so this only widens
# the renderer's own output to match.
os.umask(0o000)

# Connect to Redis
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def heartbeat(status: str = "idle", job_id: str | None = None, **extra: str) -> None:
    """Persist worker liveness and current activity."""
    mapping = {
        "workerId": WORKER_ID,
        "status": status,
        "jobId": job_id or "",
        "heartbeatMs": str(int(time.time() * 1000)),
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    for key, value in extra.items():
        if value is not None:
            mapping[key] = str(value)
    try:
        r.hset(WORKER_KEY, mapping=mapping)
        r.expire(WORKER_KEY, 300)
    except Exception as e:
        print(f"[renderer] Heartbeat update failed: {e}")


def cancel_requested(job_id: str | None) -> bool:
    """Check whether the API requested cancellation for the current job."""
    if not job_id:
        return False
    try:
        return r.hget(f"render:job:{job_id}", "cancelRequested") == "1"
    except Exception as e:
        print(f"[renderer] Cancel check failed for {job_id}: {e}")
        return False


def find_output_video(media_dir: str, scene_name: str, ext: str = "mp4") -> str | None:
    """Find the rendered output file in Manim's output structure."""
    # Manim outputs to: media_dir/videos/<scene_file>/<quality>/<SceneName>.<ext>
    patterns = [
        f"{media_dir}/videos/**/{scene_name}.{ext}",
        f"{media_dir}/videos/**/{scene_name}*.{ext}",
        f"{media_dir}/**/{scene_name}*.{ext}",
    ]

    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            # Return the most recently modified
            return max(matches, key=os.path.getmtime)

    return None


def find_output_png_dir(media_dir: str, scene_name: str) -> str | None:
    """Find the directory holding Manim's PNG frame output.

    With --format png, manim CE writes frames as
    <media_dir>/images/<module_name>/<SceneName><frame>.png - scene-prefixed
    files inside the module's images dir; there is no per-scene directory.
    """
    patterns = [
        f"{media_dir}/images/**/{scene_name}*.png",
        f"{media_dir}/**/{scene_name}*.png",
    ]

    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            newest = max(matches, key=os.path.getmtime)
            return os.path.dirname(newest)

    return None


def render_job(payload: dict, job_id: str | None = None) -> dict:
    """Execute a render job and return the result."""
    project_id = payload["projectId"]
    scene_name = payload.get("sceneName", "MainScene")
    ext = output_ext(payload)

    # Paths - honor explicit sceneFile from payload if provided, but never let it
    # escape the shared data directory.
    relative_scene = payload.get("sceneFile")
    scene_file = resolve_scene_file(DATA_DIR, relative_scene if isinstance(relative_scene, str) else None, project_id)
    media_dir = os.path.join(DATA_DIR, "renders", project_id)
    latest_link = os.path.join(media_dir, f"latest.{ext}")

    # Ensure output directory exists
    os.makedirs(media_dir, exist_ok=True)

    if cancel_requested(job_id):
        return {
            "ok": False,
            "canceled": True,
            "error": "Render canceled before start",
            "stdout": "",
            "stderr": "Render canceled before start",
        }

    # Validate scene file exists
    if not os.path.exists(scene_file):
        return {
            "ok": False,
            "error": f"Scene file not found: {scene_file}",
            "stdout": "",
            "stderr": f"Scene file not found: {scene_file}",
        }

    # Clean up old renders to prevent stale output
    # Delete videos + images directories to force fresh render output
    # (images would otherwise leak previous frames into the PNG ZIP)
    for stale_sub in ("videos", "images"):
        stale_dir = os.path.join(media_dir, stale_sub)
        if os.path.exists(stale_dir):
            try:
                shutil.rmtree(stale_dir)
                print(f"[render] Cleaned old renders from {stale_dir}")
            except Exception as e:
                print(f"[render] Warning: Could not clean old renders: {e}")

    # Ensure audio assets directory is accessible for manim-voiceover
    os.makedirs(os.path.join(DATA_DIR, "assets", "audio"), exist_ok=True)

    # Build manim command - flags come exclusively from fixed dict lookups
    cmd = [
        "manim",
        *build_render_args(payload),
        scene_file,
        scene_name,
        "--media_dir",
        media_dir,
        "--flush_cache",  # Clear stale cache but still use caching for speed
    ]

    print(f"[render] Running: {' '.join(cmd)}")

    process: subprocess.Popen[str] | None = None
    stdout_text = ""
    stderr_text = ""
    start_time = time.monotonic()

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.path.dirname(scene_file),
            start_new_session=True,
        )

        while True:
            try:
                stdout_text, stderr_text = process.communicate(timeout=HEARTBEAT_INTERVAL)
                break
            except subprocess.TimeoutExpired:
                if cancel_requested(job_id):
                    terminate_process_tree(process)
                    stdout_text, stderr_text = process.communicate()
                    return {
                        "ok": False,
                        "canceled": True,
                        "error": "Render canceled",
                        "stdout": stdout_text[-8000:] if stdout_text else "",
                        "stderr": stderr_text[-8000:] if stderr_text else "Render canceled",
                    }
                heartbeat("running", job_id, phase="rendering", projectId=project_id, sceneName=scene_name)
                if time.monotonic() - start_time >= MAX_RENDER_SECONDS:
                    terminate_process_tree(process)
                    stdout_text, stderr_text = process.communicate()
                    return {
                        "ok": False,
                        "error": "Render timeout (10 minutes exceeded)",
                        "stdout": stdout_text[-8000:] if stdout_text else "",
                        "stderr": stderr_text[-8000:] if stderr_text else "Render timeout (10 minutes exceeded)",
                    }

        # PNG sequence: zip the frame directory and return early
        if ext == "zip":
            png_dir = find_output_png_dir(media_dir, scene_name)
            if png_dir:
                # Remove every latest.* variant so "latest" is unambiguous
                for old_ext in set(FORMAT_EXT.values()):
                    old_link = os.path.join(media_dir, f"latest.{old_ext}")
                    if os.path.exists(old_link) or os.path.islink(old_link):
                        os.remove(old_link)
                with zipfile.ZipFile(latest_link, "w", zipfile.ZIP_DEFLATED) as zf:
                    frame_glob = os.path.join(png_dir, f"{scene_name}*.png")
                    for png in sorted(glob.glob(frame_glob)):
                        zf.write(png, os.path.basename(png))
                print(f"[render] PNG frames zipped to: {latest_link}")
                return {
                    "ok": process.returncode == 0,
                    "stdout": stdout_text[-8000:] if stdout_text else "",
                    "stderr": stderr_text[-8000:] if stderr_text else "",
                    "outputPath": latest_link,
                    "exitCode": process.returncode,
                }
            # No PNG dir found - fall through to error path
            return {
                "ok": False,
                "error": f"PNG output directory not found in {media_dir}",
                "stdout": stdout_text[-8000:] if stdout_text else "",
                "stderr": stderr_text[-8000:] if stderr_text else "",
                "exitCode": process.returncode,
            }

        # Find the output video
        output_video = find_output_video(media_dir, scene_name, ext)

        if output_video and os.path.exists(output_video):
            # Remove every latest.* variant so "latest" is unambiguous
            # (iterate extensions, not format names - png maps to zip)
            for old_ext in set(FORMAT_EXT.values()):
                old_link = os.path.join(media_dir, f"latest.{old_ext}")
                if os.path.exists(old_link) or os.path.islink(old_link):
                    os.remove(old_link)

            # Copy instead of symlink for Docker compatibility
            shutil.copy2(output_video, latest_link)

            print(f"[render] Output saved to: {latest_link}")

        # Rotate numbered history copies (keep last 5).
        if output_video and os.path.exists(output_video):
            rotate_render_history(media_dir, latest_link, ext)

        return {
            "ok": process.returncode == 0,
            "stdout": stdout_text[-8000:] if stdout_text else "",
            "stderr": stderr_text[-8000:] if stderr_text else "",
            "outputPath": latest_link if output_video else None,
            "exitCode": process.returncode,
        }

    except Exception as e:
        if process and process.poll() is None:
            terminate_process_tree(process)
        return {
            "ok": False,
            "error": str(e),
            "stdout": stdout_text[-8000:] if stdout_text else "",
            "stderr": str(e),
        }


def main():
    """Main worker loop."""
    print("[renderer] Starting worker...")
    print(f"[renderer] Redis: {REDIS_URL}")
    print(f"[renderer] Data dir: {DATA_DIR}")
    print(f"[renderer] Worker id: {WORKER_ID}")

    # Ensure base directories exist
    os.makedirs(os.path.join(DATA_DIR, "projects"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "assets"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "renders"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "assets", "audio"), exist_ok=True)

    heartbeat("idle")
    print("[renderer] Waiting for jobs on render:queue...")

    while True:
        try:
            heartbeat("idle")
            # Block waiting for job (5 second timeout to allow graceful shutdown)
            job = r.blpop("render:queue", timeout=5)

            if not job:
                continue

            _, raw = job
            payload = json.loads(raw)
            job_id = payload.get("jobId")

            if not job_id:
                print("[renderer] Job missing jobId, skipping")
                continue

            print(f"[renderer] Processing job: {job_id}")

            # Update job status to running
            if cancel_requested(job_id):
                r.hset(
                    f"render:job:{job_id}",
                    mapping={
                        "status": "canceled",
                        "completedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "error": "Render canceled before start",
                        "workerId": WORKER_ID,
                    },
                )
                heartbeat("idle")
                print(f"[renderer] Job {job_id} canceled before start")
                continue

            r.hset(
                f"render:job:{job_id}",
                mapping={
                    "status": "running",
                    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "workerId": WORKER_ID,
                },
            )
            heartbeat("running", job_id, phase="starting")

            # Execute render
            result = render_job(payload, job_id)

            # Update job with result
            if result.get("canceled"):
                status = "canceled"
            else:
                status = "completed" if result["ok"] else "failed"
            r.hset(
                f"render:job:{job_id}",
                mapping={
                    "status": status,
                    "completedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "stdout": str(result.get("stdout") or ""),
                    "stderr": str(result.get("stderr") or ""),
                    "outputPath": str(result.get("outputPath") or ""),
                    "error": str(result.get("error") or ""),
                    "workerId": WORKER_ID,
                },
            )
            heartbeat("idle")

            print(f"[renderer] Job {job_id} {status}")

        except redis.exceptions.ConnectionError as e:
            print(f"[renderer] Redis connection error: {e}")
            time.sleep(5)
        except json.JSONDecodeError as e:
            print(f"[renderer] Invalid job JSON: {e}")
        except KeyboardInterrupt:
            print("[renderer] Shutting down...")
            break
        except Exception as e:
            print(f"[renderer] Unexpected error in main loop: {e}")
            import traceback

            traceback.print_exc()
            time.sleep(1)


if __name__ == "__main__":
    main()
