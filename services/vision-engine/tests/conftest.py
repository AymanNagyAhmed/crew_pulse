import os
from collections.abc import Iterator

# Default unit/stub tests must not download model weights.
os.environ.setdefault("VISION_STUB", "true")

import pytest
from fastapi.testclient import TestClient

from app.core.settings import get_settings
from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    get_settings.cache_clear()
    os.environ["VISION_STUB"] = "true"
    get_settings.cache_clear()
    with TestClient(create_app()) as test_client:
        yield test_client
