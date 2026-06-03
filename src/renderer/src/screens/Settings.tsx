import { useState, useEffect } from 'react'

interface SettingsProps {
  onClose: () => void
}

export default function Settings({ onClose }: SettingsProps) {
  const [tab, setTab] = useState<'general' | 'appearance' | 'shortcuts' | 'about'>('general')
  const [workDir, setWorkDir] = useState('')
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    window.piDesktop.config.get('workingDirectory').then(r => { if (r.success && r.data) setWorkDir(r.data as string) })
    window.piDesktop.config.get('theme').then(r => { if (r.success && r.data) setTheme(r.data as string) })
  }, [])

  async function saveWorkDir() {
    await window.piDesktop.config.set('workingDirectory', workDir)
  }

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    await window.piDesktop.config.set('theme', next)
  }

  const tabs = [
    { key: 'general', label: 'General' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'shortcuts', label: 'Shortcuts' },
    { key: 'about', label: 'About' },
  ] as const

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: '500px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">Settings</h2>
          <button onClick={onClose} className="modal-x">✕</button>
        </div>

        <div className="flex" style={{ flex: 1, minHeight: 0 }}>
          <div className="tab-side">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? 'active' : ''}`}>{t.label}</button>
            ))}
          </div>

          <div className="modal-body" style={{ flex: 1 }}>
            <div className="s-title">{tab}</div>

            {tab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="fl">Working Directory</label>
                  <div className="flex" style={{ gap: '6px' }}>
                    <input value={workDir} onChange={e => setWorkDir(e.target.value)} className="fi" style={{ flex: 1 }} />
                    <button onClick={saveWorkDir} className="bp">Save</button>
                  </div>
                </div>
                <div>
                  <label className="fl">Providers</label>
                  <p style={{ fontSize: '10px', color: 'var(--text2)' }}>Manage your AI providers from the Provider Manager (⌘P)</p>
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: '11px' }}>Dark Mode</span>
                  <button onClick={toggleTheme} className={`toggle ${theme === 'dark' ? 'on' : ''}`}>
                    <span className="toggle-knob" />
                  </button>
                </div>
                <div>
                  <label className="fl">Font Size</label>
                  <select className="fsel">
                    <option>12px</option>
                    <option selected>13px</option>
                    <option>14px</option>
                    <option>15px</option>
                    <option>16px</option>
                  </select>
                </div>
              </div>
            )}

            {tab === 'shortcuts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  ['⌘⏎ / Ctrl+⏎', 'Send message'],
                  ['⌘K / Ctrl+K', 'Clear chat'],
                  ['⌘N / Ctrl+N', 'New session'],
                  ['⌘⇧F / Ctrl+Shift+F', 'Search sessions'],
                  ['⌘/ / Ctrl+/', 'Show shortcuts'],
                  ['⌘P / Ctrl+P', 'Open Provider Manager'],
                  ['Esc', 'Close modal'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex justify-between items-center" style={{ padding: '2px 0' }}>
                    <span className="sc-key">{key}</span>
                    <span className="sc-desc">{desc}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'about' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
                <div><span style={{ color: 'var(--text2)' }}>Pi Desktop</span></div>
                <div><span style={{ color: 'var(--text2)' }}>Version:</span> 0.1.0</div>
                <div><span style={{ color: 'var(--text2)' }}>Electron:</span> 39</div>
                <div><span style={{ color: 'var(--text2)' }}>React:</span> 19</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
