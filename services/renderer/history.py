"""Render history helpers for the renderer worker."""

from __future__ import annotations

import os
import shutil

HISTORY_LIMIT = 5


def rotate_render_history(media_dir: str, latest_path: str, ext: str, limit: int = HISTORY_LIMIT) -> None:
    """Rotate numbered render history files.

    Keeps render_1.<ext> as the newest copy and shifts older copies up to
    render_<limit>.<ext>. PNG ZIP outputs are intentionally skipped by the
    caller.
    """
    if limit <= 0:
        return
    if ext == "zip":
        return

    def slot_path(idx: int) -> str:
        return os.path.join(media_dir, f"render_{idx}.{ext}")

    # Shift the older slots first so we never overwrite a source before it is moved.
    for idx in range(limit, 0, -1):
        src = slot_path(idx)
        dst = slot_path(idx + 1)
        if idx == limit:
            if os.path.exists(src) or os.path.islink(src):
                os.remove(src)
            continue
        if os.path.exists(src) or os.path.islink(src):
            if os.path.exists(dst) or os.path.islink(dst):
                os.remove(dst)
            os.replace(src, dst)

    if os.path.exists(slot_path(1)) or os.path.islink(slot_path(1)):
        os.remove(slot_path(1))
    shutil.copy2(latest_path, slot_path(1))
