import { useState } from 'react'
import type { Session } from '../types/chat'

interface LeftPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function LeftPanel({ sessions, activeSessionId, onSessionSelect, collapsed, onToggleCollapse }: LeftPanelProps) {
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-[#0F172A] border-r border-[#1E293B] flex flex-col items-center pt-2">
        <button onClick={onToggleCollapse} className="text-[10px] text-dim hover:text-muted mb-4" style={{ writingMode: 'vertical-lr', letterSpacing: '2px' }}>
          EXPAND
        </button>
      </div>
    )
  }

  return (
    <div className="w-[140px] flex-shrink-0 bg-[#0F172A] border-r border-[#1E293B] flex flex-col">
      <div className="px-1.5 pt-2 pb-1">
        {['Files', 'Tools', 'Skills', 'Memory'].map((item, i) => (
          <div
            key={item}
            className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
              i === 0 ? 'bg-surface text-[#F1F5F9]' : 'text-muted hover:bg-surface hover:text-[#F1F5F9]'
            }`}
          >
            {item}
          </div>
        ))}
      </div>

      <div className="h-px bg-[#1E293B] mx-2.5 my-1" />

      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[9px] uppercase tracking-wider text-dim font-semibold">Sessions</span>
        <button className="text-dim hover:text-muted text-sm leading-none transition-colors">+</button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-1">
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSessionSelect(s.id)}
            className={`px-2 py-1 mb-px rounded text-xs cursor-pointer transition-all truncate ${
              s.id === activeSessionId
                ? 'bg-surface text-[#F1F5F9] font-medium'
                : 'text-muted hover:bg-surface hover:text-[#CBD5E1]'
            }`}
          >
            {s.title}
          </div>
        ))}
      </div>

      <div className="flex gap-1 px-2 py-1 border-t border-[#1E293B] mt-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-1.5 py-0.5 rounded-full text-[9px] ${filter === 'all' ? 'bg-surface text-[#94A3B8]' : 'text-dim hover:text-muted'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-1.5 py-0.5 rounded-full text-[9px] ${filter === 'active' ? 'bg-surface text-[#94A3B8]' : 'text-dim hover:text-muted'}`}
        >
          Active
        </button>
        <button onClick={onToggleCollapse} className="ml-auto text-[9px] text-dim hover:text-muted">◀</button>
      </div>
    </div>
  )
}
