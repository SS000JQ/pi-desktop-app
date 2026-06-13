import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react'
import hljs from 'highlight.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseXlsxPreview, type XlsxPreviewWorkbook, type XlsxPreviewSheet } from '../../../shared/xlsx-preview'
import type {
  BinaryPreviewContent,
  FilePreviewData,
  ResultItem,
  RunActivity,
  RuntimeStatus,
  WorkspaceFileEntry,
} from '../types/chat'

export type PreviewFile = FilePreviewData & {
  path: string
  name: string
  ext: string
}

const PPTX_VIEWER_CHANNEL = 'pi-pptx-preview'
const pptxViewerPageUrl = new URL('pptx-viewer.html', window.location.href).toString()
const DOCX_MIN_VERTICAL_PADDING = 72
const DOCX_MIN_HORIZONTAL_PADDING = 96

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
  workspaceError?: string | null
  recentResults?: ResultItem[]
  runtimeStatus?: RuntimeStatus | null
  runActivity?: RunActivity | null
  previewFile?: PreviewFile | null
  contextUploads?: ContextResourceItem[]
  contextConnectors?: ContextResourceItem[]
  contextSkills?: ContextResourceItem[]
  onSelectFile?: (path: string) => void
  onSelectResult?: (path: string) => void
  onToggleWorkspaceDirectory?: (path: string) => void
  onWorkspaceRefresh?: () => void
  onClosePreview?: () => void
  onOpenExternal?: (path: string) => void
  onOpenFolder?: (path: string) => void
  onCopyPath?: (path: string) => void
  openError?: string | null
}

interface PdfPageViewportLike {
  width: number
  height: number
}

interface PdfPageProxyLike {
  getViewport: (params: { scale: number }) => PdfPageViewportLike
  render: (params: {
    canvasContext: CanvasRenderingContext2D
    viewport: PdfPageViewportLike
    transform?: number[]
  }) => PdfRenderTaskLike
  cleanup?: () => void
}

interface PdfRenderTaskLike {
  promise: Promise<unknown>
  cancel?: () => void
}

interface PdfDocumentProxyLike {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPageProxyLike>
  destroy?: () => void
  cleanup?: () => void
}

interface PdfLoadingTaskLike {
  promise: Promise<PdfDocumentProxyLike>
  destroy?: () => void
}

interface SpreadsheetCellView {
  key: string
  value: string
  colSpan?: number
  rowSpan?: number
  width?: number
  isHeader: boolean
}

interface SpreadsheetSheetView {
  name: string
  rows: SpreadsheetCellView[][]
}

interface PptxViewMemory {
  currentSlide: number
  scrollTop: number
}

interface PptxViewerMessage {
  source?: string
  type?: 'ready' | 'loaded' | 'rendered' | 'status' | 'slideError' | 'error'
  fileKey?: string
  requestId?: number
  slideCount?: number
  currentSlide?: number
  scrollTop?: number
  message?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
    case '.htm':
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

function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`
  }
  return `file://${normalized}`
}

function getDirectoryFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const directory = normalized.replace(/\/[^/\\]*$/, '/')
  return toFileUrl(directory)
}

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function ensureMinimumPadding(
  element: HTMLElement,
  property: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft',
  minimumPx: number,
): void {
  const computed = window.getComputedStyle(element)[property]
  const current = parsePixelValue(computed || element.style[property])
  if (current < minimumPx) {
    element.style[property] = `${minimumPx}px`
  }
}

function normalizeDocxPreviewLayout(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.docx-wrapper').forEach((wrapper) => {
    wrapper.classList.add('pv-docx-stage-wrapper')
  })

  container.querySelectorAll<HTMLElement>('.docx').forEach((page) => {
    page.classList.add('pv-docx-page')
    page.style.boxSizing = 'border-box'
    ensureMinimumPadding(page, 'paddingTop', DOCX_MIN_VERTICAL_PADDING)
    ensureMinimumPadding(page, 'paddingRight', DOCX_MIN_HORIZONTAL_PADDING)
    ensureMinimumPadding(page, 'paddingBottom', DOCX_MIN_VERTICAL_PADDING)
    ensureMinimumPadding(page, 'paddingLeft', DOCX_MIN_HORIZONTAL_PADDING)
  })
}

function isAbsoluteResourceUrl(value: string): boolean {
  return /^(?:[a-z]+:|#|\/\/)/i.test(value)
}

function looksLikeExternalHost(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/:?#]|$)/i.test(value)
}

function resolvePreviewResourceUrl(value: string | undefined, filePath: string): string | undefined {
  if (!value || isAbsoluteResourceUrl(value)) return value
  if (looksLikeExternalHost(value)) return `https://${value}`

  try {
    return new URL(value, getDirectoryFileUrl(filePath)).toString()
  } catch {
    return value
  }
}

function buildHtmlSrcDoc(html: string, filePath: string): string {
  const baseHref = getDirectoryFileUrl(filePath)
  const baseTag = `<base href="${baseHref}">`
  const metaTag = '<meta charset="utf-8">'
  const previewStyle = `<style data-pi-html-preview-scrollbar>
:root { color-scheme: light; scrollbar-color: rgba(15,23,42,0.30) rgba(248,250,252,0.78); }
html, body { scrollbar-width: thin; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: rgba(248,250,252,0.78); }
::-webkit-scrollbar-thumb {
  background: rgba(15,23,42,0.24);
  border: 2px solid rgba(248,250,252,0.78);
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.38); }
</style>`
  const bridgeScript = `<script>
(() => {
  document.addEventListener('click', (event) => {
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    event.preventDefault();
    window.parent.postMessage({ source: 'pi-html-preview-link', href: link.href }, '*');
  }, true);
})();
</script>`
  const headContent = `${metaTag}${baseTag}${previewStyle}${bridgeScript}`

  if (/<html[\s>]/i.test(html)) {
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/<head(\s*[^>]*)>/i, `<head$1>${headContent}`)
    }

    return html.replace(/<html(\s*[^>]*)>/i, `<html$1><head>${headContent}</head>`)
  }

  return `<!doctype html><html><head>${headContent}</head><body>${html}</body></html>`
}

function getRenderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return fallback
}

function toUint8Array(content: BinaryPreviewContent): Uint8Array {
  return content instanceof Uint8Array ? content : Uint8Array.from(content)
}

function toArrayBuffer(content: BinaryPreviewContent): ArrayBuffer {
  const array = toUint8Array(content)
  const copy = new ArrayBuffer(array.byteLength)
  new Uint8Array(copy).set(array)
  return copy
}

function buildSpreadsheetSheetView(sheet: XlsxPreviewSheet): SpreadsheetSheetView {
  const mergeOrigins = new Map<string, { colSpan: number; rowSpan: number }>()
  const coveredCells = new Set<string>()

  for (const merge of sheet.merges) {
    mergeOrigins.set(`${merge.startRow}:${merge.startColumn}`, {
      colSpan: merge.endColumn - merge.startColumn + 1,
      rowSpan: merge.endRow - merge.startRow + 1,
    })

    for (let rowIndex = merge.startRow; rowIndex <= merge.endRow; rowIndex += 1) {
      for (let columnIndex = merge.startColumn; columnIndex <= merge.endColumn; columnIndex += 1) {
        if (rowIndex === merge.startRow && columnIndex === merge.startColumn) continue
        coveredCells.add(`${rowIndex}:${columnIndex}`)
      }
    }
  }

  return {
    name: sheet.name,
    rows: sheet.rows.map((values, rowIndex) => {
      const row: SpreadsheetCellView[] = []

      for (let columnIndex = 0; columnIndex < values.length; columnIndex += 1) {
      const cellKey = `${rowIndex}:${columnIndex}`
      if (coveredCells.has(cellKey)) continue

      const merge = mergeOrigins.get(cellKey)

      row.push({
        key: `${sheet.name}-${cellKey}`,
        value: values[columnIndex] || '',
        colSpan: merge?.colSpan,
        rowSpan: merge?.rowSpan,
        width: sheet.columnWidths[columnIndex],
        isHeader: rowIndex === 0,
      })
      }

      return row
    }),
  }
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
  runActivity,
  currentArtifact,
}: {
  runtimeStatus?: RuntimeStatus | null
  runActivity?: RunActivity | null
  currentArtifact?: ResultItem | null
}) {
  const isFailed = runtimeStatus?.status === 'failed' && runtimeStatus.errorSummary
  const title = runtimeStatus?.statusLabel || runActivity?.statusLabel || 'Idle'
  const progressTitle =
    runActivity?.resultPaths[0]?.split(/[/\\]/).pop() ||
    currentArtifact?.title ||
    'Current run'
  const detail =
    runtimeStatus?.errorSummary ||
    runtimeStatus?.resultSummary ||
    runtimeStatus?.lastProgressMessage ||
    runtimeStatus?.lastAction ||
    runActivity?.lastAction ||
    (currentArtifact ? currentArtifact.action : 'Waiting for the next task.')
  const stepItems = runActivity?.recentSteps.slice(0, 3) || []
  const visibleStepItems = stepItems.filter((step, index) => !(index === 0 && step.label === title))
  const touchedFiles = runActivity?.files.slice(0, 4) || []
  const activityTime = runtimeStatus?.lastEventAt || runActivity?.lastEventAt

  return (
    <div className={`pv-result-card ${isFailed ? 'failed' : ''}`}>
      <div className="pv-result-main">
        <span className="pv-result-title">{progressTitle}</span>
      </div>
      <div className="pv-result-meta">
        <span className="pv-result-action">{detail}</span>
        <span className="pv-result-time">
          {activityTime ? formatTimestamp(new Date(activityTime).toISOString()) : 'Now'}
        </span>
      </div>
      {runtimeStatus?.activeToolName && (
        <div className="pv-result-note">{`Tool: ${runtimeStatus.activeToolName}`}</div>
      )}
      {visibleStepItems.length > 0 && (
        <div className="pv-result-steps">
          {visibleStepItems.map((step) => (
            <div key={step.id} className={`pv-result-step ${step.state}`}>
              <span className="pv-result-step-label">{step.label}</span>
              {step.detail && <span className="pv-result-step-detail">{step.detail}</span>}
            </div>
          ))}
        </div>
      )}
      {touchedFiles.length > 0 && (
        <div className="pv-result-files">
          {touchedFiles.map((file) => (
            <div key={`${file.kind}:${file.path}`} className="pv-result-file" title={file.path}>
              {file.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WorkspaceSection({
  files,
  directories,
  expandedDirectories,
  error,
  onSelectFile,
  onToggleDirectory,
  currentWorkspace,
  onWorkspaceRefresh,
}: {
  files: WorkspaceFileEntry[]
  directories: WorkspaceFileEntry[]
  expandedDirectories: Record<string, WorkspaceFileEntry[]>
  error?: string | null
  onSelectFile?: (path: string) => void
  onToggleDirectory?: (path: string) => void
  currentWorkspace?: string
  onWorkspaceRefresh?: () => void
}) {
  const [dropNotice, setDropNotice] = useState<string | null>(null)
  const [isDraggingWorkspace, setIsDraggingWorkspace] = useState(false)

  const handleFileDragStart = (event: DragEvent<HTMLElement>, entry: WorkspaceFileEntry) => {
    if (entry.isDir) return
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-pi-desktop-file', JSON.stringify({
      path: entry.path,
      name: entry.name,
    }))
    event.dataTransfer.setData('text/plain', entry.path)
  }

  const handleWorkspaceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingWorkspace(false)
    const droppedFiles = Array.from(event.dataTransfer.files || [])
    const paths = droppedFiles
      .map((file) => window.piDesktop.files.getPathForFile?.(file) || (file as File & { path?: string }).path || '')
      .filter((path, index) => {
        const fileName = droppedFiles[index]?.name || ''
        if (!path || path === fileName) return false
        return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
      })
      .filter(Boolean)
    if (paths.length === 0 && droppedFiles.length > 0) {
      setDropNotice('This drop source did not provide a real file path. Please use Files or drag from Explorer.')
      return
    }
    if (paths.length === 0) return
    if (!currentWorkspace) {
      setDropNotice('Choose a workspace before importing files.')
      return
    }
    void (async () => {
      const response = await window.piDesktop.files.importToWorkspace({
        workspaceDir: currentWorkspace,
        paths,
      })
      if (!response.success) {
        setDropNotice(response.error || 'Failed to import files to workspace.')
        return
      }
      const importedCount = Array.isArray(response.data) ? response.data.length : paths.length
      setDropNotice(`Imported ${importedCount} file${importedCount === 1 ? '' : 's'} to workspace.`)
      onWorkspaceRefresh?.()
    })()
  }

  const renderEntries = (entries: WorkspaceFileEntry[], depth = 0): ReactNode =>
    entries.map((entry) => {
      const expanded = entry.isDir && Boolean(expandedDirectories[entry.path])
      const children = entry.isDir ? expandedDirectories[entry.path] || [] : []

      return (
        <div key={entry.path} className="pv-dir-wrap">
          <div
            className={`ft ${entry.isDir ? '' : 'ft-draggable'}`}
            title={entry.isDir ? entry.path : `${entry.path}\nDrag to chat`}
            draggable={!entry.isDir}
            onDragStart={(event) => handleFileDragStart(event, entry)}
          >
            <button
              className="pv-file-button"
              onClick={() => {
                if (entry.isDir) {
                  onToggleDirectory?.(entry.path)
                  return
                }
                onSelectFile?.(entry.path)
              }}
            >
              <span className="n">{entry.name}</span>
            </button>
            <span className="ft-dd">
              {entry.isDir ? (expanded ? 'Hide' : 'Show') : formatTimestamp(entry.modifiedAt)}
            </span>
          </div>
          {entry.isDir && expanded && (
            <div className="ft-in" style={{ marginLeft: Math.min(depth, 4) * 8 }}>
              {children.length === 0 ? (
                <div className="pv-empty-note pv-empty-inline">No items in this folder.</div>
              ) : (
                renderEntries(children, depth + 1)
              )}
            </div>
          )}
        </div>
      )
    })

  return (
    <div
      className={`pv-stack workspace-drop-zone ${isDraggingWorkspace ? 'is-dragging' : ''}`}
      data-testid="workspace-drop-target"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setIsDraggingWorkspace(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDraggingWorkspace(false)
        }
      }}
      onDrop={handleWorkspaceDrop}
    >
      {dropNotice && (
        <div className="pv-empty-note pv-empty-inline">{dropNotice}</div>
      )}
      {error && (
        <div className="pv-empty-note pv-empty-inline">{error}</div>
      )}

      {files.length > 0 && (
        <div className="pv-group">
          <div className="pv-group-label">Files</div>
          {files.map((entry) => (
            <div
              key={entry.path}
              className="ft ft-draggable"
              title={`${entry.path}\nDrag to chat`}
              draggable
              onDragStart={(event) => handleFileDragStart(event, entry)}
            >
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
          {renderEntries(directories)}
        </div>
      )}

      {!error && files.length === 0 && directories.length === 0 && (
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

function SummaryAlert({ message }: { message: string }) {
  return <div className="pv-fallback-alert">{message}</div>
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
  workspaceError = null,
  recentResults = [],
  runtimeStatus,
  runActivity,
  previewFile,
  contextUploads = [],
  contextConnectors = [],
  contextSkills = [],
  onSelectFile,
  onSelectResult,
  onToggleWorkspaceDirectory,
  onWorkspaceRefresh,
  onClosePreview,
  onOpenExternal,
  onOpenFolder,
  onCopyPath,
  openError = null,
}: PreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<'preview' | 'source'>('preview')
  const [sections, setSections] = useState({
    progress: false,
    workspace: false,
    context: false,
  })
  const isDraggingRight = useRef(false)
  const [isResizeDragging, setIsResizeDragging] = useState(false)
  const workbenchBodyRef = useRef<HTMLDivElement | null>(null)
  const previewBodyRef = useRef<HTMLDivElement | null>(null)
  const savedWorkbenchScrollRef = useRef(0)
  const savedPreviewScrollRef = useRef(0)

  const imageViewMemoryRef = useRef<Record<string, { mode: 'fit' | 'actual'; zoom: number }>>({})
  const [imageViewMode, setImageViewMode] = useState<'fit' | 'actual'>('fit')
  const [imageZoom, setImageZoom] = useState(1)

  const pptxFrameRef = useRef<HTMLIFrameElement | null>(null)
  const pptxViewMemoryRef = useRef<Record<string, PptxViewMemory>>({})
  const pptxRequestIdRef = useRef(0)
  const pptxActiveRequestRef = useRef<{ fileKey: string; requestId: number } | null>(null)
  const pptxFrameReadyRef = useRef(false)
  const pptxRequestTimeoutRef = useRef<number | null>(null)
  const pptxLastAutoLoadFileRef = useRef<string | null>(null)
  const [pptxCurrentSlide, setPptxCurrentSlide] = useState(0)
  const [pptxSlideCount, setPptxSlideCount] = useState(0)
  const [pptxScrollTop, setPptxScrollTop] = useState(0)
  const [pptxIsRendering, setPptxIsRendering] = useState(false)
  const [pptxRenderError, setPptxRenderError] = useState<string | null>(null)
  const [pptxFrameReadyTick, setPptxFrameReadyTick] = useState(0)

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfStageRef = useRef<HTMLDivElement | null>(null)
  const pdfDocumentRef = useRef<PdfDocumentProxyLike | null>(null)
  const pdfLoadingTaskRef = useRef<PdfLoadingTaskLike | null>(null)
  const pdfActiveRenderTaskRef = useRef<PdfRenderTaskLike | null>(null)
  const pdfRenderInFlightRef = useRef<Promise<unknown> | null>(null)
  const pdfResizeRerenderTimeoutRef = useRef<number | null>(null)
  const pdfRenderRequestIdRef = useRef(0)
  const pdfLastObservedStageWidthRef = useRef<number | null>(null)
  const pdfPageMemoryRef = useRef<Record<string, number>>({})
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [pdfIsRendering, setPdfIsRendering] = useState(false)
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null)

  const docxContainerRef = useRef<HTMLDivElement | null>(null)
  const [docxIsRendering, setDocxIsRendering] = useState(false)
  const [docxRenderError, setDocxRenderError] = useState<string | null>(null)

  const spreadsheetSheetMemoryRef = useRef<Record<string, string>>({})
  const [spreadsheetWorkbook, setSpreadsheetWorkbook] = useState<XlsxPreviewWorkbook | null>(null)
  const [spreadsheetActiveSheet, setSpreadsheetActiveSheet] = useState('')
  const [spreadsheetRenderError, setSpreadsheetRenderError] = useState<string | null>(null)
  const pdfContent = previewFile?.type === 'pdf' ? previewFile.content : null
  const pptxContent = previewFile?.type === 'pptx' ? previewFile.content : null
  const docxContent = previewFile?.type === 'docx' ? previewFile.content : null
  const spreadsheetContent = previewFile?.type === 'xlsx' ? previewFile.content : null

  useEffect(() => {
    const stopResizeDrag = () => {
      isDraggingRight.current = false
      setIsResizeDragging(false)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRight.current) return
      const minWidth = previewFile ? 520 : 320
      const availableWidth = Math.max(window.innerWidth || 0, minWidth)
      const maxWidth = previewFile
        ? Math.max(960, Math.min(availableWidth - 420, Math.floor(availableWidth * 0.78)))
        : Math.min(620, Math.max(320, availableWidth - 520))
      const newWidth = Math.min(Math.max(window.innerWidth - event.clientX, minWidth), maxWidth)
      onResize(newWidth)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResizeDrag)
    window.addEventListener('blur', stopResizeDrag)
    document.addEventListener('mouseleave', stopResizeDrag)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResizeDrag)
      window.removeEventListener('blur', stopResizeDrag)
      document.removeEventListener('mouseleave', stopResizeDrag)
    }
  }, [onResize, previewFile])

  useEffect(() => {
    let cancelled = false

    const getPdfAssetBaseUrl = window.piDesktop?.desktop?.getPdfAssetBaseUrl
    if (!getPdfAssetBaseUrl) return

    void getPdfAssetBaseUrl()
      .then(async (result) => {
        if (cancelled || !result.success) return
        const { configurePdfPreviewAssetBaseUrl } = await import('../lib/pdf-preview')
        if (!cancelled) {
          configurePdfPreviewAssetBaseUrl(result.data)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

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

  useEffect(() => {
    if (collapsed) {
      if (previewFile) {
        savedPreviewScrollRef.current = previewBodyRef.current?.scrollTop || 0
      }
      return
    }

    if (previewFile && previewBodyRef.current) {
      requestAnimationFrame(() => {
        if (previewBodyRef.current) {
          previewBodyRef.current.scrollTop = savedPreviewScrollRef.current
        }
      })
    }
  }, [collapsed, previewFile?.path, previewFile])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'image') {
      setImageViewMode('fit')
      setImageZoom(1)
      return
    }

    const saved = imageViewMemoryRef.current[previewFile.path]
    setImageViewMode(saved?.mode || 'fit')
    setImageZoom(saved?.zoom || 1)
  }, [previewFile?.path, previewFile?.type, docxContent])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'image') return
    imageViewMemoryRef.current[previewFile.path] = {
      mode: imageViewMode,
      zoom: imageZoom,
    }
  }, [imageViewMode, imageZoom, previewFile])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'pptx') {
      pptxFrameReadyRef.current = false
      pptxActiveRequestRef.current = null
      pptxLastAutoLoadFileRef.current = null
      if (pptxRequestTimeoutRef.current !== null) {
        window.clearTimeout(pptxRequestTimeoutRef.current)
        pptxRequestTimeoutRef.current = null
      }
      setPptxCurrentSlide(0)
      setPptxSlideCount(0)
      setPptxScrollTop(0)
      setPptxIsRendering(false)
      setPptxRenderError(null)
      return
    }

    const savedView = pptxViewMemoryRef.current[previewFile.path] || {
      currentSlide: 0,
      scrollTop: 0,
    }
    pptxLastAutoLoadFileRef.current = null
    setPptxCurrentSlide(savedView.currentSlide)
    setPptxSlideCount(0)
    setPptxScrollTop(savedView.scrollTop)
    setPptxIsRendering(false)
    setPptxRenderError(null)
  }, [previewFile?.path, previewFile?.type, pptxContent])

  useEffect(() => {
    const handlePptxViewerMessage = (event: MessageEvent) => {
      const payload = event.data as PptxViewerMessage | undefined

      if (!payload || payload.source !== PPTX_VIEWER_CHANNEL || !payload.type) return
      const frameWindow = pptxFrameRef.current?.contentWindow
      if (frameWindow && event.source !== frameWindow) return

      if (payload.type === 'ready') {
        pptxFrameReadyRef.current = true
        setPptxFrameReadyTick((value) => value + 1)
        return
      }

      if (!previewFile || previewFile.type !== 'pptx' || payload.fileKey !== previewFile.path) return

      const syncPptxStatus = () => {
        if (typeof payload.slideCount === 'number') {
          setPptxSlideCount(payload.slideCount)
        }

        if (typeof payload.currentSlide === 'number' || typeof payload.scrollTop === 'number') {
          const previousView = pptxViewMemoryRef.current[previewFile.path] || {
            currentSlide: 0,
            scrollTop: 0,
          }
          const nextView = {
            currentSlide:
              typeof payload.currentSlide === 'number' ? payload.currentSlide : previousView.currentSlide,
            scrollTop: typeof payload.scrollTop === 'number' ? payload.scrollTop : previousView.scrollTop,
          }
          pptxViewMemoryRef.current[previewFile.path] = nextView
          setPptxCurrentSlide(nextView.currentSlide)
          setPptxScrollTop(nextView.scrollTop)
        }
      }

      if (payload.type === 'status') {
        syncPptxStatus()
        return
      }

      const activeRequest = pptxActiveRequestRef.current
      if (!activeRequest) return
      if (payload.fileKey !== activeRequest.fileKey || payload.requestId !== activeRequest.requestId) return

      if (payload.type === 'error') {
        clearPptxRequestTimeout()
        pptxActiveRequestRef.current = null
        setPptxSlideCount(0)
        setPptxIsRendering(false)
        setPptxRenderError(payload.message || 'This presentation could not be rendered in the viewer.')
        return
      }

      syncPptxStatus()
      clearPptxRequestTimeout()
      pptxActiveRequestRef.current = null
      if (payload.type === 'slideError') {
        setPptxRenderError(null)
        setPptxIsRendering(false)
        return
      }
      setPptxRenderError(null)
      setPptxIsRendering(false)
    }

    window.addEventListener('message', handlePptxViewerMessage)
    return () => window.removeEventListener('message', handlePptxViewerMessage)
  }, [previewFile])

  useEffect(() => {
    const handleHtmlPreviewMessage = (event: MessageEvent) => {
      const payload = event.data as { source?: string; href?: string } | undefined
      if (!payload || payload.source !== 'pi-html-preview-link' || !payload.href) return
      void window.piDesktop.shell.openExternal(payload.href)
    }

    window.addEventListener('message', handleHtmlPreviewMessage)
    return () => window.removeEventListener('message', handleHtmlPreviewMessage)
  }, [])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'pdf') {
      pdfRenderRequestIdRef.current += 1
      pdfLastObservedStageWidthRef.current = null
      clearPdfResizeRerender()
      pdfActiveRenderTaskRef.current?.cancel?.()
      pdfLoadingTaskRef.current?.destroy?.()
      pdfDocumentRef.current?.cleanup?.()
      pdfDocumentRef.current?.destroy?.()
      pdfActiveRenderTaskRef.current = null
      pdfLoadingTaskRef.current = null
      pdfDocumentRef.current = null
      setPdfCurrentPage(1)
      setPdfPageCount(0)
      setPdfIsRendering(false)
      setPdfRenderError(null)
      return
    }

    const savedPage = pdfPageMemoryRef.current[previewFile.path] ?? 1
    setPdfCurrentPage(savedPage)
    setPdfPageCount(0)
    setPdfIsRendering(false)
    setPdfRenderError(null)
  }, [previewFile?.path, previewFile?.type, pdfContent])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'docx') {
      setDocxIsRendering(false)
      setDocxRenderError(null)
      return
    }

    setDocxIsRendering(false)
    setDocxRenderError(null)
  }, [previewFile?.path, previewFile?.type])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'xlsx') {
      setSpreadsheetWorkbook(null)
      setSpreadsheetActiveSheet('')
      setSpreadsheetRenderError(null)
      return
    }
    const content = spreadsheetContent
    if (!content) return

    let cancelled = false
    setSpreadsheetWorkbook(null)
    setSpreadsheetActiveSheet('')
    setSpreadsheetRenderError(null)

    parseXlsxPreview(toUint8Array(content))
      .then((workbook) => {
        if (cancelled) return

        const savedSheet = spreadsheetSheetMemoryRef.current[previewFile.path]
        const firstSheet = workbook.sheetNames[0] || ''
        const nextSheet = savedSheet && workbook.sheetNames.includes(savedSheet) ? savedSheet : firstSheet

        setSpreadsheetWorkbook(workbook)
        setSpreadsheetActiveSheet(nextSheet)
        setSpreadsheetRenderError(null)
      })
      .catch((error) => {
        if (cancelled) return

        setSpreadsheetWorkbook(null)
        setSpreadsheetActiveSheet('')
        setSpreadsheetRenderError(getRenderErrorMessage(error, 'This workbook could not be parsed for preview.'))
      })

    return () => {
      cancelled = true
    }
  }, [previewFile?.path, previewFile?.type, spreadsheetContent])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'xlsx' || !spreadsheetActiveSheet) return
    spreadsheetSheetMemoryRef.current[previewFile.path] = spreadsheetActiveSheet
  }, [previewFile, spreadsheetActiveSheet])

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

  const spreadsheetSheetView = useMemo(() => {
    if (!previewFile || previewFile.type !== 'xlsx' || !spreadsheetWorkbook || !spreadsheetActiveSheet) {
      return null
    }

    const sheet = spreadsheetWorkbook.sheets.find((item) => item.name === spreadsheetActiveSheet)
    if (!sheet) return null

    return buildSpreadsheetSheetView(sheet)
  }, [previewFile, spreadsheetWorkbook, spreadsheetActiveSheet])

  const postPptxViewerMessage = (message: Record<string, unknown>) => {
    pptxFrameRef.current?.contentWindow?.postMessage(
      {
        source: PPTX_VIEWER_CHANNEL,
        ...message,
      },
      '*',
    )
  }

  const clearPptxRequestTimeout = () => {
    if (pptxRequestTimeoutRef.current !== null) {
      window.clearTimeout(pptxRequestTimeoutRef.current)
      pptxRequestTimeoutRef.current = null
    }
  }

  const clearPdfResizeRerender = () => {
    if (pdfResizeRerenderTimeoutRef.current !== null) {
      window.clearTimeout(pdfResizeRerenderTimeoutRef.current)
      pdfResizeRerenderTimeoutRef.current = null
    }
  }

  const armPptxRequestTimeout = (fileKey: string, requestId: number) => {
    clearPptxRequestTimeout()
    pptxRequestTimeoutRef.current = window.setTimeout(() => {
      const activeRequest = pptxActiveRequestRef.current
      if (!activeRequest || activeRequest.fileKey !== fileKey || activeRequest.requestId !== requestId) {
        return
      }

      setPptxSlideCount(0)
      setPptxIsRendering(false)
      pptxActiveRequestRef.current = null
      pptxRequestTimeoutRef.current = null
      setPptxRenderError('The presentation viewer did not respond. Showing the text fallback instead.')
    }, 8000)
  }

  const requestPptxLoad = (slideIndex?: number, mode: 'auto' | 'manual' = 'auto') => {
    if (!previewFile || previewFile.type !== 'pptx' || collapsed || !pptxFrameReadyRef.current) return

    if (mode === 'auto' && pptxLastAutoLoadFileRef.current === previewFile.path) {
      return
    }

    const requestId = pptxRequestIdRef.current + 1
    pptxRequestIdRef.current = requestId
    const fileKey = previewFile.path
    const savedView = pptxViewMemoryRef.current[fileKey] || { currentSlide: 0, scrollTop: 0 }
    const targetSlide =
      typeof slideIndex === 'number'
        ? slideIndex
        : Math.max(0, savedView.currentSlide)

    if (mode === 'auto') {
      pptxLastAutoLoadFileRef.current = fileKey
    }

    pptxActiveRequestRef.current = { fileKey, requestId }
    setPptxIsRendering(true)
    setPptxRenderError(null)
    armPptxRequestTimeout(fileKey, requestId)
    postPptxViewerMessage({
      type: 'load',
      fileKey,
      requestId,
      slideIndex: targetSlide,
      initialScrollTop: savedView.scrollTop,
      content: previewFile.content,
    })
  }

  const renderPdfPage = async (
    documentProxy: PdfDocumentProxyLike,
    pageNumber: number,
    requestId: number,
  ): Promise<boolean> => {
    const previousRender = pdfRenderInFlightRef.current
    if (previousRender) {
      try {
        await previousRender
      } catch {
        // A cancelled stale render should not block the next requested page.
      }
    }
    if (requestId !== pdfRenderRequestIdRef.current) {
      return false
    }

    const visibleCanvas = pdfCanvasRef.current
    const stage = pdfStageRef.current

    if (!visibleCanvas || !stage) {
      throw new Error('The PDF canvas is not available.')
    }

    const page = await documentProxy.getPage(pageNumber)
    if (requestId !== pdfRenderRequestIdRef.current) {
      page.cleanup?.()
      return false
    }

    const baseViewport = page.getViewport({ scale: 1 })
    const availableWidth = Math.max(stage.clientWidth - 48, 320)
    const scale = Math.max(Math.min(availableWidth / baseViewport.width, 2), 0.75)
    const viewport = page.getViewport({ scale })
    const outputScale = window.devicePixelRatio || 1
    const renderCanvas = document.createElement('canvas')
    const context = renderCanvas.getContext('2d')

    if (!context) {
      throw new Error('The PDF canvas context is unavailable.')
    }

    if (requestId !== pdfRenderRequestIdRef.current) {
      page.cleanup?.()
      return false
    }

    renderCanvas.width = Math.floor(viewport.width * outputScale)
    renderCanvas.height = Math.floor(viewport.height * outputScale)
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, renderCanvas.width, renderCanvas.height)

    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
    })
    pdfActiveRenderTaskRef.current = renderTask
    const renderPromise = renderTask.promise.finally(() => {
      if (pdfActiveRenderTaskRef.current === renderTask) {
        pdfActiveRenderTaskRef.current = null
      }
      if (pdfRenderInFlightRef.current === renderPromise) {
        pdfRenderInFlightRef.current = null
      }
    })
    pdfRenderInFlightRef.current = renderPromise

    try {
      await renderPromise
    } catch (error) {
      if (requestId !== pdfRenderRequestIdRef.current) {
        page.cleanup?.()
        return false
      }
      throw error
    }

    if (requestId !== pdfRenderRequestIdRef.current) {
      page.cleanup?.()
      return false
    }

    const visibleContext = visibleCanvas.getContext('2d')
    if (!visibleContext) {
      throw new Error('The PDF canvas context is unavailable.')
    }
    visibleCanvas.width = renderCanvas.width
    visibleCanvas.height = renderCanvas.height
    visibleCanvas.style.width = `${viewport.width}px`
    visibleCanvas.style.height = ''
    visibleCanvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
    visibleContext.setTransform(1, 0, 0, 1, 0, 0)
    visibleContext.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height)
    visibleContext.drawImage(renderCanvas, 0, 0)

    page.cleanup?.()
    return true
  }

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'pptx' || collapsed || !pptxFrameReadyRef.current) {
      return
    }

    requestPptxLoad()
  }, [collapsed, previewFile?.path, previewFile?.type, pptxFrameReadyTick, pptxContent])

  useEffect(() => {
    return () => {
      clearPptxRequestTimeout()
    }
  }, [])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'pdf' || collapsed || !pdfCanvasRef.current || !pdfStageRef.current) {
      return
    }

    let cancelled = false

    const destroyPdf = () => {
      clearPdfResizeRerender()
      pdfActiveRenderTaskRef.current?.cancel?.()
      pdfLoadingTaskRef.current?.destroy?.()
      pdfDocumentRef.current?.cleanup?.()
      pdfDocumentRef.current?.destroy?.()
      pdfActiveRenderTaskRef.current = null
      pdfLoadingTaskRef.current = null
      pdfDocumentRef.current = null
    }

    const loadPdf = async () => {
      destroyPdf()
      const requestId = pdfRenderRequestIdRef.current + 1
      pdfRenderRequestIdRef.current = requestId
      setPdfIsRendering(true)
      setPdfRenderError(null)

      try {
        const { getPdfDocumentLoadingTask } = await import('../lib/pdf-preview')
        const loadingTask = getPdfDocumentLoadingTask(previewFile.content) as unknown as PdfLoadingTaskLike

        pdfLoadingTaskRef.current = loadingTask
        const documentProxy = await loadingTask.promise
        if (cancelled) {
          documentProxy.destroy?.()
          return
        }

        pdfDocumentRef.current = documentProxy
        setPdfPageCount(documentProxy.numPages)
        pdfLastObservedStageWidthRef.current = pdfStageRef.current ? pdfStageRef.current.clientWidth : null
        const targetPage = Math.min(
          Math.max(pdfPageMemoryRef.current[previewFile.path] ?? 1, 1),
          documentProxy.numPages,
        )

        const rendered = await renderPdfPage(documentProxy, targetPage, requestId)
        if (cancelled) return
        if (!rendered) return

        pdfPageMemoryRef.current[previewFile.path] = targetPage
        setPdfCurrentPage(targetPage)
      } catch (error) {
        if (!cancelled) {
          setPdfPageCount(0)
          setPdfRenderError(getRenderErrorMessage(error, 'This PDF could not be rendered in the viewer.'))
        }
      } finally {
        if (!cancelled) {
          setPdfIsRendering(false)
        }
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
      pdfRenderRequestIdRef.current += 1
      pdfActiveRenderTaskRef.current?.cancel?.()
      destroyPdf()
    }
  }, [collapsed, previewFile?.path, previewFile?.type, pdfContent, pdfRenderError])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'pdf' || collapsed) {
      return
    }

    const documentProxy = pdfDocumentRef.current
    if (!documentProxy || !pdfCanvasRef.current || !pdfStageRef.current) {
      return
    }

    clearPdfResizeRerender()
    pdfResizeRerenderTimeoutRef.current = window.setTimeout(() => {
      pdfResizeRerenderTimeoutRef.current = null
      const activeDocument = pdfDocumentRef.current
      const stage = pdfStageRef.current
      if (!activeDocument || !pdfCanvasRef.current || !stage) return

      const nextWidth = stage.clientWidth
      const previousWidth = pdfLastObservedStageWidthRef.current
      if (previousWidth !== null && Math.abs(nextWidth - previousWidth) < 2) {
        return
      }
      pdfLastObservedStageWidthRef.current = nextWidth

      const requestId = pdfRenderRequestIdRef.current + 1
      pdfRenderRequestIdRef.current = requestId
      setPdfIsRendering(true)
      setPdfRenderError(null)

      void renderPdfPage(activeDocument, pdfCurrentPage, requestId)
        .catch((error) => {
          if (requestId === pdfRenderRequestIdRef.current) {
            setPdfRenderError(getRenderErrorMessage(error, 'This PDF could not be rendered in the viewer.'))
          }
        })
        .finally(() => {
          if (requestId === pdfRenderRequestIdRef.current) {
            setPdfIsRendering(false)
          }
        })
    }, 120)

    return clearPdfResizeRerender
  }, [collapsed, panelWidth, previewFile?.path, previewFile?.type])

  useEffect(() => {
    if (!previewFile || previewFile.type !== 'docx' || collapsed || !docxContainerRef.current) {
      return
    }

    let cancelled = false
    const container = docxContainerRef.current
    container.innerHTML = ''

    const renderDocx = async () => {
      setDocxIsRendering(true)
      setDocxRenderError(null)

      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled || !docxContainerRef.current) return

        await renderAsync(toArrayBuffer(previewFile.content), docxContainerRef.current, undefined, {
          className: 'pv-docx-stage',
          inWrapper: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        })
        if (!cancelled && docxContainerRef.current) {
          normalizeDocxPreviewLayout(docxContainerRef.current)
        }
      } catch (error) {
        if (!cancelled) {
          setDocxRenderError(getRenderErrorMessage(error, 'This document could not be rendered in the viewer.'))
        }
      } finally {
        if (!cancelled) {
          setDocxIsRendering(false)
        }
      }
    }

    void renderDocx()

    return () => {
      cancelled = true
      container.innerHTML = ''
    }
  }, [collapsed, previewFile?.path, previewFile?.type, docxContent])

  const handlePptxNavigate = async (targetSlide: number) => {
    if (!previewFile || previewFile.type !== 'pptx' || !pptxFrameReadyRef.current) return

    const nextSlide = Math.max(0, Math.min(targetSlide, Math.max(pptxSlideCount - 1, 0)))
    const requestId = pptxRequestIdRef.current + 1
    pptxRequestIdRef.current = requestId
    pptxActiveRequestRef.current = { fileKey: previewFile.path, requestId }

    setPptxIsRendering(true)
    setPptxRenderError(null)
    armPptxRequestTimeout(previewFile.path, requestId)

    postPptxViewerMessage({
      type: 'navigate',
      fileKey: previewFile.path,
      requestId,
      slideIndex: nextSlide,
    })
  }

  const handlePdfNavigate = async (targetPage: number) => {
    if (!previewFile || previewFile.type !== 'pdf') return
    const documentProxy = pdfDocumentRef.current
    if (!documentProxy) return

    const nextPage = Math.max(1, Math.min(targetPage, Math.max(pdfPageCount, 1)))
    const requestId = pdfRenderRequestIdRef.current + 1
    pdfRenderRequestIdRef.current = requestId
    setPdfIsRendering(true)
    setPdfRenderError(null)

    try {
      const rendered = await renderPdfPage(documentProxy, nextPage, requestId)
      if (!rendered) return
      pdfPageMemoryRef.current[previewFile.path] = nextPage
      setPdfCurrentPage(nextPage)
    } catch (error) {
      if (requestId === pdfRenderRequestIdRef.current) {
        setPdfRenderError(getRenderErrorMessage(error, 'This PDF could not be rendered in the viewer.'))
      }
    } finally {
      if (requestId === pdfRenderRequestIdRef.current) {
        setPdfIsRendering(false)
      }
    }
  }

  const renderMarkdownPreview = () => {
    if (!previewFile || previewFile.type !== 'text') return null

    return (
      <div className="pv-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }: any) => {
              const resolvedHref = href ? resolvePreviewResourceUrl(href, previewFile.path) : undefined
              return (
                <a
                  {...props}
                  href={resolvedHref}
                  rel="noreferrer"
                  onClick={(event) => {
                    event.preventDefault()
                    if (resolvedHref) void window.piDesktop.shell.openExternal(resolvedHref)
                  }}
                >
                  {children}
                </a>
              )
            },
            img: ({ src, alt, ...props }: any) => (
              <img
                {...props}
                src={resolvePreviewResourceUrl(src, previewFile.path)}
                alt={alt || ''}
                className="pv-md-image"
              />
            ),
            code: ({ inline, className, children, ...props }: any) => {
              if (inline) {
                return (
                  <code {...props} className={className}>
                    {children}
                  </code>
                )
              }

              return (
                <pre className="pv-md-code">
                  <code {...props} className={className}>
                    {children}
                  </code>
                </pre>
              )
            },
          }}
        >
          {previewFile.content}
        </ReactMarkdown>
      </div>
    )
  }

  const renderHtmlPreview = () => {
    if (!previewFile || previewFile.type !== 'text') return null

    return (
      <div className="pv-html-wrap">
        <iframe
          className="pv-html-frame"
          title={previewFile.name}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          srcDoc={buildHtmlSrcDoc(previewFile.content, previewFile.path)}
        />
      </div>
    )
  }

  const renderImagePreview = () => {
    if (!previewFile || previewFile.type !== 'image') return null

    const isActualSize = imageViewMode === 'actual'
    const imageStyle: CSSProperties = isActualSize
      ? {
          transform: `scale(${imageZoom})`,
          transformOrigin: 'top center',
          maxWidth: 'none',
          width: 'auto',
        }
      : {
          width: `${imageZoom * 100}%`,
          maxWidth: 'none',
          height: 'auto',
        }

    return (
      <div className="pv-image-viewer">
        <div className="pv-image-toolbar">
          <button
            type="button"
            className={`pv-mode-chip ${imageViewMode === 'fit' ? 'active' : ''}`}
            onClick={() => setImageViewMode('fit')}
          >
            Fit Width
          </button>
          <button
            type="button"
            className={`pv-mode-chip ${imageViewMode === 'actual' ? 'active' : ''}`}
            onClick={() => setImageViewMode('actual')}
          >
            Actual Size
          </button>
          <button type="button" className="pv-mini-btn" onClick={() => setImageZoom((value) => Math.max(0.5, value - 0.1))}>
            -
          </button>
          <div className="pv-viewer-status">{`${Math.round(imageZoom * 100)}%`}</div>
          <button type="button" className="pv-mini-btn" onClick={() => setImageZoom((value) => Math.min(3, value + 0.1))}>
            +
          </button>
        </div>
        <div className="pv-image-stage">
          <img src={previewFile.content} alt={previewFile.name} style={imageStyle} className="pv-image-canvas" />
        </div>
      </div>
    )
  }

  const renderPdfPreview = () => {
    if (!previewFile || previewFile.type !== 'pdf') return null

    const canGoPrevious = pdfCurrentPage > 1 && !pdfIsRendering
    const canGoNext = pdfCurrentPage < pdfPageCount && !pdfIsRendering

    if (pdfRenderError) {
      return (
        <div className="pv-viewer-shell">
          <SummaryAlert message="PDF rendering failed. Use Open for the native viewer if needed." />
          <div className="pv-empty-note">{pdfRenderError}</div>
        </div>
      )
    }

    return (
      <div className="pv-viewer-shell">
        <div className="pv-viewer-toolbar">
          <button
            type="button"
            className="pv-mini-btn"
            aria-label="Previous page"
            disabled={!canGoPrevious}
            onClick={() => {
              void handlePdfNavigate(pdfCurrentPage - 1)
            }}
          >
            Previous
          </button>
          <div className="pv-viewer-status">
            {pdfPageCount > 0 ? `${pdfCurrentPage} / ${pdfPageCount}` : '0 / 0'}
          </div>
          <button
            type="button"
            className="pv-mini-btn"
            aria-label="Next page"
            disabled={!canGoNext}
            onClick={() => {
              void handlePdfNavigate(pdfCurrentPage + 1)
            }}
          >
            Next
          </button>
        </div>
        <div className="pv-viewer-stage" ref={pdfStageRef}>
          {pdfIsRendering && <div className="pv-viewer-loading">Loading PDF...</div>}
          <div className="pv-canvas-shell pv-pdf-canvas-shell">
            <canvas ref={pdfCanvasRef} className="pv-doc-canvas" />
          </div>
        </div>
      </div>
    )
  }

  const renderDocxPreview = () => {
    if (!previewFile || previewFile.type !== 'docx') return null

    if (docxRenderError) {
      return (
        <div className="pv-viewer-shell">
          <SummaryAlert message="Document rendering failed. Showing HTML fallback instead." />
          {previewFile.fallbackHtml ? (
            <iframe
              className="pv-html-frame pv-docx-fallback-frame"
              title={`${previewFile.name} fallback`}
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              srcDoc={buildHtmlSrcDoc(previewFile.fallbackHtml, previewFile.path)}
            />
          ) : (
            <div className="pv-empty-note">{docxRenderError}</div>
          )}
        </div>
      )
    }

    return (
      <div className="pv-viewer-shell">
        {docxIsRendering && <div className="pv-viewer-loading">Loading document...</div>}
        <div className="pv-docx-wrap">
          <div ref={docxContainerRef} className="pv-docx-root" />
        </div>
      </div>
    )
  }

  const renderPptxPreview = () => {
    if (!previewFile || previewFile.type !== 'pptx') return null

    const pptxSummary = previewFile.summary ?? []
    const canGoPrevious = pptxCurrentSlide > 0 && !pptxIsRendering
    const canGoNext = pptxCurrentSlide < pptxSlideCount - 1 && !pptxIsRendering

    if (pptxRenderError) {
      return (
        <div className="pv-viewer-shell pv-pptx-shell pv-pptx-fallback-shell">
          <SummaryAlert message="Slide rendering failed. Showing extracted text instead." />
          <div className="pv-empty-note pv-empty-inline">{pptxRenderError}</div>
          {pptxSummary.length > 0 ? (
            <div className="pv-office-stack">
              {pptxSummary.map((slide: { index: number; title: string; summary: string }) => (
                <div key={slide.index} className="pv-office-card">
                  <div className="pv-office-kicker">{`Slide ${slide.index}`}</div>
                  <div className="pv-office-title">{slide.title}</div>
                  <div className="pv-office-copy">{slide.summary}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )
    }

    return (
      <div className="pv-viewer-shell pv-pptx-shell">
        <div className="pv-viewer-toolbar">
          <button
            type="button"
            className="pv-mini-btn"
            aria-label="Previous slide"
            disabled={!canGoPrevious}
            onClick={() => {
              void handlePptxNavigate(pptxCurrentSlide - 1)
            }}
          >
            Previous
          </button>
          <div className="pv-viewer-status">
            {pptxSlideCount > 0 ? `${pptxCurrentSlide + 1} / ${pptxSlideCount}` : '0 / 0'}
          </div>
          <button
            type="button"
            className="pv-mini-btn"
            aria-label="Next slide"
            disabled={!canGoNext}
            onClick={() => {
              void handlePptxNavigate(pptxCurrentSlide + 1)
            }}
          >
            Next
          </button>
        </div>
        <div className="pv-viewer-stage pv-pptx-stage-shell">
          {pptxIsRendering && <div className="pv-viewer-loading">Loading presentation...</div>}
          <div className="pv-canvas-shell pv-pptx-frame-wrap">
            <iframe
              ref={pptxFrameRef}
              title={`${previewFile.name} viewer`}
              src={pptxViewerPageUrl}
              className="pv-pptx-frame"
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => {
                pptxFrameReadyRef.current = true
                setPptxFrameReadyTick((value) => value + 1)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const renderSpreadsheetFallback = (message: string | null) => {
    if (!previewFile || previewFile.type !== 'xlsx') return null

    return (
      <div className="pv-office-stack">
        {message && <SummaryAlert message="Workbook rendering failed. Showing extracted sheet summary instead." />}
        {previewFile.summary?.sheets?.length ? (
          previewFile.summary.sheets.map((sheet: { name: string; rows: string[][] }) => (
            <div key={`${previewFile.path}-${sheet.name}`} className="pv-office-card">
              <div className="pv-office-title">{sheet.name}</div>
              {sheet.rows.length === 0 ? (
                <div className="pv-empty-note pv-empty-inline">No visible rows in this sheet preview.</div>
              ) : (
                <div className="pv-sheet-wrap">
                  <table className="pv-sheet-table">
                    <tbody>
                      {sheet.rows.map((row: string[], rowIndex: number) => (
                        <tr key={`${sheet.name}-${rowIndex}`}>
                          {row.map((cell: string, cellIndex: number) => (
                            <td key={`${sheet.name}-${rowIndex}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="pv-empty-note">{message || 'No sheet data could be extracted from this workbook.'}</div>
        )}
      </div>
    )
  }

  const renderSpreadsheetPreview = () => {
    if (!previewFile || previewFile.type !== 'xlsx') return null

    if (spreadsheetRenderError || !spreadsheetWorkbook || !spreadsheetSheetView) {
      return renderSpreadsheetFallback(spreadsheetRenderError)
    }

    return (
      <div className="pv-viewer-shell">
        <div className="pv-sheet-tabs">
          {spreadsheetWorkbook.sheetNames.map((sheetName) => (
            <button
              key={sheetName}
              type="button"
              className={`pv-sheet-tab ${sheetName === spreadsheetActiveSheet ? 'active' : ''}`}
              onClick={() => setSpreadsheetActiveSheet(sheetName)}
            >
              {sheetName}
            </button>
          ))}
        </div>
        <div className="pv-sheet-stage">
          <div className="pv-sheet-grid-wrap">
            <table className="pv-sheet-grid">
              <tbody>
                {spreadsheetSheetView.rows.map((row, rowIndex) => (
                  <tr key={`${spreadsheetSheetView.name}-${rowIndex}`}>
                    {row.map((cell) => (
                      <td
                        key={cell.key}
                        colSpan={cell.colSpan}
                        rowSpan={cell.rowSpan}
                        className={cell.isHeader ? 'is-header' : ''}
                        style={cell.width ? { minWidth: `${cell.width}px` } : undefined}
                      >
                        {cell.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

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

  const isMarkdownFile = previewFile?.type === 'text' && previewFile.ext.toLowerCase() === '.md'
  const isHtmlFile = previewFile?.type === 'text' && ['.html', '.htm'].includes(previewFile.ext.toLowerCase())
  const hasPreview =
    previewFile?.type === 'image' ||
    previewFile?.type === 'pdf' ||
    previewFile?.type === 'docx' ||
    previewFile?.type === 'pptx' ||
    previewFile?.type === 'xlsx' ||
    isMarkdownFile ||
    isHtmlFile
  const canShowSource = Boolean(previewFile?.type === 'text' && (isMarkdownFile || isHtmlFile))
  const currentArtifact = recentResults[0] || null
  const workspaceLabel =
    currentWorkspace?.split(/[\\/]/).filter(Boolean).pop() ||
    currentWorkspace ||
    'No folder'
  const effectiveWidth = previewFile ? Math.max(panelWidth, 640) : panelWidth

  return (
    <div
      className={`prev ${previewFile ? 'preview-mode' : 'workbench-mode'}`}
      style={{ width: effectiveWidth, position: 'relative', overflow: 'hidden' }}
    >
      <div
        className="resize-h"
        style={{ left: -2 }}
        onMouseDown={(event) => {
          event.preventDefault()
          isDraggingRight.current = true
          setIsResizeDragging(true)
        }}
      />
      {isResizeDragging && <div className="resize-capture" aria-hidden="true" />}

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

        {openError && <div className="pv-open-error">{openError}</div>}

        {previewFile ? (
          <div
            ref={previewBodyRef}
            className={`pv-body ${previewFile.type === 'pptx' ? 'pv-pptx-preview-body' : ''}`}
          >
            {previewFile.type === 'image' && renderImagePreview()}

            {isMarkdownFile && previewMode === 'preview' && renderMarkdownPreview()}

            {isHtmlFile && previewMode === 'preview' && renderHtmlPreview()}

            {previewFile.type === 'text' && (!hasPreview || previewMode === 'source' || (!isMarkdownFile && !isHtmlFile)) && (
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

            {previewFile.type === 'pdf' && renderPdfPreview()}

            {previewFile.type === 'docx' && renderDocxPreview()}

            {previewFile.type === 'pptx' && renderPptxPreview()}

            {previewFile.type === 'xlsx' && renderSpreadsheetPreview()}

            {previewFile.type === 'binary' && (
              <div style={{ padding: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                <div style={{ marginBottom: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Preview unavailable</div>
                <div style={{ marginBottom: 8 }}>{previewFile.reason || 'Preview not available for this file type.'}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{previewFile.path}</div>
              </div>
            )}
          </div>
        ) : (
          <div ref={workbenchBodyRef} className="pv-body pv-workbench-body">
            <SectionShell
              title="Progress"
              badge={runtimeStatus?.statusLabel || runActivity?.statusLabel || 'Idle'}
              collapsed={sections.progress}
              onToggle={() => setSections((previous) => ({ ...previous, progress: !previous.progress }))}
            >
              <ProgressSection runtimeStatus={runtimeStatus} runActivity={runActivity} currentArtifact={currentArtifact} />
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
                error={workspaceError}
                onSelectFile={onSelectFile}
                onToggleDirectory={onToggleWorkspaceDirectory}
                currentWorkspace={currentWorkspace}
                onWorkspaceRefresh={onWorkspaceRefresh}
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
