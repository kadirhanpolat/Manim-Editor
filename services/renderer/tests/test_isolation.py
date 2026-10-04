from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import isolation  # noqa: E402
from isolation import (  # noqa: E402
    DEFAULT_LIMITS,
    RenderLimits,
    child_env,
    describe_failure,
    load_limits,
    make_preexec,
    read_tail,
    run_limited,
)

MB = 1024 * 1024


# --- load_limits -----------------------------------------------------------


def test_load_limits_defaults_when_env_is_empty() -> None:
    assert load_limits({}) == DEFAULT_LIMITS
    assert DEFAULT_LIMITS.wall_seconds == 600


def test_load_limits_reads_env_overrides() -> None:
    limits = load_limits(
        {
            "RENDER_TIMEOUT_SECONDS": "120",
            "RENDER_MEMORY_MB": "1024",
            "RENDER_CPU_SECONDS": "300",
            "RENDER_MAX_FILE_MB": "512",
        }
    )
    assert limits == RenderLimits(
        wall_seconds=120,
        memory_bytes=1024 * MB,
        cpu_seconds=300,
        file_size_bytes=512 * MB,
    )


def test_load_limits_zero_disables_a_kernel_limit() -> None:
    limits = load_limits({"RENDER_MEMORY_MB": "0", "RENDER_CPU_SECONDS": "0"})
    assert limits.memory_bytes is None
    assert limits.cpu_seconds is None


@pytest.mark.parametrize("bad", ["abc", "-5", "1.5", ""])
def test_load_limits_ignores_invalid_values(bad: str) -> None:
    limits = load_limits({"RENDER_TIMEOUT_SECONDS": bad, "RENDER_MEMORY_MB": bad})
    assert limits.wall_seconds == DEFAULT_LIMITS.wall_seconds
    assert limits.memory_bytes == DEFAULT_LIMITS.memory_bytes


def test_load_limits_never_disables_the_wall_clock() -> None:
    # A render must not be able to run forever: 0 keeps the default timeout.
    assert load_limits({"RENDER_TIMEOUT_SECONDS": "0"}).wall_seconds == 600


# --- make_preexec ----------------------------------------------------------


class _FakeResource:
    RLIMIT_DATA = 2
    RLIMIT_CPU = 0
    RLIMIT_FSIZE = 1
    RLIM_INFINITY = -1

    def __init__(self) -> None:
        self.calls: list[tuple[int, tuple[int, int]]] = []

    def setrlimit(self, which: int, value: tuple[int, int]) -> None:
        self.calls.append((which, value))


def test_make_preexec_sets_each_configured_rlimit(monkeypatch) -> None:
    fake = _FakeResource()
    monkeypatch.setattr(isolation, "resource", fake)
    limits = RenderLimits(
        wall_seconds=60, memory_bytes=100 * MB, cpu_seconds=30, file_size_bytes=10 * MB
    )
    preexec = make_preexec(limits)
    assert preexec is not None
    preexec()
    # CPU: soft limit sends SIGXCPU, hard limit (+5 s) kills outright.
    assert sorted(fake.calls) == sorted(
        [
            (fake.RLIMIT_DATA, (100 * MB, 100 * MB)),
            (fake.RLIMIT_CPU, (30, 35)),
            (fake.RLIMIT_FSIZE, (10 * MB, 10 * MB)),
        ]
    )


def test_make_preexec_skips_disabled_limits(monkeypatch) -> None:
    fake = _FakeResource()
    monkeypatch.setattr(isolation, "resource", fake)
    limits = RenderLimits(
        wall_seconds=60, memory_bytes=None, cpu_seconds=None, file_size_bytes=None
    )
    assert make_preexec(limits) is None


def test_make_preexec_is_none_without_resource_module(monkeypatch) -> None:
    monkeypatch.setattr(isolation, "resource", None)  # e.g. Windows dev machine
    assert make_preexec(DEFAULT_LIMITS) is None


# --- describe_failure ------------------------------------------------------

LIMITS = RenderLimits(
    wall_seconds=600, memory_bytes=3072 * MB, cpu_seconds=1800, file_size_bytes=4096 * MB
)


def test_describe_failure_success_is_none() -> None:
    assert describe_failure(0, "", LIMITS) is None


def test_describe_failure_cpu_limit() -> None:
    reason, message = describe_failure(-24, "", LIMITS)  # SIGXCPU
    assert reason == "cpu_limit"
    assert "1800" in message


def test_describe_failure_file_size_limit() -> None:
    reason, message = describe_failure(-25, "", LIMITS)  # SIGXFSZ
    assert reason == "file_size_limit"
    assert "4096 MB" in message


def test_describe_failure_file_too_large_in_stderr() -> None:
    # CPython ignores SIGXFSZ, so a Python render sees EFBIG instead of dying.
    stderr = "OSError: [Errno 27] File too large\n"
    assert describe_failure(1, stderr, LIMITS)[0] == "file_size_limit"


def test_describe_failure_memory_error_in_stderr() -> None:
    stderr = "Traceback (most recent call last):\n  ...\nMemoryError\n"
    reason, message = describe_failure(1, stderr, LIMITS)
    assert reason == "memory_limit"
    assert "3072 MB" in message


def test_describe_failure_process_limit() -> None:
    # The container's pids cap (docker-compose.yml) refuses new threads.
    stderr = "RuntimeError: can't start new thread\n"
    reason, message = describe_failure(1, stderr, LIMITS)
    assert reason == "process_limit"
    assert "thread" in message


def test_describe_failure_sigkill_is_treated_as_out_of_memory() -> None:
    # Nobody but the kernel (OOM killer / hard CPU limit) SIGKILLs the render
    # when the worker did not time it out or cancel it.
    reason, _ = describe_failure(-9, "", LIMITS)
    assert reason == "killed"


def test_describe_failure_plain_error_is_render_error() -> None:
    reason, message = describe_failure(1, "NameError: name 'x' is not defined", LIMITS)
    assert reason == "render_error"
    assert "exit code 1" in message


# --- read_tail -------------------------------------------------------------


def test_read_tail_returns_whole_small_output() -> None:
    with tempfile.TemporaryFile() as f:
        f.write(b"hello\nworld\n")
        assert read_tail(f, 1000) == "hello\nworld\n"


def test_read_tail_keeps_only_the_last_bytes() -> None:
    with tempfile.TemporaryFile() as f:
        f.write(b"x" * 10_000 + b"END")
        tail = read_tail(f, 100)
        assert tail.endswith("END")
        assert len(tail) == 100


def test_read_tail_survives_a_cut_multibyte_character() -> None:
    with tempfile.TemporaryFile() as f:
        f.write("ğüş".encode())  # 6 bytes, 2 per char
        assert read_tail(f, 5).endswith("üş")


# --- real kernel enforcement (Linux CI only) ------------------------------

needs_rlimits = pytest.mark.skipif(
    isolation.resource is None or sys.platform != "linux", reason="needs Linux rlimits"
)


@needs_rlimits
def test_memory_limit_stops_an_oversized_allocation() -> None:
    limits = RenderLimits(
        wall_seconds=30, memory_bytes=256 * MB, cpu_seconds=None, file_size_bytes=None
    )
    proc = subprocess.run(
        [sys.executable, "-c", "b = bytearray(1024 * 1024 * 1024)"],
        preexec_fn=make_preexec(limits),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert describe_failure(proc.returncode, proc.stderr, limits)[0] == "memory_limit"


@needs_rlimits
def test_cpu_limit_stops_a_busy_loop() -> None:
    limits = RenderLimits(wall_seconds=30, memory_bytes=None, cpu_seconds=1, file_size_bytes=None)
    proc = subprocess.run(
        [sys.executable, "-c", "while True: pass"],
        preexec_fn=make_preexec(limits),
        capture_output=True,
        timeout=30,
    )
    assert describe_failure(proc.returncode, "", limits)[0] == "cpu_limit"


@needs_rlimits
def test_file_size_limit_stops_runaway_output(tmp_path: Path) -> None:
    limits = RenderLimits(wall_seconds=30, memory_bytes=None, cpu_seconds=None, file_size_bytes=MB)
    target = tmp_path / "big.bin"
    proc = subprocess.run(
        [sys.executable, "-c", f"open({str(target)!r}, 'wb').write(b'x' * 4 * 1024 * 1024)"],
        preexec_fn=make_preexec(limits),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert describe_failure(proc.returncode, proc.stderr, limits)[0] == "file_size_limit"


# --- run_limited -----------------------------------------------------------

FAST = RenderLimits(wall_seconds=60, memory_bytes=None, cpu_seconds=None, file_size_bytes=None)


def _py(code: str) -> list[str]:
    return [sys.executable, "-c", code]


def test_run_limited_captures_output_and_exit_code(tmp_path: Path) -> None:
    result = run_limited(
        _py("import sys; print('hello'); print('oops', file=sys.stderr); sys.exit(3)"),
        cwd=str(tmp_path),
        limits=FAST,
    )
    assert result.returncode == 3
    assert result.stdout.strip() == "hello"
    assert result.stderr.strip() == "oops"
    assert result.stopped is None


def test_run_limited_keeps_only_the_log_tail(tmp_path: Path) -> None:
    # A scene that prints megabytes must not be buffered whole in the worker.
    result = run_limited(
        _py("print('x' * 5_000_000 + 'END')"), cwd=str(tmp_path), limits=FAST, log_tail_bytes=1000
    )
    assert result.returncode == 0
    assert len(result.stdout) <= 1000
    assert result.stdout.strip().endswith("END")


def test_run_limited_stops_at_the_wall_clock(tmp_path: Path) -> None:
    limits = RenderLimits(wall_seconds=1, memory_bytes=None, cpu_seconds=None, file_size_bytes=None)
    start = time.monotonic()
    result = run_limited(
        _py("import time; time.sleep(60)"), cwd=str(tmp_path), limits=limits, tick_seconds=0.2
    )
    assert result.stopped == "timeout"
    assert time.monotonic() - start < 15


def test_run_limited_stops_when_canceled_and_ticks_meanwhile(tmp_path: Path) -> None:
    ticks: list[int] = []
    result = run_limited(
        _py("import time; time.sleep(60)"),
        cwd=str(tmp_path),
        limits=FAST,
        should_cancel=lambda: len(ticks) >= 2,
        on_tick=lambda: ticks.append(1),
        tick_seconds=0.2,
    )
    assert result.stopped == "canceled"
    assert len(ticks) == 2


# --- review follow-ups -----------------------------------------------------


def test_load_limits_ignores_non_ascii_digits() -> None:
    # "²".isdigit() is True but int("²") raises: must not crash the worker.
    assert load_limits({"RENDER_MEMORY_MB": "²"}).memory_bytes == DEFAULT_LIMITS.memory_bytes


def test_describe_failure_only_reads_the_end_of_stderr() -> None:
    # A scene that merely printed "MemoryError" earlier failed for another reason.
    stderr = "MemoryError mentioned in a log line\n" + "frame\n" * 20 + "NameError: name 'x'\n"
    assert describe_failure(1, stderr, LIMITS)[0] == "render_error"


def test_describe_failure_generic_eagain_is_not_a_process_limit() -> None:
    stderr = "BlockingIOError: [Errno 11] Resource temporarily unavailable\n"
    assert describe_failure(1, stderr, LIMITS)[0] == "render_error"


@pytest.mark.parametrize("code", [-6, -11])
def test_describe_failure_native_crash_mentions_memory(code: int) -> None:
    # cairo/ffmpeg/numpy abort or segfault when an allocation fails in C.
    reason, message = describe_failure(code, "", LIMITS)
    assert reason == "crashed"
    assert "memory" in message


def test_child_env_caps_native_thread_pools() -> None:
    env = child_env({"PATH": "/bin"})
    assert env["PATH"] == "/bin"
    for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        assert env[name] == "2"


def test_child_env_keeps_an_explicit_setting() -> None:
    base = {"OMP_NUM_THREADS": "8"}
    env = child_env(base)
    assert env["OMP_NUM_THREADS"] == "8"
    assert base == {"OMP_NUM_THREADS": "8"}  # not mutated


def test_run_limited_passes_the_env(tmp_path: Path) -> None:
    result = run_limited(
        _py("import os; print(os.environ['MARKER'])"),
        cwd=str(tmp_path),
        limits=FAST,
        env={**child_env(dict(os.environ)), "MARKER": "ok"},
    )
    assert result.stdout.strip() == "ok"
