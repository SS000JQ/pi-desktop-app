import { useEffect, useState } from 'react'
import type { SkillSummaryEntry } from '../types/chat'

interface SkillsProps {
  onClose: () => void
}

export default function Skills({ onClose }: SkillsProps) {
  const [skills, setSkills] = useState<SkillSummaryEntry[]>([])

  useEffect(() => {
    let active = true
    void window.piDesktop.desktop.getStateSummary().then((response) => {
      if (!active || !response.success || !response.data) return
      setSkills(response.data.skills)
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
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Skills</span>
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
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>
          This panel is now read-only. It reports the real skill sources discovered from Pi CLI instead of mock install toggles.
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {skills.map((skill) => (
            <div key={skill.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span
                style={{
                  marginTop: 5,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: skill.status === 'active' ? 'rgba(48,209,88,0.7)' : 'rgba(255,204,0,0.7)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{skill.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)', marginTop: 4, lineHeight: 1.5 }}>
                  {skill.value}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', marginTop: 4, wordBreak: 'break-all' }}>
                  {skill.source}
                </div>
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <div style={{ padding: '14px', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
              No real skill sources are available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
