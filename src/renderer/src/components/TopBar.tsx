import { useState } from 'react'

interface TopBarProps {
  currentDir: string
  onOpenSettings?: () => void
  onOpenProfile?: () => void
}

export default function TopBar({ currentDir, onOpenSettings, onOpenProfile }: TopBarProps) {
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [currentModel, setCurrentModel] = useState('Sonnet 4.6')
  const models = [
    { id: '1', name: 'Sonnet 4.6' },
    { id: '2', name: 'Opus 4.5' },
    { id: '3', name: 'GPT-4o' },
    { id: '4', name: 'Claude 3.5 Haiku' },
  ]

  return (
    <div className="topbar drag-region">
      <span className="topbar-title">Pi Desktop</span>
      <span className="topbar-path">{currentDir}</span>
      <div className="topbar-right no-drag">
        <div className="relative">
          <div className="mbadge" onClick={() => setShowModelPicker(!showModelPicker)}>
            {currentModel}
          </div>
          {showModelPicker && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: '#1a1919', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 3, minWidth: 180, overflow: 'hidden', zIndex: 20
            }}>
              {models.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>
                  No models configured
                </div>
              ) : models.map(m => (
                <button key={m.id}
                  onClick={() => { setCurrentModel(m.name); setShowModelPicker(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: m.name === currentModel ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: m.name === currentModel ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    textAlign: 'left', cursor: 'pointer', transition: 'all 120ms'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => {
                    if (m.name !== currentModel) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="tk"><span>1,247</span> / 8,000</div>
        <button className="ibtn" title="Search">⌕</button>
        <button className="ibtn" onClick={onOpenProfile} title="Profile">P</button>
        <button className="ibtn" onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    </div>
  )
}
