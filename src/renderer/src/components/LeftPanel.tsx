import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '../types/chat'

interface LeftPanelProps {
  sessions: Session[]
  activeSessionPath: string | null
  onSessionSelect: (path: string) => void
  onSessionCreate: () => void
  onOpenModels: () => void
  onOpenSkills: () => void
  onOpenSettings?: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  panelWidth: number
  onResize: (w: number) => void
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function getDirectoryLabel(cwd: string): string {
  if (!cwd) return 'No directory'
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || cwd
}

export default function LeftPanel({
  sessions,
  activeSessionPath,
  onSessionSelect,
  onSessionCreate,
  onOpenModels,
  onOpenSkills,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
  panelWidth,
  onResize,
}: LeftPanelProps) {
  const [viewMode, setViewMode] = useState<'recent' | 'directory'>('recent')
  const isDraggingLeft = useRef(false)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingLeft.current) return
      const newWidth = Math.min(Math.max(event.clientX, 220), 420)
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingLeft.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  const recentSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map((session) => ({
        ...session,
        cwdLabel: session.cwdLabel || getDirectoryLabel(session.cwd),
        lastActiveLabel: session.lastActiveLabel || formatRelativeTime(session.updatedAt),
      })),
    [sessions],
  )

  const groupedSessions = useMemo(() => {
    return recentSessions.reduce<Record<string, Session[]>>((groups, session) => {
      const key = session.cwd || 'Unknown Directory'
      groups[key] = groups[key] || []
      groups[key].push(session)
      return groups
    }, {})
  }, [recentSessions])

  if (collapsed) {
    return (
      <div
        className="relative"
        style={{ width: 32, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.04)', background: '#1a1919' }}
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
            width: '100%',
            padding: '12px 0',
          }}
        >
          SESSIONS
        </button>
      </div>
    )
  }

  return (
    <div className="left" style={{ width: panelWidth }}>
      <div className="l-primary">
        <button className="bp l-primary-btn" onClick={onSessionCreate} aria-label="New Chat">
          New Chat
        </button>
        <div className="l-view-switch" role="tablist" aria-label="Session views">
          <button
            className={viewMode === 'recent' ? 'active' : ''}
            onClick={() => setViewMode('recent')}
            aria-label="Recent"
          >
            Recent
          </button>
          <button
            className={viewMode === 'directory' ? 'active' : ''}
            onClick={() => setViewMode('directory')}
            aria-label="Directories"
          >
            Directories
          </button>
        </div>
      </div>

      <div className="l-hdr">
        <span className="l-hdr-label">Pi Sessions</span>
        <button onClick={onToggleCollapse} className="l-new" aria-label="Collapse sidebar">
          {'<'}
        </button>
      </div>

      <div className="l-list">
        {recentSessions.length === 0 ? (
          <div className="l-session-empty">
            <div>No sessions yet.</div>
            <div className="cim" style={{ marginTop: 6 }}>
              Start a new chat to create one in your chosen workspace.
            </div>
          </div>
        ) : viewMode === 'recent' ? (
          recentSessions.map((session) => (
            <button
              key={session.path || session.id}
              onClick={() => onSessionSelect(session.path)}
              className={`l-session-card ${session.path === activeSessionPath ? 'active' : ''}`}
              title={`${session.title}\n${session.cwd}`}
            >
              <div className="l-session-title-row">
                <span className="l-session-title">{session.title}</span>
                {session.status && session.status !== 'idle' && (
                  <span className={`l-session-status ${session.status}`} aria-hidden="true" />
                )}
              </div>
              <div className="l-session-meta">{session.cwdLabel}</div>
              <div className="l-session-submeta">
                <span title={session.lastActiveLabel}>{session.lastActiveLabel}</span>
                <span>{session.messageCount || 0} msgs</span>
              </div>
            </button>
          ))
        ) : (
          Object.entries(groupedSessions).map(([cwd, grouped]) => (
            <div key={cwd} className="l-directory-group">
              <div className="l-directory-label">{cwd}</div>
              {grouped.map((session) => (
                <button
                  key={session.path || session.id}
                  onClick={() => onSessionSelect(session.path)}
                  className={`l-session-card ${session.path === activeSessionPath ? 'active' : ''}`}
                >
                  <div className="l-session-title-row">
                    <span className="l-session-title">{session.title}</span>
                    {session.status && session.status !== 'idle' && (
                      <span className={`l-session-status ${session.status}`} aria-hidden="true" />
                    )}
                  </div>
                  <div className="l-session-submeta">
                    <span title={session.lastActiveLabel || formatRelativeTime(session.updatedAt)}>
                      {session.lastActiveLabel || formatRelativeTime(session.updatedAt)}
                    </span>
                    <span>{session.messageCount || 0} msgs</span>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="l-capability">
        <div className="l-section-label">Capabilities</div>
        <button className="l-item" onClick={onOpenModels} aria-label="Models">
          Models
        </button>
        <button className="l-item" onClick={onOpenSkills} aria-label="Skills">
          Skills
        </button>
        {onOpenSettings && (
          <button className="l-item" onClick={onOpenSettings} aria-label="Settings">
            Settings
          </button>
        )}
      </div>

      <div
        className="resize-h"
        style={{ right: -2 }}
        onMouseDown={(event) => {
          event.preventDefault()
          isDraggingLeft.current = true
        }}
      />
    </div>
  )
}
