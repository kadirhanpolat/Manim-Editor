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
import zipfile

import redis

from render_args import FORMAT_EXT, build_render_args, output_ext

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATA_DIR = os.environ.get("DATA_DIR", "/data")

# The renderer runs as root and writes render output to the shared /data volume.
# Default umask (022) makes new dirs root:755, so the API container (runs as the
# unprivileged `node` user) cannot delete render output (DELETE /api/projects/:id
# → EACCES). umask(0) makes everything the worker + the manim subprocess create
# world-writable (dirs 777 / files 666), so any container sharing /data can clean
# it up. The volume is already chmod 777 by the init service, so this only widens
# the renderer's own output to match.
os.umask(0o000)

# Connect to Redis
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)


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
    <media_dir>/images/<module_name>/<SceneName><frame>.png — scene-prefixed
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


def render_job(payload: dict) -> dict:
    """Execute a render job and return the result."""
    project_id = payload["projectId"]
    scene_name = payload.get("sceneName", "MainScene")
    ext = output_ext(payload)

    # Paths — honor explicit sceneFile from payload if provided
    relative_scene = payload.get("sceneFile")
    if relative_scene:
        scene_file = os.path.join(DATA_DIR, relative_scene)
    else:
        scene_file = os.path.join(DATA_DIR, "projects", project_id, "scene.py")
    media_dir = os.path.join(DATA_DIR, "renders", project_id)
    latest_link = os.path.join(media_dir, f"latest.{ext}")

    # Ensure output directory exists
    os.makedirs(media_dir, exist_ok=True)

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

    # Build manim command — flags come exclusively from fixed dict lookups
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

    # Execute manim
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            cwd=os.path.dirname(scene_file),
        )

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

        # Find the output video
        output_video = find_output_video(media_dir, scene_name, ext)

        if output_video and os.path.exists(output_video):
            # Remove every latest.* variant so "latest" is unambiguous
            # (iterate extensions, not format names — png maps to zip)
            for old_ext in set(FORMAT_EXT.values()):
                old_link = os.path.join(media_dir, f"latest.{old_ext}")
                if os.path.exists(old_link) or os.path.islink(old_link):
                    os.remove(old_link)

            # Copy instead of symlink for Docker compatibility
            shutil.copy2(output_video, latest_link)

            print(f"[render] Output saved to: {latest_link}")

        # Save a timestamped copy for history (keep last 5)
        if output_video and os.path.exists(output_video):
            timestamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
            history_path = os.path.join(media_dir, f"render_{timestamp}.{ext}")
            shutil.copy2(output_video, history_path)

            # Prune: keep only the 5 most recent history files
            history_files = sorted(
                [
                    f
                    for f in os.listdir(media_dir)
                    if f.startswith("render_") and f.endswith((".mp4", ".gif", ".webm"))
                ],
                reverse=True,
            )
            for old in history_files[5:]:
                try:
                    os.remove(os.path.join(media_dir, old))
                except Exception:
                    pass

        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout[-8000:] if result.stdout else "",
            "stderr": result.stderr[-8000:] if result.stderr else "",
            "outputPath": latest_link if output_video else None,
            "exitCode": result.returncode,
        }

    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": "Render timeout (10 minutes exceeded)",
            "stdout": "",
            "stderr": "Render timeout (10 minutes exceeded)",
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "stdout": "", "stderr": str(e)}


def main():
    """Main worker loop."""
    print("[renderer] Starting worker...")
    print(f"[renderer] Redis: {REDIS_URL}")
    print(f"[renderer] Data dir: {DATA_DIR}")

    # Ensure base directories exist
    os.makedirs(os.path.join(DATA_DIR, "projects"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "assets"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "renders"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "assets", "audio"), exist_ok=True)

    print("[renderer] Waiting for jobs on render:queue...")

    while True:
        try:
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
            r.hset(
                f"render:job:{job_id}",
                mapping={
                    "status": "running",
                    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
            )

            # Execute render
            result = render_job(payload)

            # Update job with result
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
                },
            )

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
