# Shortform Video Studio

参考画像の**内容だけ**を読み取り、ビジネス向け縦型ショート動画（TikTok / YouTube Shorts、1080×1920・30fps）を作るWebシステム。画像そのものは動画に使わない。

## 工程と実装状況

| # | 工程 | 状態 |
|---|---|---|
| 1 | 画像を渡す（内容抽出：Claude API。キー未設定時はサンプル内容） | 実装済 |
| 2 | 構成を決める（シーン表の編集・項目削除・尺と字/秒の警告・コンセプト選択） | 実装済 |
| 3 | 動画を作る（無音MP4、進捗表示） | 実装済（コンセプトAのみ） |
| 4 | 台本を作る | 未 |
| 5 | 読み上げを確認（VOICEVOX・ずんだもん、読みのかな表示） | 未 |
| 6 | 完成版を出力（ナレーション＋BGM合成） | 未 |

## 起動

前提：Python 3.11+、Node 20+、ffmpeg、日本語フォント（Noto Sans CJK JP）

```bash
# バックエンド
cd backend
pip install -r requirements.txt
playwright install chromium
export ANTHROPIC_API_KEY=...   # 省略時はサンプル内容で動作
uvicorn app.main:app --port 8000

# フロントエンド（開発）
cd frontend
npm install
npm run dev        # http://localhost:5173 （/api は 8000 へプロキシ）

# 本番相当：ビルドするとバックエンドが画面も配信する
npm run build      # → http://localhost:8000
```

## 構成

```
backend/app/
  main.py        API
  extract.py     画像→内容（Claude ビジョン）
  structure.py   内容→構成表（尺は5.5字/秒で見積もり）
  render.py      Canvas render(t) を Playwright で描画→ffmpeg で無音MP4
  renderer/      動画の描画コード（core.js 共通、a.html コンセプトA）
frontend/src/    React + TypeScript（Vite）
data/projects/<id>/  画像・project.json・動画（git管理外）
```

## テスト

```bash
cd backend && python -m pytest -q     # 3秒の実描画を含む
cd frontend && npx tsc -b && npm run build
```
