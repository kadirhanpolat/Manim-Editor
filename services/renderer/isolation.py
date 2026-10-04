"""Resource limits for the manim render subprocess.

The container-level limits in docker-compose.yml (cpus / memory / pids) bound
the whole renderer; these per-process kernel limits bound one render job so a
runaway scene fails with a clear reason instead of OOM-killing the worker,
filling the disk, or spinning on after the worker itself has died.

Every limit is configurable through the environment (see ``load_limits``).
"""

from __future__ import annotations

import subprocess
import tempfile
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import IO, NamedTuple

from safety import terminate_process_tree

try:
    import resource
except ImportError:  # Windows dev machines: no rlimits, wall clock only
    resource = None  # type: ignore[assignment]

MB = 1024 * 1024

# Grace between the CPU soft limit (SIGXCPU) and the hard limit (SIGKILL).
CPU_HARD_GRACE_SECONDS = 5

# Native thread pools size themselves from the host's cores, not the
# container's CPU quota; on a many-core host their per-thread stacks and
# buffers would eat into RLIMIT_DATA. The render only gets 2 CPUs anyway.
NATIVE_THREAD_VARS = ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS")
NATIVE_THREADS = "2"

# Only the last lines of stderr decide the failure reason: the final
# exception, not something the scene happened to print earlier.
CLASSIFY_TAIL_LINES = 3

# Bytes of stdout/stderr kept per render (the job hash and the log dialog).
LOG_TAIL_BYTES = 8000

SIGABRT = 6
SIGKILL = 9
SIGSEGV = 11
SIGXCPU = 24
SIGXFSZ = 25


@dataclass(frozen=True)
class RenderLimits:
    """Per-render limits. ``None`` disables a kernel limit."""

    wall_seconds: int
    memory_bytes: int | None
    cpu_seconds: int | None
    file_size_bytes: int | None


# Container default is 2 CPUs / 4 GB: leave headroom for the worker itself.
DEFAULT_LIMITS = RenderLimits(
    wall_seconds=600,
    memory_bytes=3072 * MB,
    cpu_seconds=1800,
    file_size_bytes=4096 * MB,
)


def _parse_non_negative(raw: str | None) -> int | None:
    if raw is None:
        return None
    raw = raw.strip()
    # isascii(): "²".isdigit() is True but int("²") raises.
    if not (raw.isascii() and raw.isdigit()):
        if raw:
            print(f"[renderer] Ignoring invalid limit value: {raw!r}")
        return None
    return int(raw)


def _limit(env: Mapping[str, str], name: str, default: int | None, scale: int = 1) -> int | None:
    value = _parse_non_negative(env.get(name))
    if value is None:
        return default
    return value * scale if value > 0 else None


def load_limits(env: Mapping[str, str]) -> RenderLimits:
    """Read limits from the environment; invalid values keep the default.

    ``0`` disables a kernel limit, except the wall clock: a render must never be
    able to run forever, so ``RENDER_TIMEOUT_SECONDS=0`` keeps the default.
    """
    wall = _limit(env, "RENDER_TIMEOUT_SECONDS", DEFAULT_LIMITS.wall_seconds)
    return RenderLimits(
        wall_seconds=wall if wall is not None else DEFAULT_LIMITS.wall_seconds,
        memory_bytes=_limit(env, "RENDER_MEMORY_MB", DEFAULT_LIMITS.memory_bytes, MB),
        cpu_seconds=_limit(env, "RENDER_CPU_SECONDS", DEFAULT_LIMITS.cpu_seconds),
        file_size_bytes=_limit(env, "RENDER_MAX_FILE_MB", DEFAULT_LIMITS.file_size_bytes, MB),
    )


def make_preexec(limits: RenderLimits) -> Callable[[], None] | None:
    """Build a ``preexec_fn`` that applies the kernel limits in the child.

    RLIMIT_DATA (not RLIMIT_AS) caps memory: it counts heap and anonymous
    mappings but not the large address-space reservations numpy/cairo make,
    which would trip RLIMIT_AS long before real memory use is high.
    Returns ``None`` when there is nothing to apply.
    """
    if resource is None:
        return None
    rlimits: list[tuple[int, tuple[int, int]]] = []
    if limits.memory_bytes is not None:
        rlimits.append((resource.RLIMIT_DATA, (limits.memory_bytes, limits.memory_bytes)))
    if limits.cpu_seconds is not None:
        hard = limits.cpu_seconds + CPU_HARD_GRACE_SECONDS
        rlimits.append((resource.RLIMIT_CPU, (limits.cpu_seconds, hard)))
    if limits.file_size_bytes is not None:
        size = limits.file_size_bytes
        rlimits.append((resource.RLIMIT_FSIZE, (size, size)))
    if not rlimits:
        return None
    rlimit_module = resource

    def apply() -> None:
        for which, value in rlimits:
            rlimit_module.setrlimit(which, value)

    return apply


def child_env(base: Mapping[str, str]) -> dict[str, str]:
    """Environment for the render child: ``base`` plus native thread caps.

    An explicit setting in ``base`` wins; ``base`` itself is not modified.
    """
    return {**{name: NATIVE_THREADS for name in NATIVE_THREAD_VARS}, **base}


def _mb(value: int | None) -> str:
    return "unlimited" if value is None else f"{value // MB} MB"


def timeout_message(limits: RenderLimits) -> str:
    return (
        f"Render timed out after {limits.wall_seconds} s. "
        "Shorten the scene or raise RENDER_TIMEOUT_SECONDS."
    )


def describe_failure(returncode: int, stderr: str, limits: RenderLimits) -> tuple[str, str] | None:
    """Classify a finished render: ``(reason, message)`` or ``None`` on success.

    ``reason`` is a stable code stored on the job (``failureReason``); the
    message is what the render dialog shows.
    """
    if returncode == 0:
        return None
    lines = [line for line in stderr.splitlines() if line.strip()]
    tail = "\n".join(lines[-CLASSIFY_TAIL_LINES:])
    if returncode == -SIGXCPU:
        return (
            "cpu_limit",
            f"Render exceeded the CPU time limit ({limits.cpu_seconds} s of CPU). "
            "Simplify the scene or raise RENDER_CPU_SECONDS.",
        )
    if returncode == -SIGXFSZ or "File too large" in tail:
        return (
            "file_size_limit",
            f"Render output exceeded the file size limit ({_mb(limits.file_size_bytes)}). "
            "Lower the resolution or duration, or raise RENDER_MAX_FILE_MB.",
        )
    if "MemoryError" in tail or "Cannot allocate memory" in tail:
        return (
            "memory_limit",
            f"Render ran out of memory (limit {_mb(limits.memory_bytes)}). "
            "Simplify the scene or raise RENDER_MEMORY_MB.",
        )
    if "can't start new thread" in tail:
        return (
            "process_limit",
            "Render hit the process/thread limit of the renderer container. "
            "Reduce the threads or subprocesses the scene starts.",
        )
    if returncode == -SIGKILL:
        return (
            "killed",
            "Render process was killed by the system "
            "(most likely out of memory or a hard CPU limit).",
        )
    if returncode in (-SIGABRT, -SIGSEGV):
        return (
            "crashed",
            f"Render crashed (signal {-returncode}). If the scene is large, it may have run "
            f"out of memory (limit {_mb(limits.memory_bytes)}; raise RENDER_MEMORY_MB).",
        )
    return ("render_error", f"Manim failed with exit code {returncode}.")


def read_tail(stream: IO[bytes], max_bytes: int) -> str:
    """Return at most the last ``max_bytes`` of a binary log file as text.

    Render output goes to temp files instead of pipes so a scene that prints
    without end cannot grow the worker's memory; only the tail is kept.
    """
    stream.seek(0, 2)
    size = stream.tell()
    stream.seek(max(0, size - max_bytes))
    # "ignore" drops a multi-byte character cut in half at the start.
    return stream.read().decode("utf-8", errors="ignore")


class RunResult(NamedTuple):
    returncode: int
    stdout: str
    stderr: str
    stopped: str | None  # "timeout" / "canceled" when the worker stopped it


def _never() -> bool:
    return False


def _noop() -> None:
    return None


def run_limited(
    cmd: list[str],
    cwd: str,
    limits: RenderLimits,
    should_cancel: Callable[[], bool] = _never,
    on_tick: Callable[[], None] = _noop,
    tick_seconds: float = 5,
    log_tail_bytes: int = LOG_TAIL_BYTES,
    env: Mapping[str, str] | None = None,
) -> RunResult:
    """Run ``cmd`` under ``limits`` and return its exit code and log tails.

    The child gets its own session (so ``terminate_process_tree`` reaches every
    process it spawns) and the kernel limits from ``make_preexec``. Every
    ``tick_seconds`` the worker checks for cancellation and the wall clock and
    calls ``on_tick`` (heartbeat). Output goes to temp files, not pipes.
    """
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        process = subprocess.Popen(
            cmd,
            stdout=out,
            stderr=err,
            cwd=cwd,
            env=env,
            start_new_session=True,
            preexec_fn=make_preexec(limits),
        )
        stopped: str | None = None
        start = time.monotonic()
        try:
            while True:
                try:
                    process.wait(timeout=tick_seconds)
                    break
                except subprocess.TimeoutExpired:
                    if should_cancel():
                        stopped = "canceled"
                    elif time.monotonic() - start >= limits.wall_seconds:
                        stopped = "timeout"
                    if stopped:
                        terminate_process_tree(process)
                        process.wait()
                        break
                    on_tick()
        except BaseException:
            if process.poll() is None:
                terminate_process_tree(process)
                process.wait()
            raise
        return RunResult(
            returncode=process.returncode,
            stdout=read_tail(out, log_tail_bytes),
            stderr=read_tail(err, log_tail_bytes),
            stopped=stopped,
        )
