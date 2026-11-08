from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "crewpulse-vision-engine"
    host: str = "0.0.0.0"
    port: int = 8000

    # When true, skip DeepFace and return deterministic stubs (CI without weights).
    vision_stub: bool = False

    detector_backend: str = "retinaface"
    embedding_model: str = "Facenet512"
    # DeepFace creates `<DEEPFACE_HOME>/.deepface/weights` (default home dir).
    deepface_home: str = str(Path.home())

    face_min_size_px: int = 80
    # Normalized blur score 0 sharp → 1 blurry; reject above this.
    face_max_blur: float = 0.65
    face_min_luminance: float = 0.15
    face_max_luminance: float = 0.92

    # Passive PAD (presentation attack detection) before embed.
    pad_enabled: bool = True
    # Live score 0 spoof → 1 live; reject below this for payroll-grade punches.
    pad_min_score: float = 0.45

    # Heavy PPE / mask occlusion → assisted fallback (not silent false reject).
    occlusion_enabled: bool = True
    # Occlusion score 0 clear → 1 heavy; at/above this, skip embed and signal assisted path.
    occlusion_max_score: float = 0.55


@lru_cache
def get_settings() -> Settings:
    return Settings()
