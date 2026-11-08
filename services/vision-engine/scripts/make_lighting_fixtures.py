"""Generate dark/bright face crops for C2 quality-gate tests."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

FIX = Path(__file__).resolve().parents[1] / "tests" / "fixtures"


def main() -> None:
    src = cv2.imread(str(FIX / "sample_face.jpg"))
    if src is None:
        raise SystemExit("sample_face.jpg missing")
    h, w = src.shape[:2]
    face = src[h // 8 : h * 7 // 8, w // 8 : w * 7 // 8].copy()
    face = cv2.resize(face, (160, 180))
    # Keep high-frequency detail so blur gate does not fire before luminance.
    noise = np.random.default_rng(42).integers(0, 25, face.shape, dtype=np.uint8)
    dark = np.clip(face.astype(np.float32) * 0.05 + noise * 0.15, 0, 40).astype(
        np.uint8
    )
    # Overexpose so mean luminance exceeds default face_max_luminance (0.92).
    bright = np.clip(face.astype(np.float32) * 8.0 + 180 + noise, 240, 255).astype(
        np.uint8
    )
    cv2.imwrite(str(FIX / "face_too_dark.jpg"), dark)
    cv2.imwrite(str(FIX / "face_too_bright.jpg"), bright)
    print(
        "dark_mean",
        round(float(dark.mean()) / 255.0, 4),
        "bright_mean",
        round(float(bright.mean()) / 255.0, 4),
    )


if __name__ == "__main__":
    main()
