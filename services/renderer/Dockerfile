FROM manimcommunity/manim:stable

WORKDIR /app

# Ensure Python output is unbuffered for real-time logging
ENV PYTHONUNBUFFERED=1

# Install into image venv as root (base image runs as non-root and cannot write to /opt/venv)
# NOTE: pin setuptools<81 — manim-voiceover imports pkg_resources, which setuptools>=81 removed.
# The manimcommunity/manim:stable base ships setuptools 82 (Python 3.14), so manim fails to even
# start ("ModuleNotFoundError: No module named 'pkg_resources'") without this pin.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends sox libsox-fmt-all \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "setuptools<81" redis==5.0.8 manim-fonts==0.5.0 "manim-voiceover[gtts]>=0.3.4"

# Pre-fetch the fonts codegen registers most often into manim-fonts' cache
# ($HOME/.cache/Manim-Fonts): Roboto (the text default) plus Arimo/Tinos/
# Cousine/Gelasio, the metric-compatible clones Arial/Times/Courier/Georgia
# render through (renderFontFor in @manim/codegen). Renders using them then
# work offline and skip a per-job download. Best effort: a build without
# network still succeeds and those fonts are downloaded at render time.
RUN python -c "from manim_fonts import RegisterFont; [RegisterFont(f).__enter__() for f in ('Roboto', 'Arimo', 'Tinos', 'Cousine', 'Gelasio')]" \
    || echo "WARNING: font prefetch failed (offline build?) - fonts will download at render time"

# Copy worker script
COPY render_args.py /app/render_args.py
COPY history.py /app/history.py
COPY isolation.py /app/isolation.py
COPY safety.py /app/safety.py
COPY worker.py /app/worker.py

CMD ["python", "/app/worker.py"]
