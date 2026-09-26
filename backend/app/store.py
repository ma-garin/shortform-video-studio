"""ファイルベースの保存領域。data/projects/<id>/ に project.json と素材を置く。"""
from __future__ import annotations

import json
import os
import threading
import uuid
from pathlib import Path

from .models import Project

DATA_DIR = Path(os.environ.get("SVS_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
_lock = threading.Lock()


def project_dir(pid: str) -> Path:
    if not pid.isalnum():
        raise ValueError("invalid project id")
    return DATA_DIR / "projects" / pid


def new_project() -> Project:
    pid = uuid.uuid4().hex[:12]
    project_dir(pid).mkdir(parents=True, exist_ok=True)
    p = Project(id=pid)
    save(p)
    return p


def save(p: Project) -> None:
    d = project_dir(p.id)
    d.mkdir(parents=True, exist_ok=True)
    with _lock:
        tmp = d / "project.json.tmp"
        tmp.write_text(p.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
        tmp.replace(d / "project.json")


def load(pid: str) -> Project:
    f = project_dir(pid) / "project.json"
    if not f.exists():
        raise FileNotFoundError(pid)
    return Project.model_validate(json.loads(f.read_text(encoding="utf-8")))


def list_projects() -> list[Project]:
    root = DATA_DIR / "projects"
    if not root.exists():
        return []
    out = []
    for d in sorted(root.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            out.append(load(d.name))
        except (FileNotFoundError, ValueError):
            continue
    return out
