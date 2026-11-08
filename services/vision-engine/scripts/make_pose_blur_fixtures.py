"""Generate motion-blur and extreme-yaw face crops for C6 capture-QA tests."""

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
    face = cv2.resize(src[h // 8 : h * 7 // 8, w // 8 : w * 7 // 8].copy(), (160, 180))

    # Motion / soft-focus blur — Laplacian variance collapses.
    blurry = cv2.GaussianBlur(face, (31, 31), 0)
    blurry = cv2.GaussianBlur(blurry, (21, 21), 0)

    # Extreme yaw proxy: dense vertical edges on the left, smoothed right half.
    mid = face.shape[1] // 2
    left = face[:, :mid].copy()
    for x in range(0, mid, 3):
        left[:, x] = np.clip(left[:, x].astype(np.int16) + 40, 0, 255).astype(np.uint8)
    right = cv2.GaussianBlur(face[:, mid:], (51, 51), 0)
    right = cv2.addWeighted(right, 0.85, face[:, mid:], 0.15, 0)
    yawed = np.concatenate([left, right], axis=1)

    cv2.imwrite(str(FIX / "face_too_blurry.jpg"), blurry)
    cv2.imwrite(str(FIX / "face_yaw_extreme.jpg"), yawed)
    print("wrote face_too_blurry.jpg face_yaw_extreme.jpg")


if __name__ == "__main__":
    main()
