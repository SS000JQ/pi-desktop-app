import { useState } from 'react'
import type { Session } from '../types/chat'

interface LeftPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenFiles?: () => void
  onOpenTools?: () => void
  onOpenSkills?: () => void
  onOpenMemory?: () => void
}

export default function LeftPanel({ sessions, activeSessionId, onSessionSelect, collapsed, onToggleCollapse, onOpenFiles, onOpenTools, onOpenSkills, onOpenMemory }: LeftPanelProps) {
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  if (collapsed) {
    return (
      <div className="relative" style={{ width: 32, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.04)', background: '#1a1919' }}>
        <button onClick={onToggleCollapse}
          style={{ writingMode: 'vertical-lr', letterSpacing: '2px', fontSize: 10, color: 'rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", width: '100%', padding: '12px 0' }}>
          EXPAND
        </button>
      </div>
    )
  }

  return (
    <div className="left">
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
        <button className="l-new">+</button>
      </div>

      <div className="l-list">
        {sessions.length === 0 ? (
          <div className="l-session" style={{ cursor: 'default', textAlign: 'center', color: 'rgba(255,255,255,0.08)' }}>
            No sessions yet.
          </div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              onClick={() => onSessionSelect(s.id)}
              className={`l-session ${s.id === activeSessionId ? 'active' : ''}`}
            >
              {s.title}
            </div>
          ))
        )}
      </div>

      <div className="l-fil">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All
        </button>
        <button
          onClick={() => setFilter('active')}
          className={filter === 'active' ? 'active' : ''}
        >
          Active
        </button>
        <button onClick={onToggleCollapse} className="l-new" style={{ marginLeft: 'auto', fontSize: '9px' }}>◀</button>
      </div>
    </div>
  )
}
