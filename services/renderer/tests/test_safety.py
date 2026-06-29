from __future__ import annotations

import os
import signal
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from safety import resolve_scene_file, terminate_process_tree


def test_resolve_scene_file_stays_inside_data_dir(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    (data_dir / "projects" / "proj_1").mkdir(parents=True)
    safe = resolve_scene_file(str(data_dir), "projects/proj_1/scene.py", "proj_1")
    assert Path(safe) == data_dir / "projects" / "proj_1" / "scene.py"


def test_resolve_scene_file_rejects_escape(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    try:
        resolve_scene_file(str(data_dir), "../escape.py", None)
    except ValueError as err:
        assert "Unsafe scene file path" in str(err)
    else:
        raise AssertionError("expected unsafe path to be rejected")


def test_resolve_scene_file_rejects_unsafe_project_id(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    try:
        resolve_scene_file(str(data_dir), None, "../proj")
    except ValueError as err:
        assert "Unsafe project id" in str(err)
    else:
        raise AssertionError("expected unsafe project id to be rejected")


def test_terminate_process_tree_prefers_process_group(monkeypatch) -> None:
    calls: list[tuple[str, int]] = []

    class DummyProcess:
        pid = 1234

        def kill(self) -> None:  # pragma: no cover - fallback not expected
            calls.append(("kill", self.pid))

    monkeypatch.setattr(os, "getpgid", lambda pid: pid, raising=False)
    monkeypatch.setattr(os, "killpg", lambda pgid, sig: calls.append(("killpg", pgid)), raising=False)
    monkeypatch.setattr(signal, "SIGKILL", 9, raising=False)

    terminate_process_tree(DummyProcess())
    assert calls == [("killpg", 1234)]
