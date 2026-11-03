from fastapi.testclient import TestClient

# 1x1 PNG
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_detect_stub_returns_face_metadata(client: TestClient) -> None:
    response = client.post(
        "/v1/detect",
        json={"image_base64": _TINY_PNG_B64, "venue_id": "venue_demo"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["stub"] is True
    assert len(body["faces"]) == 1
    face = body["faces"][0]
    assert face["embedding_dim"] == 512
    assert "embedding" not in face
    assert face["bbox"]["width"] > 0
    assert 0.0 <= face["detection_score"] <= 1.0


def test_match_stub_returns_decision_without_vectors(client: TestClient) -> None:
    response = client.post(
        "/v1/match",
        json={
            "image_base64": _TINY_PNG_B64,
            "venue_id": "venue_demo",
            "shift_id": "shift_morning",
            "top_k": 3,
            "candidate_worker_ids": ["worker_a", "worker_b"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["stub"] is True
    assert body["decision"] in {"matched", "no_match", "needs_review"}
    assert body["candidates"][0]["worker_id"] == "worker_a"
    assert "embedding" not in body
    dumped = response.text
    assert "embedding_vector" not in dumped


def test_openapi_lists_detect_and_match(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/v1/detect" in paths
    assert "post" in paths["/v1/detect"]
    assert "/v1/match" in paths
    assert "post" in paths["/v1/match"]
    assert paths["/v1/detect"]["post"]["operationId"] == "vision.detect"
    assert paths["/v1/match"]["post"]["operationId"] == "vision.match"
