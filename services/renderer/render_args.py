"""Pure mapping from validated render options to manim CLI argv entries.

The API validates ``format``/``resolution``/``fps`` against zod enum
allowlists (services/api/src/compiler/validator.ts) before a job is
enqueued; this module only maps those values through FIXED dict lookups.
User input is never string-formatted into a CLI flag (argument-injection
posture — see CLAUDE.md "Security posture").

Import-free (stdlib only) so it can be smoke-checked on any host:
    python -c "import sys; sys.path.insert(0, 'services/renderer'); \
               from render_args import build_render_args; \
               print(build_render_args({'quality': 'high'}))"

Keep FORMAT_EXT in sync with RENDER_EXTS in
services/api/src/util/renderFiles.ts.
"""

# Legacy quality presets (payloads without an "options" object).
QUALITY_FLAGS = {
    "low": "-ql",  # 854x480 15fps
    "medium": "-qm",  # 1280x720 30fps
    "high": "-qh",  # 1920x1080 60fps
    "production": "-qp",  # 2560x1440 60fps
    "4k": "-qk",  # 3840x2160 60fps
}

# (resolution, fps) combos that exactly match a manim quality preset.
# Emitting the single preset flag keeps the default argv byte-identical to
# the legacy command and avoids relying on -r/--fps overriding -q.
PRESET_QUALITY = {
    ("854x480", 15): "-ql",
    ("1280x720", 30): "-qm",
    ("1920x1080", 60): "-qh",
    ("2560x1440", 60): "-qp",
    ("3840x2160", 60): "-qk",
}

RESOLUTION_FLAGS = {
    "854x480": ["-r", "854,480"],
    "1280x720": ["-r", "1280,720"],
    "1920x1080": ["-r", "1920,1080"],
    "2560x1440": ["-r", "2560,1440"],
    "3840x2160": ["-r", "3840,2160"],
}

FPS_FLAGS = {
    15: ["--fps", "15"],
    30: ["--fps", "30"],
    60: ["--fps", "60"],
}

FORMAT_FLAGS = {
    "mp4":              [],                                          # manim default
    "gif":              ["--format", "gif"],
    "webm":             ["--format", "webm"],
    "png":              ["--format", "png"],
    "webm_transparent": ["--format", "webm", "--transparent"],
}

FORMAT_EXT = {
    "mp4":              "mp4",
    "gif":              "gif",
    "webm":             "webm",
    "png":              "zip",   # frame dizisi → zip
    "webm_transparent": "webm",  # alfa kanallı webm
}


def output_ext(payload: dict) -> str:
    """Output file extension for a job payload (defaults to mp4)."""
    options = payload.get("options")
    if not isinstance(options, dict):
        return "mp4"
    return FORMAT_EXT.get(options.get("format"), "mp4")


def build_render_args(payload: dict) -> list:
    """Build the manim CLI flag segment for a render job payload.

    Returns the flags inserted between ``manim`` and the scene file.
    - No ``options`` in the payload -> historical single quality flag.
    - Options matching a quality preset -> that single ``-q*`` flag
      (mp4/1920x1080/60 therefore yields exactly ``["-qh"]``).
    - Any other combo -> ``-qh`` + explicit ``-r``/``--fps`` overrides.
    """
    options = payload.get("options")
    if not isinstance(options, dict):
        return [QUALITY_FLAGS.get(payload.get("quality", "medium"), "-qm")]

    resolution = options.get("resolution", "1920x1080")
    fps = options.get("fps", 60)
    fmt = options.get("format", "mp4")

    preset = PRESET_QUALITY.get((resolution, fps))
    if preset is not None:
        args = [preset]
    else:
        args = (
            ["-qh"]
            + RESOLUTION_FLAGS.get(resolution, RESOLUTION_FLAGS["1920x1080"])
            + FPS_FLAGS.get(fps, FPS_FLAGS[60])
        )
    return args + FORMAT_FLAGS.get(fmt, [])
