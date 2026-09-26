import io, os, time
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SVS_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    import importlib, app.store, app.main
    importlib.reload(app.store); importlib.reload(app.main)
    return TestClient(app.main.app)


def upload(client, name="a.png"):
    return client.post("/api/projects", files=[("files", (name, io.BytesIO(b"\x89PNG fake"), "image/png"))])


def test_upload_extracts_and_structures(client):
    r = upload(client)
    assert r.status_code == 201
    p = r.json()
    assert p["status"] == "structured" and p["extractor"] == "sample"
    assert len(p["scenes"]) == len(p["content"]["items"]) + 2
    assert p["scenes"][0]["kind"] == "title" and p["scenes"][-1]["kind"] == "ending"


def test_rejects_unsupported_format(client):
    r = upload(client, "a.gif")
    assert r.status_code == 400


def test_structure_update_validates_scene_count(client):
    p = upload(client).json()
    body = {"content": p["content"], "scenes": p["scenes"][:-1], "concept": "a"}
    assert client.put(f"/api/projects/{p['id']}/structure", json=body).status_code == 400


def test_structure_update_and_item_removal(client):
    p = upload(client).json()
    c = p["content"]; c["items"] = c["items"][:3]
    scenes = [p["scenes"][0]] + p["scenes"][1:4] + [p["scenes"][-1]]
    r = client.put(f"/api/projects/{p['id']}/structure", json={"content": c, "scenes": scenes, "concept": "a"})
    assert r.status_code == 200 and len(r.json()["content"]["items"]) == 3


def test_path_traversal_blocked(client):
    p = upload(client).json()
    assert client.get(f"/api/projects/{p['id']}/files/../../etc/passwd").status_code == 404


def test_unknown_project(client):
    assert client.get("/api/projects/nothere").status_code == 404


def test_render_short_clip(client):
    """3秒分だけ実描画してMP4ができることを確認（Playwright使用）。"""
    import app.render as render
    p = upload(client).json()
    job = render.start(p["id"], max_seconds=3, wait=True)
    assert job.state == "done", job.error
    assert job.frames_done == 90
    from app import store
    assert (store.project_dir(p["id"]) / "silent.mp4").stat().st_size > 10_000
