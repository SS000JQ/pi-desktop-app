import { useEffect, useState } from 'react'

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modifiedAt: string
}

interface FilesProps {
  onClose: () => void
  onOpenFile?: (path: string) => void
  onAttachFile?: (path: string) => void
  initialDir?: string
}

function fileIcon(entry: FileEntry): string {
  if (entry.isDir) return '[dir]'

  const ext = entry.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md':
    case 'txt':
      return '[txt]'
    case 'xlsx':
    case 'xls':
      return '[xls]'
    case 'pptx':
    case 'ppt':
      return '[ppt]'
    case 'docx':
    case 'doc':
      return '[doc]'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return '[img]'
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'go':
    case 'rs':
      return '[code]'
    default:
      return '[file]'
  }
}

export default function Files({ onClose, onOpenFile, onAttachFile, initialDir }: FilesProps) {
  const [currentDir, setCurrentDir] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const rootDir = initialDir || 'C:\\'

  useEffect(() => {
    void loadDir(rootDir)
  }, [rootDir])

  async function loadDir(dir: string) {
    if (dir && currentDir) {
      setHistory((previous) => [...previous, currentDir])
    }

    const response = await window.piDesktop.files.list(dir || rootDir)
    if (!response.success || !response.data) return

    const files = (response.data as FileEntry[]).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    setEntries(files)
    setCurrentDir(dir || rootDir)
  }

  async function goUp() {
    if (history.length === 0) return

    const previousDir = history[history.length - 1]
    setHistory((previous) => previous.slice(0, -1))

    const response = await window.piDesktop.files.list(previousDir)
    if (!response.success || !response.data) return

    const files = (response.data as FileEntry[]).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    setEntries(files)
    setCurrentDir(previousDir)
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          background: '#1a1919',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4,
          width: 480,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <button
            onClick={goUp}
            style={{
              border: 'none',
              background: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              color: history.length > 0 ? 'rgba(0,122,255,0.4)' : 'rgba(255,255,255,0.05)',
              cursor: history.length > 0 ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            Up
          </button>
          <span
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentDir}
          </span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {entries.map((entry) => (
            <div
              key={entry.path}
              onDoubleClick={() => (entry.isDir ? void loadDir(entry.path) : onOpenFile?.(entry.path))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 14px',
                cursor: 'pointer',
                fontSize: 12,
                color: entry.isDir ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
                transition: 'all 120ms',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
              }}
            >
              <span>{fileIcon(entry)}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.name}
              </span>
              {!entry.isDir && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.06)' }}>{formatSize(entry.size)}</span>
              )}
              {!entry.isDir && onAttachFile && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onAttachFile(entry.path)
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    color: 'rgba(0,122,255,0.55)',
                    cursor: 'pointer',
                  }}
                >
                  Attach
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
