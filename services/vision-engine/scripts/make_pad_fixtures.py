"""Generate print / screen-replay face crops for C3 PAD tests."""

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

    # Print proxy: grayscale paper look with enough edges for quality blur gate.
    gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
    print_face = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    print_face = cv2.bilateralFilter(print_face, d=5, sigmaColor=40, sigmaSpace=40)
    # Sharpen slightly so face_max_blur still passes.
    blur = cv2.GaussianBlur(print_face, (0, 0), 1.0)
    print_face = cv2.addWeighted(print_face, 1.35, blur, -0.35, 0)

    # Replay proxy: strong every-other-row scan lines (phone/tablet screen).
    replay = face.copy().astype(np.int16)
    replay[0::2, :, :] = np.clip(replay[0::2, :, :] + 70, 0, 255)
    replay[1::2, :, :] = np.clip(replay[1::2, :, :] - 55, 0, 255)
    replay = replay.astype(np.uint8)
    replay = replay.astype(np.float32)
    replay[:, :, 1] = np.clip(replay[:, :, 1] * 1.08, 0, 255)
    replay = replay.astype(np.uint8)

    cv2.imwrite(str(FIX / "face_pad_print.jpg"), print_face)
    cv2.imwrite(str(FIX / "face_pad_replay.jpg"), replay)
    print("wrote face_pad_print.jpg face_pad_replay.jpg")


if __name__ == "__main__":
    main()
