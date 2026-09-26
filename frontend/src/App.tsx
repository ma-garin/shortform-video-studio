import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type Content, type Project, type RenderJob, type Scene } from './api'

type Step = 1 | 2 | 3

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: '画像を渡す' },
  { n: 2, label: '構成を決める' },
  { n: 3, label: '動画を作る' },
]
const LATER = ['台本を作る', '読み上げを確認', '完成版を出力']

const CONCEPTS = [
  { id: 'a', name: 'A 会話が育つ', desc: 'チャット画面。×の質問は返信がしぼみ、○の質問は返信が伸びる', ready: true },
  { id: 'b', name: 'B 質問を組み替える', desc: '質問文が語のブロックに分かれ、入れ替わる', ready: false },
  { id: 'c', name: 'C 距離が縮まる', desc: '2つの点と線。良い質問で距離が縮まる', ready: false },
]

export default function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [recent, setRecent] = useState<Project[]>([])
  const [extractor, setExtractor] = useState<string>('')

  useEffect(() => {
    api.list().then(setRecent).catch(() => setRecent([]))
    api.health().then((h) => setExtractor(h.extractor)).catch(() => setExtractor(''))
  }, [])

  const open = (p: Project) => {
    setProject(p)
    setStep(p.video ? 3 : 2)
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          Shortform Video Studio
        </div>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className={step === s.n ? 'on' : step > s.n ? 'done' : ''}>
              <button
                type="button"
                disabled={!project && s.n > 1}
                onClick={() => (s.n === 1 || project) && setStep(s.n)}
              >
                <span className="step-num">{s.n}</span>
                {s.label}
              </button>
            </li>
          ))}
          {LATER.map((l, i) => (
            <li key={l} className="later" title="次の開発範囲">
              <span className="step-num">{i + 4}</span>
              {l}
            </li>
          ))}
        </ol>
      </header>

      <main className="main">
        {step === 1 && (
          <UploadStep
            extractor={extractor}
            recent={recent}
            onDone={(p) => {
              setProject(p)
              setStep(2)
            }}
            onOpen={open}
          />
        )}
        {step === 2 && project && (
          <StructureStep
            project={project}
            onSaved={setProject}
            onNext={(p) => {
              setProject(p)
              setStep(3)
            }}
          />
        )}
        {step === 3 && project && <RenderStep project={project} onChange={setProject} onBack={() => setStep(2)} />}
      </main>
    </div>
  )
}

/* ---------- ① 画像を渡す ---------- */
function UploadStep({
  extractor,
  recent,
  onDone,
  onOpen,
}: {
  extractor: string
  recent: Project[]
  onDone: (p: Project) => void
  onOpen: (p: Project) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const add = (list: FileList | null) => {
    if (!list) return
    const ok = Array.from(list).filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name))
    setFiles((cur) => [...cur, ...ok].slice(0, 12))
  }
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      onDone(await api.upload(files))
    } catch (e) {
      setError(`抽出できませんでした：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h1>参考画像を渡す</h1>
      <p className="lead">
        画像から内容だけを読み取ります。画像そのものは動画に使いません。
        {extractor === 'sample' && (
          <span className="warn"> 抽出AIが未設定のため、サンプル内容（1on1の言い換え6選）で進みます。</span>
        )}
      </p>
      <div
        className={`drop ${drag ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          add(e.dataTransfer.files)
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
      >
        <input
          ref={input}
          id="files"
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          hidden
          onChange={(e) => add(e.target.files)}
        />
        <strong>ここに画像をドロップ</strong>
        <span>またはクリックして選択（png / jpg / webp、最大12枚）</span>
      </div>
      {files.length > 0 && (
        <ul className="thumbs">
          {files.map((f, i) => (
            <li key={i}>
              <img src={previews[i]} alt={f.name} />
              <button type="button" aria-label={`${f.name}を外す`} onClick={() => setFiles(files.filter((_, k) => k !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="primary" disabled={!files.length || busy} onClick={submit}>
          {busy ? '内容を読み取り中…' : `${files.length}枚から構成案を作る`}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="recent">
          <h2>作成中のプロジェクト</h2>
          <ul>
            {recent.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p)}>
                  <span>{p.content?.title ?? '（抽出前）'}</span>
                  <span className={`pill s-${p.status}`}>{STATUS[p.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const STATUS: Record<Project['status'], string> = {
  uploaded: 'アップロード済',
  extracted: '抽出済',
  structured: '構成案あり',
  rendering: '動画作成中',
  rendered: '無音動画あり',
  failed: '失敗',
}

/* ---------- ② 構成を決める ---------- */
function StructureStep({
  project,
  onSaved,
  onNext,
}: {
  project: Project
  onSaved: (p: Project) => void
  onNext: (p: Project) => void
}) {
  const [content, setContent] = useState<Content>(project.content!)
  const [scenes, setScenes] = useState<Scene[]>(project.scenes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  const total = scenes.reduce((a, s) => a + Number(s.duration || 0), 0)
  const setItem = (i: number, patch: Partial<Content['items'][number]>) => {
    setContent({ ...content, items: content.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) })
    setDirty(true)
  }
  const setScene = (i: number, patch: Partial<Scene>) => {
    setScenes(scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)))
    setDirty(true)
  }
  const removeItem = (i: number) => {
    setContent({ ...content, items: content.items.filter((_, k) => k !== i) })
    setScenes(scenes.filter((_, k) => k !== i + 1))
    setDirty(true)
  }
  const save = async (next: boolean) => {
    setBusy(true)
    setError('')
    try {
      const p = await api.saveStructure(project.id, content, scenes)
      setDirty(false)
      if (next) onNext(p)
      else onSaved(p)
    } catch (e) {
      setError(`保存できませんでした：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }
  const reset = async () => {
    const p = await api.resetStructure(project.id)
    setScenes(p.scenes)
    setDirty(false)
    onSaved(p)
  }

  return (
    <section className="panel wide">
      <div className="head-row">
        <div>
          <h1>構成を決める</h1>
          <p className="lead">
            タイトル → 具体例 {content.items.length}件 → まとめ。合計{' '}
            <b className={total > 75 ? 'over' : ''}>{total.toFixed(1)}秒</b>
            {total > 75 && '（75秒超。項目を減らすと完走率が上がります）'}
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={reset} disabled={busy}>
            構成案を作り直す
          </button>
          <button type="button" onClick={() => save(false)} disabled={busy || !dirty}>
            保存
          </button>
        </div>
      </div>

      <div className="meta">
        <label>
          タイトル
          <input
            id="title"
            value={content.title}
            onChange={(e) => {
              setContent({ ...content, title: e.target.value })
              setDirty(true)
            }}
          />
        </label>
        <label>
          副題
          <input
            id="subtitle"
            value={content.subtitle}
            onChange={(e) => {
              setContent({ ...content, subtitle: e.target.value })
              setDirty(true)
            }}
          />
        </label>
        <label>
          共通原則（「、」区切り）
          <input
            id="principles"
            value={content.principles.join('、')}
            onChange={(e) => {
              setContent({ ...content, principles: e.target.value.split(/[、,]/).map((s) => s.trim()).filter(Boolean) })
              setDirty(true)
            }}
          />
        </label>
      </div>

      <div className="table-wrap">
        <table className="scenes">
          <thead>
            <tr>
              <th>#</th>
              <th>秒</th>
              <th>内容</th>
              <th>画面の動き</th>
              <th>ナレーション（仮）</th>
              <th>字幕</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scenes.map((s, i) => {
              const item = s.kind === 'item' ? content.items[i - 1] : null
              return (
                <tr key={i}>
                  <td className="step-num">{i}</td>
                  <td>
                    <input
                      id={`dur-${i}`}
                      className="sec"
                      type="number"
                      step="0.5"
                      min="3"
                      value={s.duration}
                      onChange={(e) => setScene(i, { duration: Number(e.target.value) })}
                    />
                  </td>
                  <td className="item-cell">
                    {item ? (
                      <div className="item-edit">
                        <input id={`scene-${i}`} className="scene" value={item.scene} onChange={(e) => setItem(i - 1, { scene: e.target.value })} />
                        <label className="x">
                          ×
                          <input id={`x-${i}`} value={item.x ?? ''} placeholder="（なし）" onChange={(e) => setItem(i - 1, { x: e.target.value || null })} />
                        </label>
                        <label className="o">
                          ○
                          <input id={`o-${i}`} value={item.o} onChange={(e) => setItem(i - 1, { o: e.target.value })} />
                        </label>
                        <label className="tag">
                          原則
                          <input id={`tag-${i}`} value={item.tag} onChange={(e) => setItem(i - 1, { tag: e.target.value })} />
                        </label>
                      </div>
                    ) : (
                      <span className="kind">{s.kind === 'title' ? 'タイトル' : 'まとめ・保存'}</span>
                    )}
                  </td>
                  <td>
                    <textarea id={`motion-${i}`} rows={3} value={s.motion} onChange={(e) => setScene(i, { motion: e.target.value })} />
                  </td>
                  <td>
                    <textarea id={`nar-${i}`} rows={3} value={s.narration} onChange={(e) => setScene(i, { narration: e.target.value })} />
                    <small className={s.narration.length / s.duration > 5.5 ? 'over' : ''}>
                      {(s.narration.length / Math.max(1, s.duration)).toFixed(1)}字/秒
                    </small>
                  </td>
                  <td>
                    <textarea id={`cap-${i}`} rows={3} value={s.caption} onChange={(e) => setScene(i, { caption: e.target.value })} />
                  </td>
                  <td>
                    {item && content.items.length > 1 && (
                      <button type="button" className="ghost" onClick={() => removeItem(i - 1)} aria-label={`${i}行目を削除`}>
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2>コンセプト</h2>
      <div className="concepts">
        {CONCEPTS.map((c) => (
          <label key={c.id} className={`concept ${c.ready ? '' : 'disabled'} ${c.id === 'a' ? 'on' : ''}`}>
            <input id={`concept-${c.id}`} type="radio" name="concept" checked={c.id === 'a'} disabled={!c.ready} readOnly />
            <strong>{c.name}</strong>
            <span>{c.desc}</span>
            {!c.ready && <em>次の開発範囲</em>}
          </label>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="actions end">
        <button type="button" className="primary" onClick={() => save(true)} disabled={busy}>
          この構成で承認して動画を作る
        </button>
      </div>
    </section>
  )
}

/* ---------- ③ 動画を作る ---------- */
function RenderStep({ project, onChange, onBack }: { project: Project; onChange: (p: Project) => void; onBack: () => void }) {
  const [job, setJob] = useState<RenderJob | null>(null)
  const [error, setError] = useState('')
  const [ver, setVer] = useState(0)

  const poll = useCallback(async () => {
    try {
      const j = await api.renderStatus(project.id)
      setJob(j)
      if (j.state === 'done' || j.state === 'failed') {
        onChange(await api.get(project.id))
        setVer((v) => v + 1)
        return true
      }
    } catch {
      return true
    }
    return false
  }, [project.id, onChange])

  useEffect(() => {
    if (project.status !== 'rendering') return
    const t = setInterval(async () => (await poll()) && clearInterval(t), 1000)
    return () => clearInterval(t)
  }, [project.status, poll])

  const start = async () => {
    setError('')
    try {
      setJob(await api.startRender(project.id))
      onChange({ ...project, status: 'rendering' })
    } catch (e) {
      setError(`開始できませんでした：${(e as Error).message}`)
    }
  }

  const pct = job && job.frames_total ? Math.round((job.frames_done / job.frames_total) * 100) : 0
  const running = project.status === 'rendering'

  return (
    <section className="panel render">
      <div className="render-grid">
        <div className="phone">
          {project.video && !running ? (
            <video key={ver} src={`${api.fileUrl(project.id, project.video)}?v=${ver}`} controls playsInline />
          ) : (
            <div className="placeholder">
              {running ? (
                <>
                  <div className="bar">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <p>
                    {job?.state === 'encoding' ? '書き出し中' : '描画中'} {pct}%
                  </p>
                  <small>
                    {job?.frames_done ?? 0} / {job?.frames_total ?? 0} フレーム
                  </small>
                </>
              ) : (
                <p>まだ動画はありません</p>
              )}
            </div>
          )}
        </div>
        <div className="render-side">
          <h1>動画を作る</h1>
          <p className="lead">承認した構成から無音の動画（1080×1920・30fps）を作ります。音声は次の「台本」「読み上げ確認」で付けます。</p>
          <dl className="facts">
            <div>
              <dt>タイトル</dt>
              <dd>{project.content?.title}</dd>
            </div>
            <div>
              <dt>項目</dt>
              <dd>{project.content?.items.length}件</dd>
            </div>
            <div>
              <dt>尺</dt>
              <dd>{project.scenes.reduce((a, s) => a + s.duration, 0).toFixed(1)}秒</dd>
            </div>
            <div>
              <dt>コンセプト</dt>
              <dd>A 会話が育つ</dd>
            </div>
          </dl>
          {project.status === 'failed' && <p className="error">失敗しました：{project.error}</p>}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" onClick={onBack} disabled={running}>
              構成に戻る
            </button>
            <button type="button" className="primary" onClick={start} disabled={running}>
              {project.video ? '作り直す' : '動画を作る'}
            </button>
          </div>
          {project.video && !running && (
            <a className="dl" href={api.fileUrl(project.id, project.video)} download={`${project.content?.title ?? 'video'}_無音.mp4`}>
              無音MP4をダウンロード
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
