import { useState, useEffect } from 'react'

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
}

export default function Files({ onClose, onOpenFile, onAttachFile }: FilesProps) {
  const [currentDir, setCurrentDir] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    // Start from userData or home
    loadDir('')
  }, [])

  async function loadDir(dir: string) {
    if (dir) setHistory(prev => [...prev, currentDir])
    const res = await window.piDesktop.files.list(dir || 'C:\\')
    if (res.success && res.data) {
      const files = res.data as FileEntry[]
      // Sort: dirs first, then by name
      files.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setEntries(files)
      setCurrentDir(dir || 'C:\\')
    }
  }

  async function goUp() {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(h => h.slice(0, -1))
      const res = await window.piDesktop.files.list(prev)
      if (res.success && res.data) {
        const files = (res.data as FileEntry[]).sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setEntries(files)
        setCurrentDir(prev)
      }
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  function iconFor(entry: FileEntry): string {
    if (entry.isDir) return '📁'
    const ext = entry.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'md': return '📄'
      case 'xlsx': case 'xls': return '📊'
      case 'pptx': case 'ppt': return '📊'
      case 'docx': case 'doc': return '📄'
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return '🖼'
      case 'ts': case 'tsx': case 'js': case 'jsx': case 'py': case 'go': case 'rs': return '📝'
      default: return '📄'
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: '#1a1919', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={goUp} style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: history.length > 0 ? 'rgba(0,122,255,0.4)' : 'rgba(255,255,255,0.05)', cursor: history.length > 0 ? 'pointer' : 'default', padding: 0 }}>←</button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentDir}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {entries.map(e => (
            <div key={e.path}
              onDoubleClick={() => e.isDir ? loadDir(e.path) : onOpenFile?.(e.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', cursor: 'pointer', fontSize: 12, color: e.isDir ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)', transition: 'all 120ms' }}
              onMouseEnter={e2 => e2.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e2 => e2.currentTarget.style.background = 'transparent'}
            >
              <span>{iconFor(e)}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
              {!e.isDir && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.06)' }}>{formatSize(e.size)}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
