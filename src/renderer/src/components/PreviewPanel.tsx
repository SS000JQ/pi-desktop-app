import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import hljs from 'highlight.js'
import type {
  FilePreviewData,
  ResultItem,
  RuntimeStatus,
  WorkspaceFileEntry,
} from '../types/chat'

export type PreviewFile = FilePreviewData & {
  path: string
  name: string
  ext: string
}

interface ContextResourceItem {
  id: string
  label: string
  path?: string
  meta?: string
}

interface PreviewPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
  panelWidth: number
  onResize: (w: number) => void
  currentWorkspace?: string
  workspaceFiles?: WorkspaceFileEntry[]
  workspaceDirectories?: WorkspaceFileEntry[]
  workspaceChildrenByDir?: Record<string, WorkspaceFileEntry[]>
  recentResults?: ResultItem[]
  runtimeStatus?: RuntimeStatus | null
  previewFile?: PreviewFile | null
  contextUploads?: ContextResourceItem[]
  contextConnectors?: ContextResourceItem[]
  contextSkills?: ContextResourceItem[]
  onSelectFile?: (path: string) => void
  onSelectResult?: (path: string) => void
  onToggleWorkspaceDirectory?: (path: string) => void
  onClosePreview?: () => void
  onOpenExternal?: (path: string) => void
  onOpenFolder?: (path: string) => void
  onCopyPath?: (path: string) => void
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

function SectionShell({
  title,
  badge,
  collapsed,
  onToggle,
  children,
}: {
  title: string
  badge?: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className={`c-sec ${collapsed ? 'is-collapsed' : ''}`}>
      <button className="c-hdr c-hdr-btn" onClick={onToggle} type="button">
        <span className="c-hl">{title}</span>
        <span className="c-hdr-right">
          {badge && <span className="c-hc">{badge}</span>}
          <span className={`c-chevron ${collapsed ? 'collapsed' : ''}`}>v</span>
        </span>
      </button>
      {!collapsed && <div className="c-bd">{children}</div>}
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
  )
}

function WorkspaceSection({
  files,
  directories,
  expandedDirectories,
  onSelectFile,
  onToggleDirectory,
}: {
  files: WorkspaceFileEntry[]
  directories: WorkspaceFileEntry[]
  expandedDirectories: Record<string, WorkspaceFileEntry[]>
  onSelectFile?: (path: string) => void
  onToggleDirectory?: (path: string) => void
}) {
  return (
    <div className="pv-stack">
      {files.length > 0 && (
        <div className="pv-group">
          <div className="pv-group-label">Files</div>
          {files.map((entry) => (
            <div key={entry.path} className="ft" title={entry.path}>
              <button className="pv-file-button" onClick={() => onSelectFile?.(entry.path)}>
                <span className="n">{entry.name}</span>
              </button>
              <span className="ft-dd">{formatTimestamp(entry.modifiedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {directories.length > 0 && (
        <div className="pv-group">
          <div className="pv-group-label">Folders</div>
          {directories.map((entry) => {
            const expanded = Boolean(expandedDirectories[entry.path])
            const children = expandedDirectories[entry.path] || []

            return (
              <div key={entry.path} className="pv-dir-wrap">
                <div className="ft" title={entry.path}>
                  <button className="pv-file-button" onClick={() => onToggleDirectory?.(entry.path)}>
                    <span className="n">{entry.name}</span>
                  </button>
                  <span className="ft-dd">{expanded ? 'Hide' : 'Show'}</span>
                </div>
                {expanded && (
                  <div className="ft-in">
                    {children.length === 0 ? (
                      <div className="pv-empty-note pv-empty-inline">No items in this folder.</div>
                    ) : (
                      children.map((child) => (
                        <div key={child.path} className="ft" title={child.path}>
                          <button
                            className="pv-file-button"
                            onClick={() => !child.isDir && onSelectFile?.(child.path)}
                            disabled={child.isDir}
                          >
                            <span className="n">{child.name}</span>
                          </button>
                          <span className="ft-dd">{child.isDir ? 'Folder' : formatTimestamp(child.modifiedAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {files.length === 0 && directories.length === 0 && (
        <div className="pv-empty-note">No files found in the current workspace yet.</div>
      )}
    </div>
  )
}

function ContextSection({
  uploads,
  connectors,
  skills,
  onSelectFile,
}: {
  uploads: ContextResourceItem[]
  connectors: ContextResourceItem[]
  skills: ContextResourceItem[]
  onSelectFile?: (path: string) => void
}) {
  const renderItems = (items: ContextResourceItem[], kind: 'file' | 'meta') => {
    if (items.length === 0) {
      return <div className="pv-empty-note pv-empty-inline">No items yet.</div>
    }

    return items.map((item) => (
      <div key={item.id} className="pv-context-item" title={item.path || item.label}>
        {kind === 'file' && item.path ? (
          <button className="pv-context-button" onClick={() => onSelectFile?.(item.path!)}>
            <span className="pv-context-title">{item.label}</span>
          </button>
        ) : (
          <div className="pv-context-button passive">
            <span className="pv-context-title">{item.label}</span>
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="pv-stack">
      <div className="pv-group">
        <div className="pv-group-label">Uploads</div>
        {renderItems(uploads, 'file')}
      </div>
      <div className="pv-group">
        <div className="pv-group-label">Connectors</div>
        {renderItems(connectors, 'meta')}
      </div>
      <div className="pv-group">
        <div className="pv-group-label">Skills</div>
        {renderItems(skills, 'meta')}
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
  workspaceDirectories = [],
  workspaceChildrenByDir = {},
  recentResults = [],
  runtimeStatus,
  previewFile,
  contextUploads = [],
  contextConnectors = [],
  contextSkills = [],
  onSelectFile,
  onSelectResult,
  onToggleWorkspaceDirectory,
  onClosePreview,
  onOpenExternal,
  onOpenFolder,
  onCopyPath,
}: PreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<'preview' | 'source'>('preview')
  const [sections, setSections] = useState({
    progress: false,
    workspace: false,
    context: false,
  })
  const isDraggingRight = useRef(false)
  const workbenchBodyRef = useRef<HTMLDivElement | null>(null)
  const savedWorkbenchScrollRef = useRef(0)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRight.current) return
      const minWidth = previewFile ? 520 : 320
      const maxWidth = previewFile ? 760 : 620
      const newWidth = Math.min(Math.max(window.innerWidth - event.clientX, minWidth), maxWidth)
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
  }, [onResize, previewFile])

  useEffect(() => {
    setPreviewMode('preview')
  }, [previewFile?.path])

  useEffect(() => {
    if (previewFile) {
      savedWorkbenchScrollRef.current = workbenchBodyRef.current?.scrollTop || 0
      return
    }

    if (workbenchBodyRef.current) {
      workbenchBodyRef.current.scrollTop = savedWorkbenchScrollRef.current
    }
  }, [previewFile])

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
    if (!previewFile || previewFile.type !== 'text' || previewFile.ext.toLowerCase() !== '.md' || !previewFile.content) return ''
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

  const hasPreview =
    previewFile?.type === 'image'
    || previewFile?.type === 'pdf'
    || previewFile?.type === 'docx'
    || previewFile?.ext.toLowerCase() === '.md'
  const canShowSource = previewFile?.type === 'text'
  const currentArtifact = recentResults[0] || null
  const workspaceLabel =
    currentWorkspace?.split(/[\\/]/).filter(Boolean).pop() ||
    currentWorkspace ||
    'No folder'
  const effectiveWidth = previewFile ? Math.max(panelWidth, 560) : panelWidth

  return (
    <div className={`prev ${previewFile ? 'preview-mode' : 'workbench-mode'}`} style={{ width: effectiveWidth, position: 'relative', overflow: 'hidden' }}>
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
              <>
                <button
                  className="pv-op a pv-op-text"
                  title="Open externally"
                  aria-label="Open externally"
                  onClick={() => onOpenExternal?.(previewFile.path)}
                >
                  Open
                </button>
                <button
                  className="pv-op a pv-op-text"
                  title="Open folder"
                  aria-label="Open folder"
                  onClick={() => onOpenFolder?.(previewFile.path)}
                >
                  Folder
                </button>
                <button
                  className="pv-op a pv-op-text"
                  title="Copy path"
                  aria-label="Copy path"
                  onClick={() => onCopyPath?.(previewFile.path)}
                >
                  Copy
                </button>
              </>
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
                  style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain' }}
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

            {previewFile.type === 'pdf' && (
              <iframe
                title={previewFile.name}
                src={previewFile.content}
                className="pv-pdf-frame"
              />
            )}

            {previewFile.type === 'docx' && (
              <div className="pv-md pv-office-doc" dangerouslySetInnerHTML={{ __html: previewFile.content }} />
            )}

            {previewFile.type === 'pptx' && (
              <div className="pv-office-stack">
                {previewFile.slides.length === 0 ? (
                  <div className="pv-empty-note">No slide text could be extracted from this presentation.</div>
                ) : (
                  previewFile.slides.map((slide) => (
                    <div key={`${previewFile.path}-${slide.index}`} className="pv-office-card">
                      <div className="pv-office-kicker">{`Slide ${slide.index}`}</div>
                      <div className="pv-office-title">{slide.title}</div>
                      <div className="pv-office-copy">{slide.summary}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {previewFile.type === 'xlsx' && (
              <div className="pv-office-stack">
                {previewFile.workbook.sheets.map((sheet) => (
                  <div key={`${previewFile.path}-${sheet.name}`} className="pv-office-card">
                    <div className="pv-office-title">{sheet.name}</div>
                    {sheet.rows.length === 0 ? (
                      <div className="pv-empty-note pv-empty-inline">No visible rows in this sheet preview.</div>
                    ) : (
                      <div className="pv-sheet-wrap">
                        <table className="pv-sheet-table">
                          <tbody>
                            {sheet.rows.map((row, rowIndex) => (
                              <tr key={`${sheet.name}-${rowIndex}`}>
                                {row.map((cell, cellIndex) => (
                                  <td key={`${sheet.name}-${rowIndex}-${cellIndex}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {previewFile.type === 'binary' && (
              <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}>{previewFile.reason || 'Preview not available for this file type.'}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{previewFile.path}</div>
              </div>
            )}
          </div>
        ) : (
          <div ref={workbenchBodyRef} className="pv-body pv-workbench-body">
            <SectionShell
              title="Progress"
              badge={runtimeStatus?.statusLabel || 'Idle'}
              collapsed={sections.progress}
              onToggle={() => setSections((previous) => ({ ...previous, progress: !previous.progress }))}
            >
              <ProgressSection runtimeStatus={runtimeStatus} currentArtifact={currentArtifact} />
            </SectionShell>

            <SectionShell
              title="Workspace"
              badge={workspaceLabel}
              collapsed={sections.workspace}
              onToggle={() => setSections((previous) => ({ ...previous, workspace: !previous.workspace }))}
            >
              <WorkspaceSection
                files={workspaceFiles}
                directories={workspaceDirectories}
                expandedDirectories={workspaceChildrenByDir}
                onSelectFile={onSelectFile}
                onToggleDirectory={onToggleWorkspaceDirectory}
              />
            </SectionShell>

            <SectionShell
              title="Context"
              collapsed={sections.context}
              onToggle={() => setSections((previous) => ({ ...previous, context: !previous.context }))}
            >
              <ContextSection
                uploads={contextUploads}
                connectors={contextConnectors}
                skills={contextSkills}
                onSelectFile={(path) => {
                  onSelectResult?.(path)
                  onSelectFile?.(path)
                }}
              />
            </SectionShell>
          </div>
        )}
      </div>
    </div>
  )
}
