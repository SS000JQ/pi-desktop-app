import { useEffect, useState } from 'react'
import type { StateSummaryEntry } from '../types/chat'

interface MemoryProps {
  onClose: () => void
}

export default function Memory({ onClose }: MemoryProps) {
  const [entries, setEntries] = useState<StateSummaryEntry[]>([])

  useEffect(() => {
    let active = true
    void window.piDesktop.desktop.getStateSummary().then((response) => {
      if (!active || !response.success || !response.data) return
      setEntries(response.data.memory)
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          background: '#1a1919',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4,
          width: 460,
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
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Memory</span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {entries.map((entry) => (
            <div key={entry.id} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{entry.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)', marginTop: 4, lineHeight: 1.5 }}>
                {entry.value}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', marginTop: 4, wordBreak: 'break-all' }}>
                {entry.source}
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div style={{ padding: '14px', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
              No real state summary is available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
