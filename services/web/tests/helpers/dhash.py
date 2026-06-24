"""Perceptual difference-hash (dHash) of an image, for render regression checks.

Prints a 256-bit hash as 64 hex chars. Uses Pillow, which Manim already ships,
so no extra dependency. A 16x16 grid (vs the classic 8x8) keeps enough spatial
detail that small high-contrast shapes on a dark Manim background still register
distinctly; autocontrast first spreads the shape's luminance across the range.
dHash is tolerant of antialiasing noise but shifts on structural change — the
right signal for "did our render output change unintentionally" (NOT a
cross-engine parity check).

Usage:  python dhash.py <image-path>
"""

import sys
from PIL import Image, ImageOps


def dhash(path: str, size: int = 16) -> str:
    img = Image.open(path).convert("L")
    # Spread luminance so a sparse bright shape on a dark field is not averaged away.
    img = ImageOps.autocontrast(img)
    img = img.resize((size + 1, size), Image.LANCZOS)
    px = img.load()
    bits = 0
    for y in range(size):
        for x in range(size):
            bits = (bits << 1) | (1 if px[x, y] > px[x + 1, y] else 0)
    return format(bits, "0{}x".format(size * size // 4))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("usage: python dhash.py <image-path>\n")
        sys.exit(2)
    print(dhash(sys.argv[1]))
