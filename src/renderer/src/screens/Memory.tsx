import { useState } from 'react'

const MOCK_MEMORY = [
  { key: 'user_name', value: 'User', source: 'profile' },
  { key: 'preferred_model', value: 'Sonnet 4.6', source: 'settings' },
  { key: 'working_dir', value: '~/projects/ppt-demo', source: 'settings' },
]

interface MemoryProps { onClose: () => void }

export default function Memory({ onClose }: MemoryProps) {
  const [entries] = useState(MOCK_MEMORY)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: '#1a1919', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>🧠 Memory</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {entries.map(e => (
            <div key={e.key} style={{ padding: '6px 14px' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <code style={{ fontSize: 11, color: 'rgba(0,122,255,0.35)', background: 'rgba(0,122,255,0.04)', padding: '1px 4px', borderRadius: 2 }}>{e.key}</code>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.06)' }}>{e.source}</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{e.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
