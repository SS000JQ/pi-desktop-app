import { useMemo, useRef, useEffect, useState } from 'react'
import hljs from 'highlight.js'

export interface PreviewFile {
  path: string
  name: string
  ext: string
  type: 'text' | 'image' | 'binary'
  content?: string
}

interface PreviewPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
  panelWidth: number
  onResize: (w: number) => void
  previewFile?: PreviewFile | null
  onClosePreview?: () => void
  onOpenExternal?: (path: string) => void
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      continue
    }

    if (trimmed.startsWith('# ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`)
      continue
    }

    if (trimmed.startsWith('## ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`)
      continue
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`)
      continue
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }

    html.push(`<p>${escapeHtml(trimmed)}</p>`)
  }

  if (inList) {
    html.push('</ul>')
  }

  return html.join('')
}

function inferLanguage(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.ts':
    case '.tsx':
      return 'typescript'
    case '.js':
    case '.jsx':
      return 'javascript'
    case '.json':
      return 'json'
    case '.css':
      return 'css'
    case '.html':
      return 'html'
    case '.py':
      return 'python'
    case '.md':
      return 'markdown'
    default:
      return 'plaintext'
  }
}

export default function PreviewPanel({
  collapsed,
  onToggleCollapse,
  panelWidth,
  onResize,
  previewFile,
  onClosePreview,
  onOpenExternal,
}: PreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<'preview' | 'source'>('preview')
  const isDraggingRight = useRef(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRight.current) return
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 260), 550)
      onResize(newWidth)
    }
    const handleMouseUp = () => { isDraggingRight.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  useEffect(() => {
    setPreviewMode('preview')
  }, [previewFile?.path])

  const highlightedContent = useMemo(() => {
    if (!previewFile || previewFile.type !== 'text' || !previewFile.content) return ''
    const language = inferLanguage(previewFile.ext)
    if (language === 'plaintext') {
      return escapeHtml(previewFile.content)
    }
    try {
      return hljs.highlight(previewFile.content, { language }).value
    } catch {
      return escapeHtml(previewFile.content)
    }
  }, [previewFile])

  const markdownHtml = useMemo(() => {
    if (!previewFile || previewFile.ext.toLowerCase() !== '.md' || !previewFile.content) return ''
    return renderMarkdown(previewFile.content)
  }, [previewFile])

  if (collapsed) {
    return (
      <div style={{ width: 32, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.04)', background: '#1a1919', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
        <button onClick={onToggleCollapse} style={{ writingMode: 'vertical-lr', letterSpacing: '2px', fontSize: 10, color: 'rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", padding: '12px 0' }}>
          PREVIEW
        </button>
      </div>
    )
  }

  const hasPreview = previewFile?.type === 'image' || previewFile?.ext.toLowerCase() === '.md'
  const canShowSource = previewFile?.type === 'text'

  return (
    <div className="prev" style={{ width: panelWidth, position: 'relative', overflow: 'hidden' }}>
      <div className="resize-h" style={{ left: -2 }}
        onMouseDown={(e) => { e.preventDefault(); isDraggingRight.current = true }} />

      {!previewFile && (
        <div className="cs">
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '4px 6px' }}>
            <button onClick={onToggleCollapse} className="pv-op" title="Hide panel" style={{ width: 22, height: 20, fontSize: 10 }}>›</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
            Open a file from the Files panel to preview it here.
          </div>
        </div>
      )}

      {previewFile && (
        <div className="cs">
          <div className="pv-tb">
            <button className="pv-back" onClick={onClosePreview}>←</button>
            <span className="pv-name">{previewFile.name}</span>
            <span className="pv-tag">{previewFile.ext.replace('.', '').toUpperCase() || 'FILE'}</span>
            <div className="pv-ops">
              {hasPreview && canShowSource && (
                <button className="pv-op a" onClick={() => setPreviewMode((prev) => prev === 'preview' ? 'source' : 'preview')} title="Toggle preview/source">
                  {previewMode === 'preview' ? 'SRC' : 'PRE'}
                </button>
              )}
              <button className="pv-op a" title="Open externally" onClick={() => onOpenExternal?.(previewFile.path)}>Open</button>
            </div>
          </div>

          <div className="pv-body">
            {previewFile.type === 'image' && previewFile.content && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 16 }}>
                <img src={previewFile.content} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}

            {previewFile.type === 'text' && previewFile.ext.toLowerCase() === '.md' && previewMode === 'preview' && (
              <div className="pv-md" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
            )}

            {previewFile.type === 'text' && (previewFile.ext.toLowerCase() !== '.md' || previewMode === 'source') && (
              <div className="pv-src" style={{ padding: 0 }}>
                <pre style={{ margin: 0, padding: '16px 20px', fontSize: 12, lineHeight: 1.8, color: 'rgba(255,255,255,0.4)', overflow: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>
                  <code dangerouslySetInnerHTML={{ __html: highlightedContent }} />
                </pre>
              </div>
            )}

            {previewFile.type === 'binary' && (
              <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}>Preview not available for this file type.</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{previewFile.path}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
