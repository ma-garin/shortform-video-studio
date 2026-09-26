"""API。画像アップロード → 内容抽出 → 構成編集 → 無音動画生成。"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import extract, render, store, structure
from .models import Content, Project, RenderJob, Scene

app = FastAPI(title="Shortform Video Studio")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

ALLOWED = {".png", ".jpg", ".jpeg", ".webp"}
MAX_BYTES = 15 * 1024 * 1024


def _get(pid: str) -> Project:
    try:
        return store.load(pid)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "プロジェクトが見つかりません")


@app.get("/api/health")
def health() -> dict:
    import os
    return {"ok": True, "extractor": "claude" if os.environ.get("ANTHROPIC_API_KEY") else "sample"}


@app.get("/api/projects")
def list_projects() -> list[Project]:
    return store.list_projects()


@app.post("/api/projects", status_code=201)
async def create_project(files: list[UploadFile] = File(...)) -> Project:
    if not files:
        raise HTTPException(400, "画像を1枚以上選んでください")
    p = store.new_project()
    d = store.project_dir(p.id) / "images"
    d.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, f in enumerate(files):
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED:
            raise HTTPException(400, f"対応していない形式です: {f.filename}（png/jpg/webp）")
        body = await f.read()
        if len(body) > MAX_BYTES:
            raise HTTPException(400, f"15MBを超えています: {f.filename}")
        path = d / f"{i:02d}{ext}"
        path.write_bytes(body)
        paths.append(path)
    p.images = [f"images/{x.name}" for x in paths]
    try:
        p.content, p.extractor = extract.extract(paths)
    except Exception as e:
        p.status, p.error = "failed", f"内容抽出に失敗しました: {e}"
        store.save(p)
        raise HTTPException(502, p.error)
    p.scenes = structure.build(p.content)
    p.status = "structured"
    store.save(p)
    return p


@app.get("/api/projects/{pid}")
def get_project(pid: str) -> Project:
    return _get(pid)


class StructureIn(BaseModel):
    content: Content
    scenes: list[Scene]
    concept: str = "a"


@app.put("/api/projects/{pid}/structure")
def update_structure(pid: str, body: StructureIn) -> Project:
    p = _get(pid)
    if len(body.scenes) != len(body.content.items) + 2:
        raise HTTPException(400, "シーン数は 項目数+2（タイトルとまとめ）である必要があります")
    if not 1 <= len(body.content.items) <= 8:
        raise HTTPException(400, "項目は1〜8件にしてください")
    if body.concept != "a":
        raise HTTPException(400, "現在選べるコンセプトはAのみです")
    p.content, p.scenes, p.concept = body.content, body.scenes, body.concept
    p.status, p.video = "structured", None
    store.save(p)
    return p


@app.post("/api/projects/{pid}/structure/reset")
def reset_structure(pid: str) -> Project:
    p = _get(pid)
    if p.content is None:
        raise HTTPException(400, "内容が未抽出です")
    p.scenes = structure.build(p.content)
    store.save(p)
    return p


@app.post("/api/projects/{pid}/render", status_code=202)
def start_render(pid: str) -> RenderJob:
    p = _get(pid)
    if p.content is None or not p.scenes:
        raise HTTPException(400, "構成が未確定です")
    return render.start(pid)


@app.get("/api/projects/{pid}/render")
def render_status(pid: str) -> RenderJob:
    _get(pid)
    job = render.JOBS.get(pid)
    if job is None:
        raise HTTPException(404, "描画ジョブがありません")
    return job


@app.get("/api/projects/{pid}/files/{name:path}")
def get_file(pid: str, name: str):
    base = store.project_dir(pid).resolve()
    f = (base / name).resolve()
    if base not in f.parents or not f.is_file():
        raise HTTPException(404, "ファイルがありません")
    return FileResponse(f)


_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="ui")
