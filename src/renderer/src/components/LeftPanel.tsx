import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '../types/chat'

interface LeftPanelProps {
  sessions: Session[]
  activeSessionPath: string | null
  pinnedSessionPaths?: string[]
  onPinnedSessionPathsChange?: (paths: string[]) => void
  onSessionSelect: (path: string) => void
  onSessionCreate: () => void
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

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

export default function LeftPanel({
  sessions,
  activeSessionPath,
  pinnedSessionPaths = [],
  onPinnedSessionPathsChange,
  onSessionSelect,
  onSessionCreate,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
  panelWidth,
  onResize,
}: LeftPanelProps) {
  const [collapsedDirectories, setCollapsedDirectories] = useState<Record<string, boolean>>({})
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    session: Session
  } | null>(null)
  const isDraggingLeft = useRef(false)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingLeft.current) return
      const newWidth = Math.min(Math.max(event.clientX, 220), 360)
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

  useEffect(() => {
    if (!contextMenu) return

    const closeMenu = () => setContextMenu(null)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  const recentSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map((session) => ({
        ...session,
        cwdLabel: session.cwdLabel || getDirectoryLabel(session.cwd),
        lastActiveLabel: session.lastActiveLabel || formatRelativeTime(session.updatedAt),
      })),
    [sessions],
  )

  const pinnedPathSet = useMemo(
    () => new Set(pinnedSessionPaths.map((path) => normalizePath(path))),
    [pinnedSessionPaths],
  )

  const pinnedSessions = useMemo(
    () => recentSessions.filter((session) => pinnedPathSet.has(normalizePath(session.path))),
    [pinnedPathSet, recentSessions],
  )

  const groupedSessions = useMemo(() => {
    return recentSessions.filter((session) => !pinnedPathSet.has(normalizePath(session.path))).reduce<Record<string, Session[]>>((groups, session) => {
      const key = session.cwd || 'Unknown Directory'
      groups[key] = groups[key] || []
      groups[key].push(session)
      return groups
    }, {})
  }, [pinnedPathSet, recentSessions])

  const sortedGroups = useMemo(
    () =>
      Object.entries(groupedSessions)
        .map(([cwd, grouped]) => ({
          cwd,
          label: getDirectoryLabel(cwd),
          sessions: grouped,
          updatedAt: Math.max(...grouped.map((session) => session.updatedAt)),
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [groupedSessions],
  )

  const togglePin = (session: Session) => {
    const normalizedSessionPath = normalizePath(session.path)
    const isPinned = pinnedPathSet.has(normalizedSessionPath)
    const nextPaths = isPinned
      ? pinnedSessionPaths.filter((path) => normalizePath(path) !== normalizedSessionPath)
      : [session.path, ...pinnedSessionPaths]
    onPinnedSessionPathsChange?.(nextPaths)
    setContextMenu(null)
  }

  const renderSession = (session: Session, options: { pinned?: boolean } = {}) => {
    const isActive = session.path === activeSessionPath
    const isPinned = pinnedPathSet.has(normalizePath(session.path))

    return (
      <button
        key={session.path || session.id}
        onClick={() => onSessionSelect(session.path)}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY, session })
        }}
        className={`l-session-row ${isActive ? 'active' : ''}`}
        title={`${session.title}\n${session.cwd}\n${session.messageCount || 0} messages`}
        aria-label={session.title}
      >
        <span className={`l-session-dot ${isActive ? 'active' : session.status && session.status !== 'idle' ? session.status : ''}`} />
        <span className="l-session-row-title">{session.title || '(no messages)'}</span>
        {options.pinned || isPinned ? <span className="l-pin-mark" aria-label="Pinned">Pin</span> : null}
        <span className="l-session-row-time">{session.lastActiveLabel || formatRelativeTime(session.updatedAt)}</span>
      </button>
    )
  }

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
        ) : (
          <>
            {pinnedSessions.length > 0 && (
              <div className="l-pinned-group" aria-label="Pinned sessions">
                <div className="l-group-label">Pinned</div>
                {pinnedSessions.map((session) => renderSession(session, { pinned: true }))}
              </div>
            )}

            {sortedGroups.map((group) => {
              const isCollapsed = Boolean(collapsedDirectories[group.cwd])
              return (
                <div key={group.cwd} className="l-directory-group">
                  <button
                    type="button"
                    className="l-directory-label"
                    aria-label={group.cwd}
                    onClick={() => setCollapsedDirectories((previous) => ({ ...previous, [group.cwd]: !previous[group.cwd] }))}
                  >
                    <span className="l-dir-caret">{isCollapsed ? '>' : 'v'}</span>
                    <span className="l-dir-icon" aria-hidden="true">[]</span>
                    <span className="l-dir-name">{group.label}</span>
                  </button>
                  {!isCollapsed && group.sessions.map((session) => renderSession(session))}
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="l-capability">
        {onOpenSettings && (
          <button className="l-footer-item" onClick={onOpenSettings} aria-label="Settings">
            Settings
          </button>
        )}
      </div>

      {contextMenu && (
        <div
          className="l-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => togglePin(contextMenu.session)}>
            {pinnedPathSet.has(normalizePath(contextMenu.session.path)) ? 'Unpin' : 'Pin'}
          </button>
        </div>
      )}

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
