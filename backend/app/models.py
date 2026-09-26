"""データモデル。プロジェクト1件＝画像から動画完成までの1本分。"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Item(BaseModel):
    """言い換え1件（×質問→○質問）。"""

    scene: str = Field(description="場面の見出し（例：切り出す）")
    x: Optional[str] = Field(default=None, description="避けたい言い方。最後の項目などでは無し可")
    o: str = Field(description="推奨する言い方")
    tag: str = Field(description="この言い換えの原則タグ")
    xr: Optional[str] = Field(default=None, description="×に対する相手の短い返答")
    or_: list[str] = Field(default_factory=list, alias="or", description="○に対する相手の返答（2〜4文）")

    model_config = {"populate_by_name": True}


class Content(BaseModel):
    """画像から抽出した動画の中身。"""

    title: str
    subtitle: str
    items: list[Item]
    principles: list[str]


class Scene(BaseModel):
    """構成表の1行。kind=title/item/ending。"""

    kind: Literal["title", "item", "ending"]
    motion: str = ""
    narration: str = ""
    caption: str = ""
    duration: float = 7.5


class Project(BaseModel):
    id: str
    status: Literal["uploaded", "extracted", "structured", "rendering", "rendered", "failed"] = "uploaded"
    images: list[str] = Field(default_factory=list)
    content: Optional[Content] = None
    scenes: list[Scene] = Field(default_factory=list)
    concept: Literal["a"] = "a"
    video: Optional[str] = None
    error: Optional[str] = None
    extractor: Optional[str] = None


class RenderJob(BaseModel):
    project_id: str
    state: Literal["queued", "running", "encoding", "done", "failed"] = "queued"
    frames_done: int = 0
    frames_total: int = 0
    error: Optional[str] = None
