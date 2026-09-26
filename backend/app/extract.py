"""画像から動画の中身（Content）を抽出する。

ANTHROPIC_API_KEY があれば Claude のビジョンで抽出し、無ければサンプルを返す。
画像は内容の抽出だけに使い、動画には一切使わない。
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
from pathlib import Path

from .models import Content

MODEL = os.environ.get("SVS_MODEL", "claude-opus-5-5")

PROMPT = """添付画像はSNS向けの解説画像です。画像の「内容」だけを使い、ビジネス向け縦型ショート動画（60秒前後）の素材JSONを作ってください。

要件:
- 対象は20〜40代の若手リーダー。画像の言い回しをそのまま写すのではなく、動画で伝わる短い文にする
- 項目は最大6件。60秒に収まるよう重要なものを選ぶ
- 各項目: scene(場面の見出し, 8字以内), x(避けたい言い方, 無ければnull), o(推奨する言い方), tag(原則, 8字以内),
  xr(xに対する相手の素っ気ない返答, xがnullならnull), or(oに対する相手の具体的な返答を2〜4文の配列)
- principles: 項目のtagを集約した共通原則を3つ
- title: 動画タイトル(16字以内), subtitle: 副題(20字以内)

JSONのみを出力:
{"title":"","subtitle":"","items":[{"scene":"","x":"","o":"","tag":"","xr":"","or":[""]}],"principles":["","",""]}"""

SAMPLE = {
    "title": "1on1の質問 言い換え6選",
    "subtitle": "「大丈夫です」で終わらせない",
    "items": [
        {"scene": "切り出す", "x": "最近どう？", "o": "今週、一番気になったことは？", "tag": "テーマを渡す", "xr": "特に…普通です。",
         "or": ["一番気になったのはA社の仕様変更です。", "木曜に急に来て、テストの前提が崩れました。", "正直、優先順位を誰に確認すべきか迷っています。"]},
        {"scene": "状態を聞く", "x": "大丈夫？", "o": "しんどいことと楽しいこと、一つずつ教えて", "tag": "一つに絞る", "xr": "大丈夫です。",
         "or": ["しんどいのは、レビュー待ちが3日続いていることです。", "楽しいのは、自動化が初めて夜間で回ったこと。"]},
        {"scene": "仕事を聞く", "x": "進んでる？", "o": "今週、一番時間を使ったのは？", "tag": "実態を聞く", "xr": "順調です。",
         "or": ["一番使ったのは、環境の再構築で丸2日です。", "本来やるはずのテスト設計は半日しか取れていません。"]},
        {"scene": "気持ちに触れる", "x": "悩みはない？", "o": "最近、もやもやしていることはある？", "tag": "言葉を軽くする", "xr": "ないです。",
         "or": ["もやもやしているのは、役割の線引きです。", "言うほどではないかと思って黙っていました。"]},
        {"scene": "承認する", "x": "よくできてるよ", "o": "あの場面、どうやって対処したの？", "tag": "過程を聞く", "xr": "ありがとうございます。",
         "or": ["まず影響範囲を一覧にして、止める判断を先に出しました。", "次は自分だけで最初の連絡まで持っていきたいです。"]},
        {"scene": "次をつくる", "x": None, "o": "来週、一つだけ変えるなら？", "tag": "一つだけ", "xr": None,
         "or": ["レビュー依頼を、朝10時までに出すようにします。", "木曜に進捗を私から共有します。"]},
    ],
    "principles": ["テーマを渡す", "一つに絞る", "過程を聞く"],
}


def _json_from_text(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("抽出結果にJSONが見つかりません")
    return json.loads(m.group(0))


def extract(image_paths: list[Path]) -> tuple[Content, str]:
    """(Content, 抽出器名) を返す。"""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return Content.model_validate(SAMPLE), "sample"
    import anthropic

    client = anthropic.Anthropic()
    blocks: list[dict] = []
    for p in image_paths:
        mt = mimetypes.guess_type(p.name)[0] or "image/png"
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": mt,
                                                   "data": base64.b64encode(p.read_bytes()).decode()}})
    blocks.append({"type": "text", "text": PROMPT})
    msg = client.messages.create(model=MODEL, max_tokens=4000, messages=[{"role": "user", "content": blocks}])
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    data = _json_from_text(text)
    data["items"] = data["items"][:6]
    return Content.model_validate(data), "claude"
