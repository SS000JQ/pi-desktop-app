import { useState, useRef, useEffect } from 'react'
import type { Session } from '../types/chat'

interface LeftPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (id: string) => void
  onSessionCreate?: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenFiles?: () => void
  onOpenTools?: () => void
  onOpenSkills?: () => void
  onOpenMemory?: () => void
  panelWidth: number
  onResize: (w: number) => void
}

export default function LeftPanel({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionCreate,
  collapsed,
  onToggleCollapse,
  onOpenFiles,
  onOpenTools,
  onOpenSkills,
  onOpenMemory,
  panelWidth,
  onResize,
}: LeftPanelProps) {
  const [viewMode, setViewMode] = useState<'recent' | 'directory'>('recent')
  const isDraggingLeft = useRef(false)

  const recentSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  const groupedSessions = recentSessions.reduce<Record<string, Session[]>>((groups, session) => {
    const key = session.cwd || 'Unknown Directory'
    groups[key] = groups[key] || []
    groups[key].push(session)
    return groups
  }, {})

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingLeft.current) return
      const newWidth = Math.min(Math.max(e.clientX, 120), 400)
      onResize(newWidth)
    }
    const handleMouseUp = () => { isDraggingLeft.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  if (collapsed) {
    return (
      <div className="relative" style={{ width: 32, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.04)', background: '#1a1919' }}>
        <button
          onClick={onToggleCollapse}
          style={{ writingMode: 'vertical-lr', letterSpacing: '2px', fontSize: 10, color: 'rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", width: '100%', padding: '12px 0' }}
        >
          EXPAND
        </button>
      </div>
    )
  }

  return (
    <div className="left" style={{ width: panelWidth }}>
      <div className="l-list" style={{ padding: '6px 8px 0' }}>
        {[
          { label: 'Files', onClick: onOpenFiles },
          { label: 'Tools', onClick: onOpenTools },
          { label: 'Skills', onClick: onOpenSkills },
          { label: 'Memory', onClick: onOpenMemory },
        ].map((item, i) => (
          <div
            key={item.label}
            onClick={item.onClick}
            className={`l-item ${i === 0 ? 'active' : ''}`}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div className="l-hdr">
        <span className="l-hdr-label">Sessions</span>
        <button className="l-new" onClick={onSessionCreate}>+</button>
      </div>

      <div className="l-list">
        {sessions.length === 0 ? (
          <div className="l-session" style={{ cursor: 'default', textAlign: 'center', color: 'rgba(255,255,255,0.08)' }}>
            No sessions yet.
          </div>
        ) : viewMode === 'recent' ? (
          recentSessions.map((session) => (
            <div
              key={session.path || session.id}
              onClick={() => onSessionSelect(session.id)}
              className={`l-session ${session.id === activeSessionId ? 'active' : ''}`}
              title={`${session.title}\n${session.cwd}`}
            >
              {session.title}
            </div>
          ))
        ) : (
          Object.entries(groupedSessions).map(([cwd, grouped]) => (
            <div key={cwd}>
              <div
                style={{
                  padding: '8px 10px 4px',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.16)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {cwd}
              </div>
              {grouped.map((session) => (
                <div
                  key={session.path || session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`l-session ${session.id === activeSessionId ? 'active' : ''}`}
                  title={session.title}
                >
                  {session.title}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="l-fil">
        <button
          onClick={() => setViewMode('recent')}
          className={viewMode === 'recent' ? 'active' : ''}
        >
          Recent
        </button>
        <button
          onClick={() => setViewMode('directory')}
          className={viewMode === 'directory' ? 'active' : ''}
        >
          Directories
        </button>
        <button onClick={onToggleCollapse} className="l-new" style={{ marginLeft: 'auto', fontSize: '9px' }}>◀</button>
      </div>
      <div
        className="resize-h"
        style={{ right: -2 }}
        onMouseDown={(e) => { e.preventDefault(); isDraggingLeft.current = true }}
      />
    </div>
  )
}
