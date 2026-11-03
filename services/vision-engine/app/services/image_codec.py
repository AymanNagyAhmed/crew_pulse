"""Decode probe images without logging biometric pixels."""

from __future__ import annotations

import base64
import re

import cv2
import numpy as np

_DATA_URL = re.compile(r"^data:image/[^;]+;base64,", re.IGNORECASE)


def decode_image_base64(image_base64: str) -> np.ndarray:
    raw = _DATA_URL.sub("", image_base64.strip())
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception as exc:  # noqa: BLE001 — surface as ValueError to callers
        raise ValueError("invalid base64 image") from exc
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("could not decode image bytes")
    return image


def encode_image_base64(path: str) -> str:
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode("ascii")
