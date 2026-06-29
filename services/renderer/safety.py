from __future__ import annotations

import os
import signal
from pathlib import Path
from subprocess import Popen


def _is_safe_segment(value: str) -> bool:
    return bool(value) and len(value) < 256 and value == value.strip() and "/" not in value and "\\" not in value and ".." not in value


def resolve_scene_file(data_dir: str, relative_scene: str | None, project_id: str | None) -> str:
    """Resolve a render scene file and ensure it stays inside the data dir."""
    base = Path(data_dir).resolve()
    if project_id is not None and not _is_safe_segment(project_id):
        raise ValueError(f"Unsafe project id: {project_id}")
    if relative_scene:
        candidate = (base / relative_scene).resolve()
    elif project_id:
        candidate = (base / "projects" / project_id / "scene.py").resolve()
    else:
        raise ValueError("scene file path is required")

    if candidate != base and base not in candidate.parents:
        raise ValueError(f"Unsafe scene file path: {candidate}")

    return str(candidate)


def terminate_process_tree(process: Popen[str]) -> None:
    """Terminate a spawned render process group, then fall back to kill()."""
    try:
        pgid = os.getpgid(process.pid)
        os.killpg(pgid, signal.SIGKILL)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass
