from functools import lru_cache

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
    # Models load in 3.3; readiness can stay green until then.
    models_ready: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
