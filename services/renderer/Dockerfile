FROM manimcommunity/manim:stable

WORKDIR /app

# Ensure Python output is unbuffered for real-time logging
ENV PYTHONUNBUFFERED=1

# Install into image venv as root (base image runs as non-root and cannot write to /opt/venv)
# NOTE: pin setuptools<81 — manim-voiceover imports pkg_resources, which setuptools>=81 removed.
# The manimcommunity/manim:stable base ships setuptools 82 (Python 3.14), so manim fails to even
# start ("ModuleNotFoundError: No module named 'pkg_resources'") without this pin.
USER root
RUN pip install --no-cache-dir "setuptools<81" redis==5.0.8 manim-fonts==0.5.0 "manim-voiceover[gtts]>=0.3.4"

# Create fonts cache directory (use $HOME since container may not run as root)
RUN mkdir -p $HOME/.cache/manim-fonts

# Copy worker script
COPY render_args.py /app/render_args.py
COPY worker.py /app/worker.py

CMD ["python", "/app/worker.py"]
