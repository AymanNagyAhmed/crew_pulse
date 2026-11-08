"""Generate masked / PPE-occluded face crops for C5 occlusion tests."""

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

    # Soft surgical-mask band over nose/mouth. Avoid even/odd row stripes so PAD
    # does not false-positive as screen replay before the occlusion gate runs.
    masked = face.astype(np.float32)
    y0 = int(masked.shape[0] * 0.42)
    color = np.array([205, 178, 148], dtype=np.float32)  # BGR soft blue-gray
    for i, row in enumerate(range(y0, masked.shape[0])):
        t = min(1.0, i / 12.0)
        fabric = 3.0 * np.sin(np.linspace(0, 6 * np.pi, masked.shape[1]))[:, None]
        fabric = np.repeat(fabric, 3, axis=1)
        target = color + fabric
        masked[row] = masked[row] * (1.0 - t) + target * t
    masked = np.clip(masked, 0, 255).astype(np.uint8)

    cv2.imwrite(str(FIX / "face_occluded_mask.jpg"), masked)
    print("wrote face_occluded_mask.jpg")


if __name__ == "__main__":
    main()
