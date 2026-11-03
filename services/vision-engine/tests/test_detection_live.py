import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.settings import get_settings
from app.main import create_app
from app.services.detection import DetectionService, warm_models
from app.schemas.vision import DetectRequest

FIXTURE = Path(__file__).parent / "fixtures" / "sample_face.jpg"


@pytest.fixture(scope="module")
def live_client():
    import os
    from collections.abc import Iterator

    os.environ["VISION_STUB"] = "false"
    get_settings.cache_clear()
    settings = get_settings()
    if settings.vision_stub:
        pytest.skip("VISION_STUB=true — live detection disabled")

    with TestClient(create_app()) as test_client:
        yield test_client


def test_fixture_detect_returns_box_and_embedding_dim(live_client: TestClient) -> None:
    assert FIXTURE.is_file(), "missing tests/fixtures/sample_face.jpg"
    image_b64 = base64.b64encode(FIXTURE.read_bytes()).decode("ascii")
    response = live_client.post("/v1/detect", json={"image_base64": image_b64})
    assert response.status_code == 200
    body = response.json()
    assert body["stub"] is False
    assert len(body["faces"]) >= 1
    face = body["faces"][0]
    assert face["bbox"]["width"] >= 40
    assert face["bbox"]["height"] >= 40
    assert face["embedding_dim"] >= 128
    assert "embedding" not in face


def test_detection_service_discards_vector() -> None:
    get_settings.cache_clear()
    settings = get_settings()
    if settings.vision_stub:
        pytest.skip("VISION_STUB=true")
    warm_models(settings)
    image_b64 = base64.b64encode(FIXTURE.read_bytes()).decode("ascii")
    result = DetectionService(settings).detect(DetectRequest(image_base64=image_b64))
    dumped = result.model_dump()
    assert "embedding" not in dumped
    for face in dumped["faces"]:
        assert "embedding" not in face
        assert set(face.keys()) >= {
            "face_ref",
            "bbox",
            "detection_score",
            "quality",
            "embedding_dim",
        }
    assert result.faces[0].embedding_dim > 0
