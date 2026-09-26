export type Item = {
  scene: string
  x: string | null
  o: string
  tag: string
  xr: string | null
  or: string[]
}
export type Content = { title: string; subtitle: string; items: Item[]; principles: string[] }
export type Scene = {
  kind: 'title' | 'item' | 'ending'
  motion: string
  narration: string
  caption: string
  duration: number
}
export type Project = {
  id: string
  status: 'uploaded' | 'extracted' | 'structured' | 'rendering' | 'rendered' | 'failed'
  images: string[]
  content: Content | null
  scenes: Scene[]
  concept: 'a'
  video: string | null
  error: string | null
  extractor: string | null
}
export type RenderJob = {
  project_id: string
  state: 'queued' | 'running' | 'encoding' | 'done' | 'failed'
  frames_done: number
  frames_total: number
  error: string | null
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init)
  if (!r.ok) {
    let msg = `${r.status}`
    try {
      const j = await r.json()
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* 本文なし */
    }
    throw new Error(msg)
  }
  return r.json() as Promise<T>
}

export const api = {
  health: () => call<{ ok: boolean; extractor: string }>('/api/health'),
  list: () => call<Project[]>('/api/projects'),
  get: (id: string) => call<Project>(`/api/projects/${id}`),
  upload: (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return call<Project>('/api/projects', { method: 'POST', body: fd })
  },
  saveStructure: (id: string, content: Content, scenes: Scene[]) =>
    call<Project>(`/api/projects/${id}/structure`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, scenes, concept: 'a' }),
    }),
  resetStructure: (id: string) => call<Project>(`/api/projects/${id}/structure/reset`, { method: 'POST' }),
  startRender: (id: string) => call<RenderJob>(`/api/projects/${id}/render`, { method: 'POST' }),
  renderStatus: (id: string) => call<RenderJob>(`/api/projects/${id}/render`),
  fileUrl: (id: string, name: string) => `/api/projects/${id}/files/${name}`,
}
