import { useState } from 'react'

const MOCK_SKILLS = [
  { id: 'expert', name: 'Expert Coder', desc: 'Code generation & review', installed: true },
  { id: 'writer', name: 'Writer', desc: 'Content & documentation', installed: true },
  { id: 'analyst', name: 'Data Analyst', desc: 'Data processing & charts', installed: false },
  { id: 'designer', name: 'UI Designer', desc: 'Interface design help', installed: false },
]

interface SkillsProps { onClose: () => void }

export default function Skills({ onClose }: SkillsProps) {
  const [skills, setSkills] = useState(MOCK_SKILLS)

  function toggle(id: string) {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, installed: !s.installed } : s))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: '#1a1919', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, width: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>📚 Skills</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {skills.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px' }}>
              <span style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.1)' }}>{s.desc}</div>
              </span>
              <button onClick={() => toggle(s.id)}
                style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: s.installed ? 'rgba(48,209,88,0.4)' : 'rgba(255,255,255,0.06)' }}>
                {s.installed ? '●' : '○'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
