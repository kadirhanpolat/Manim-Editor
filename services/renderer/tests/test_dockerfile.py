"""Every local module the worker imports must be copied into the image.

worker.py has twice gained a sibling-module import (history.py, then
safety.py) without a matching COPY in the Dockerfile; the image then crashes
at startup with ModuleNotFoundError and every render waits forever.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _local_imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module.split(".")[0])
        elif isinstance(node, ast.Import):
            names.update(alias.name.split(".")[0] for alias in node.names)
    return {n for n in names if (ROOT / f"{n}.py").is_file()}


def _copied_files() -> set[str]:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    return {Path(m).name for m in re.findall(r"^COPY\s+(\S+)\s+\S+", dockerfile, re.M)}


def test_worker_local_imports_are_copied_into_the_image() -> None:
    copied = _copied_files()
    pending = ["worker"]
    seen: set[str] = set()
    while pending:  # follow imports transitively
        mod = pending.pop()
        if mod in seen:
            continue
        seen.add(mod)
        pending.extend(_local_imports(ROOT / f"{mod}.py"))
    missing = sorted(f"{m}.py" for m in seen if f"{m}.py" not in copied)
    assert not missing, f"Dockerfile does not COPY: {missing}"
