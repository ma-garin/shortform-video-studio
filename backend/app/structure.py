"""Content から構成表（シーン・動き・ナレーション・字幕・尺）の初期案を作る。

構成は「タイトル → 具体例×N → 共通原則のまとめ・保存」。
ナレーションの尺は5.5字/秒（ずんだもん話速1.05の実測）で見積もる。
"""
from __future__ import annotations

from .models import Content, Scene

CHARS_PER_SEC = 5.5  # ずんだもん話速1.05の実測（約5.5字/秒）


def _dur(text: str, minimum: float) -> float:
    return round(max(minimum, len(text) / CHARS_PER_SEC + 1.0), 1)


def build(content: Content) -> list[Scene]:
    n = len(content.items)
    scenes: list[Scene] = []
    intro = f"{content.subtitle}。{content.title.replace('選', 'つ')}を紹介します。"
    scenes.append(Scene(kind="title", narration=intro, caption=content.title,
                        motion="「大丈夫です」の吹き出しが縮んで消え、残り時間5:00→0:00、タイトルが1字ずつ立ち上がる",
                        duration=_dur(intro, 6.5)))
    for i, it in enumerate(content.items):
        if it.x:
            nar = f"「{it.x}」ではなく、「{it.o}」。{it.tag}。"
            motion = f"{i + 1}/{n} {it.scene}：×「{it.x}」→素っ気ない返答が消え打消し線→○送信→返信が伸びる→原則タグ"
        else:
            nar = f"最後に、「{it.o}」。{it.tag}。"
            motion = f"{i + 1}/{n} {it.scene}：○送信→返信→チェックが点灯→原則タグ"
        scenes.append(Scene(kind="item", narration=nar, caption=it.o, motion=motion, duration=_dur(nar, 7.0)))
    outro = "共通点は" + "、".join(content.principles) + "。保存して、次の前に見返してください。"
    scenes.append(Scene(kind="ending", narration=outro, caption="共通点：" + "／".join(content.principles),
                        motion="○の言い換えが一覧で積み上がり、共通原則に集約→保存ボタン",
                        duration=max(12.0, _dur(outro, 12.0))))
    return scenes


def timeline(scenes: list[Scene]) -> dict:
    durs = [s.duration for s in scenes]
    starts = [0.0]
    for d in durs[:-1]:
        starts.append(round(starts[-1] + d, 3))
    return {"starts": starts, "durs": durs, "total": round(sum(durs), 3)}
