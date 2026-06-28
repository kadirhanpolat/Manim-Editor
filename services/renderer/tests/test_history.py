from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from history import rotate_render_history


def test_rotate_render_history_shifts_and_copies(tmp_path: Path) -> None:
    media = tmp_path
    latest = media / "latest.mp4"
    latest.write_text("new")
    (media / "render_1.mp4").write_text("one")
    (media / "render_2.mp4").write_text("two")
    (media / "render_5.mp4").write_text("five")

    rotate_render_history(str(media), str(latest), "mp4", limit=5)

    assert (media / "render_1.mp4").read_text() == "new"
    assert (media / "render_2.mp4").read_text() == "one"
    assert (media / "render_3.mp4").read_text() == "two"
    assert (media / "render_4.mp4").exists() is False
    assert (media / "render_5.mp4").exists() is False


def test_rotate_render_history_rotates_png_zip(tmp_path: Path) -> None:
    media = tmp_path
    latest = media / "latest.zip"
    latest.write_text("zip-new")
    (media / "render_1.zip").write_text("one")
    (media / "render_2.zip").write_text("two")
    (media / "render_5.zip").write_text("five")

    rotate_render_history(str(media), str(latest), "zip", limit=5)

    assert (media / "render_1.zip").read_text() == "zip-new"
    assert (media / "render_2.zip").read_text() == "one"
    assert (media / "render_3.zip").read_text() == "two"
    assert not (media / "render_5.zip").exists()
