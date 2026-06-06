import { useEffect, useMemo, useRef, useState } from 'react'
import hljs from 'highlight.js'
import type { ResultItem, RuntimeStatus, WorkspaceFileEntry } from '../types/chat'

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
  currentWorkspace?: string
  workspaceFiles?: WorkspaceFileEntry[]
  recentResults?: ResultItem[]
  runtimeStatus?: RuntimeStatus | null
  previewFile?: PreviewFile | null
  onSelectFile?: (path: string) => void
  onSelectResult?: (path: string) => void
  onClosePreview?: () => void
  onOpenExternal?: (path: string) => void
  onOpenFolder?: (path: string) => void
  onCopyPath?: (path: string) => void
  onArtifactAction?: (action: 'improve' | 'regenerate' | 'summarize' | 'new_task', path: string) => void
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

function formatTimestamp(value: string): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ''
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function getResultBadge(kind: ResultItem['kind']): string {
  switch (kind) {
    case 'updated':
      return 'UPDATED'
    case 'exported':
      return 'EXPORTED'
    case 'viewed':
      return 'VIEWED'
    case 'failed':
      return 'FAILED'
    default:
      return 'CREATED'
  }
}

function WorkspaceSection({
  title,
  badge,
  items,
  emptyText,
  onSelectFile,
}: {
  title: string
  badge?: string
  items: WorkspaceFileEntry[]
  emptyText: string
  onSelectFile?: (path: string) => void
}) {
  return (
    <div className="c-sec">
      <div className="c-hdr">
        <span className="c-hl">{title}</span>
        <span className="c-hc">{badge || String(items.length)}</span>
      </div>
      <div className="c-bd">
        {items.length === 0 ? (
          <div className="pv-empty-note">{emptyText}</div>
        ) : (
          items.map((entry) => (
            <div key={entry.path} className="ft" title={entry.path}>
              <button
                className="pv-file-button"
                onClick={() => !entry.isDir && onSelectFile?.(entry.path)}
                disabled={entry.isDir}
              >
                <span className="n">{entry.name}</span>
              </button>
              <span className="ft-dd">{entry.isDir ? 'Folder' : formatTimestamp(entry.modifiedAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ProgressSection({
  runtimeStatus,
  currentArtifact,
}: {
  runtimeStatus?: RuntimeStatus | null
  currentArtifact?: ResultItem | null
}) {
  const isFailed = runtimeStatus?.status === 'failed' && runtimeStatus.errorSummary
  const title = runtimeStatus?.statusLabel || 'Idle'
  const detail =
    runtimeStatus?.errorSummary ||
    runtimeStatus?.resultSummary ||
    runtimeStatus?.lastAction ||
    (currentArtifact ? currentArtifact.action : 'Waiting for the next task.')

  return (
    <div className="c-sec">
      <div className="c-hdr">
        <span className="c-hl">Progress</span>
        <span className="c-hc">{title}</span>
      </div>
      <div className="c-bd">
        <div className={`pv-result-card ${isFailed ? 'failed' : ''}`}>
          <div className="pv-result-main">
            <span className="pv-result-title">{currentArtifact?.title || 'Current run'}</span>
            {runtimeStatus?.status && runtimeStatus.status !== 'idle' && (
              <span className={`pv-result-badge ${isFailed ? 'failed' : 'updated'}`}>{title}</span>
            )}
          </div>
          <div className="pv-result-meta">
            <span className="pv-result-action">{detail}</span>
            <span className="pv-result-time">
              {runtimeStatus?.startedAt ? formatTimestamp(new Date(runtimeStatus.startedAt).toISOString()) : 'Now'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultSection({
  items,
  onSelectFile,
  onSelectResult,
  onOpenExternal,
  onOpenFolder,
  onCopyPath,
}: {
  items: ResultItem[]
  onSelectFile?: (path: string) => void
  onSelectResult?: (path: string) => void
  onOpenExternal?: (path: string) => void
  onOpenFolder?: (path: string) => void
  onCopyPath?: (path: string) => void
}) {
  const contextItems = items.slice(0, 8)

  return (
    <div className="c-sec">
      <div className="c-hdr">
        <span className="c-hl">Context</span>
        <span className="c-hc">{contextItems.length}</span>
      </div>
      <div className="c-bd">
        {contextItems.length === 0 ? (
          <div className="pv-empty-note">Context files and recent outputs from this session will appear here.</div>
        ) : (
          contextItems.map((item) => (
            <div key={item.id} className={`pv-result-card ${item.isNew ? 'is-new' : ''}`} title={item.path}>
              <div className="pv-result-main">
                <button
                  className="pv-result-open"
                  onClick={() => {
                    onSelectResult?.(item.path)
                    onSelectFile?.(item.path)
                  }}
                >
                  <span className="pv-result-title">{item.title}</span>
                </button>
                <span className={`pv-result-badge ${item.kind}`}>{getResultBadge(item.kind)}</span>
              </div>
              <div className="pv-result-meta">
                <span className="pv-result-action">{item.errorSummary || item.action}</span>
                <span className="pv-result-time">{formatTimestamp(item.updatedAt)}</span>
              </div>
              <div className="pv-result-actions">
                <button onClick={() => onSelectFile?.(item.path)}>Preview</button>
                <button onClick={() => onOpenExternal?.(item.path)}>Open</button>
                <button onClick={() => onOpenFolder?.(item.path)}>Folder</button>
                <button onClick={() => onCopyPath?.(item.path)}>Copy Path</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function PreviewPanel({
  collapsed,
  onToggleCollapse,
  panelWidth,
  onResize,
  currentWorkspace,
  workspaceFiles = [],
  recentResults = [],
  runtimeStatus,
  previewFile,
  onSelectFile,
  onSelectResult,
  onClosePreview,
  onOpenExternal,
  onOpenFolder,
  onCopyPath,
}: PreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<'preview' | 'source'>('preview')
  const isDraggingRight = useRef(false)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRight.current) return
      const newWidth = Math.min(Math.max(window.innerWidth - event.clientX, 280), 620)
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingRight.current = false
    }

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
      <div
        style={{
          width: 32,
          flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.04)',
          background: '#1a1919',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
        }}
      >
        <button
          onClick={onToggleCollapse}
          style={{
            writingMode: 'vertical-lr',
            letterSpacing: '2px',
            fontSize: 10,
            color: 'rgba(255,255,255,0.15)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            padding: '12px 0',
          }}
        >
          RESULTS
        </button>
      </div>
    )
  }

  const hasPreview = previewFile?.type === 'image' || previewFile?.ext.toLowerCase() === '.md'
  const canShowSource = previewFile?.type === 'text'
  const currentArtifact = recentResults[0] || null
  const workspaceLabel =
    currentWorkspace?.split(/[\\/]/).filter(Boolean).pop() ||
    currentWorkspace ||
    'No folder'

  return (
    <div className="prev" style={{ width: panelWidth, position: 'relative', overflow: 'hidden' }}>
      <div
        className="resize-h"
        style={{ left: -2 }}
        onMouseDown={(event) => {
          event.preventDefault()
          isDraggingRight.current = true
        }}
      />

      <div className="cs">
        <div className="pv-tb">
          <div className="pv-tb-main">
            {previewFile ? (
              <button className="pv-back" onClick={onClosePreview} aria-label="Back to results">
                Back
              </button>
            ) : (
              <span className="pv-back-placeholder" />
            )}
            <div className="pv-title-block">
              <span className="pv-name" title={previewFile ? previewFile.path : 'Results Workbench'}>
                {previewFile ? previewFile.name : 'Results Workbench'}
              </span>
            </div>
          </div>
          <div className="pv-ops">
            {previewFile && hasPreview && canShowSource && (
              <button
                className="pv-op a"
                onClick={() => setPreviewMode((previous) => (previous === 'preview' ? 'source' : 'preview'))}
                title="Toggle preview/source"
              >
                {previewMode === 'preview' ? 'Source' : 'Preview'}
              </button>
            )}
            {previewFile && (
              <button
                className="pv-op a pv-op-text"
                title="Open externally"
                aria-label="Open externally"
                onClick={() => onOpenExternal?.(previewFile.path)}
              >
                Open
              </button>
            )}
            <button onClick={onToggleCollapse} className="pv-op" title="Hide panel" aria-label="Hide panel">
              x
            </button>
          </div>
        </div>

        {previewFile ? (
          <div className="pv-body">
            {previewFile.type === 'image' && previewFile.content && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                <img
                  src={previewFile.content}
                  alt={previewFile.name}
                  style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }}
                />
              </div>
            )}

            {previewFile.type === 'text' && previewFile.ext.toLowerCase() === '.md' && previewMode === 'preview' && (
              <div className="pv-md" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
            )}

            {previewFile.type === 'text' && (previewFile.ext.toLowerCase() !== '.md' || previewMode === 'source') && (
              <div className="pv-src" style={{ padding: 0 }}>
                <pre
                  style={{
                    margin: 0,
                    padding: '16px 20px',
                    fontSize: 12,
                    lineHeight: 1.8,
                    color: 'rgba(255,255,255,0.4)',
                    overflow: 'auto',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
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
        ) : (
          <div className="pv-body">
            <ProgressSection runtimeStatus={runtimeStatus} currentArtifact={currentArtifact} />

            <WorkspaceSection
              title="Workspace"
              badge={workspaceLabel}
              items={workspaceFiles}
              emptyText="No files found in the current workspace yet."
              onSelectFile={onSelectFile}
            />

            <ResultSection
              items={recentResults}
              onSelectFile={onSelectFile}
              onSelectResult={onSelectResult}
              onOpenExternal={onOpenExternal}
              onOpenFolder={onOpenFolder}
              onCopyPath={onCopyPath}
            />
          </div>
        )}
      </div>
    </div>
  )
}
