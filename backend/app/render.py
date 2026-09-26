"""描画ジョブ。Canvas の render(t) を Playwright で1フレームずつ実行し、ffmpeg に流して無音MP4を作る。

- フレームはページ内で canvas.toDataURL(JPEG) にして30枚ずつまとめて受け取り、ffmpeg の標準入力へ送る
- ジョブ状態はメモリ上に保持し、API から進捗を読む
"""
from __future__ import annotations

import base64
import json
import subprocess
import threading
from pathlib import Path

from . import store
from .models import RenderJob
from .structure import timeline

RENDERER = Path(__file__).resolve().parent / "renderer"
FPS = 30
BATCH = 30

JOBS: dict[str, RenderJob] = {}
_lock = threading.Lock()

BATCH_JS = """async ([t0,n,fps]) => { const cv=document.querySelector('canvas'); const out=[];
 for(let k=0;k<n;k++){ window.render((t0+k)/fps); out.push(cv.toDataURL('image/jpeg',0.92).slice(23)); } return out; }"""


def build_page(pid: str) -> Path:
    """プロジェクトのデータを埋め込んだ描画用HTMLを書き出す。"""
    p = store.load(pid)
    if p.content is None or not p.scenes:
        raise ValueError("構成が未確定です")
    data = p.content.model_dump(by_alias=True)
    tl = timeline(p.scenes)
    html = (RENDERER / f"{p.concept}.html").read_text(encoding="utf-8")
    inject = (f"<script>window.__DATA__={json.dumps(data, ensure_ascii=False)};"
              f"window.__TL__={json.dumps(tl)};</script>\n")
    html = html.replace('<script src="core.js"></script>', inject + '<script src="core.js"></script>')
    out = store.project_dir(pid) / "render.html"
    out.write_text(html, encoding="utf-8")
    (store.project_dir(pid) / "core.js").write_text((RENDERER / "core.js").read_text(encoding="utf-8"), encoding="utf-8")
    return out


def _run(pid: str, max_seconds: float | None) -> None:
    job = JOBS[pid]
    p = store.load(pid)
    try:
        page_path = build_page(pid)
        total = timeline(p.scenes)["total"]
        if max_seconds:
            total = min(total, max_seconds)
        n = int(total * FPS)
        job.frames_total, job.state = n, "running"
        out = store.project_dir(pid) / "silent.mp4"
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg",
             "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", str(out)],
            stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            b = pw.chromium.launch()
            pg = b.new_page(viewport={"width": 1080, "height": 1920})
            errors: list[str] = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(page_path.as_uri())
            pg.evaluate("window.ready()")
            for f0 in range(0, n, BATCH):
                k = min(BATCH, n - f0)
                for b64 in pg.evaluate(BATCH_JS, [f0, k, FPS]):
                    ff.stdin.write(base64.b64decode(b64))
                job.frames_done = f0 + k
                if errors:
                    raise RuntimeError("描画エラー: " + errors[0])
            b.close()
        job.state = "encoding"
        ff.stdin.close()
        if ff.wait() != 0:
            raise RuntimeError("ffmpeg失敗: " + ff.stderr.read().decode(errors="replace")[-500:])
        p = store.load(pid)
        p.video, p.status, p.error = "silent.mp4", "rendered", None
        store.save(p)
        job.state = "done"
    except Exception as e:  # ジョブの失敗は状態として返す
        job.state, job.error = "failed", str(e)
        p = store.load(pid)
        p.status, p.error = "failed", str(e)
        store.save(p)


def start(pid: str, max_seconds: float | None = None, wait: bool = False) -> RenderJob:
    with _lock:
        cur = JOBS.get(pid)
        if cur and cur.state in ("queued", "running", "encoding"):
            return cur
        JOBS[pid] = RenderJob(project_id=pid)
    p = store.load(pid)
    p.status = "rendering"
    store.save(p)
    th = threading.Thread(target=_run, args=(pid, max_seconds), daemon=True)
    th.start()
    if wait:
        th.join()
    return JOBS[pid]
