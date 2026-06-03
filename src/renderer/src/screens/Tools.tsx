import { useState } from 'react'

const MOCK_TOOLS = [
  { id: 'web_search', name: 'Web Search', desc: 'Search the internet', cat: 'Web', enabled: true },
  { id: 'bash', name: 'Shell', desc: 'Execute shell commands', cat: 'Code', enabled: true },
  { id: 'file_ops', name: 'File Operations', desc: 'Read/write files', cat: 'File', enabled: true },
  { id: 'code', name: 'Code Execution', desc: 'Run code snippets', cat: 'Code', enabled: true },
  { id: 'vision', name: 'Vision', desc: 'Analyze images', cat: 'AI', enabled: true },
  { id: 'memory', name: 'Memory', desc: 'Long-term memory', cat: 'System', enabled: true },
]

interface ToolsProps { onClose: () => void }

export default function Tools({ onClose }: ToolsProps) {
  const [tools, setTools] = useState(MOCK_TOOLS)
  const [filter, setFilter] = useState('')

  const filtered = tools.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.cat.toLowerCase().includes(filter.toLowerCase())
  )

  function toggle(id: string) {
    setTools(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: '#1a1919', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, width: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>🔧 Tools</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search tools..."
            style={{ width: '100%', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 2, fontFamily: 'inherit', fontSize: 12, color: 'rgba(255,255,255,0.5)', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 14px' }}>
              <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.08)', marginLeft: 6, fontSize: 11 }}>{t.desc}</span>
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.06)', minWidth: 30 }}>{t.cat}</span>
              <button onClick={() => toggle(t.id)}
                style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', color: t.enabled ? 'rgba(48,209,88,0.4)' : 'rgba(255,255,255,0.06)' }}>
                {t.enabled ? '●' : '○'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
