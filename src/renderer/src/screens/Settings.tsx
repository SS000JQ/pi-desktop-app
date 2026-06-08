import { useEffect, useState } from 'react'

interface SettingsProps {
  onClose: () => void
  onDefaultSessionDirectoryChange?: (path: string) => void
}

export default function Settings({ onClose, onDefaultSessionDirectoryChange }: SettingsProps) {
  const [defaultDir, setDefaultDir] = useState('')
  const [theme, setTheme] = useState('dark')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    window.piDesktop.config.get('defaultSessionDirectory').then((response) => {
      if (response.success && typeof response.data === 'string') {
        setDefaultDir(response.data)
      }
    })
    window.piDesktop.config.get('theme').then((response) => {
      if (response.success && typeof response.data === 'string') {
        setTheme(response.data)
      }
    })
  }, [])

  async function saveDefaultDir() {
    const trimmed = defaultDir.trim()
    await window.piDesktop.config.set('defaultSessionDirectory', trimmed || null)
    const resolved = await window.piDesktop.config.get('defaultSessionDirectory')
    const nextValue = resolved.success && typeof resolved.data === 'string' ? resolved.data : trimmed
    setDefaultDir(nextValue)
    onDefaultSessionDirectoryChange?.(nextValue)
    setSaveMessage('Default file address saved.')
  }

  async function browseDefaultDir() {
    const response = await window.piDesktop.files.pickDirectory(defaultDir || undefined)
    if (!response.success || typeof response.data !== 'string' || !response.data) return
    setDefaultDir(response.data)
    setSaveMessage('')
  }

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    await window.piDesktop.config.set('theme', next)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: '520px', maxHeight: '80vh' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">Settings</h2>
          <button onClick={onClose} className="modal-x">Close</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="fl">Default file address</label>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>
              Used by New Chat when you choose "Use Pi Desktop default folder".
            </div>
            <div className="flex" style={{ gap: 8 }}>
              <input
                aria-label="Default file address"
                value={defaultDir}
                onChange={(event) => {
                  setDefaultDir(event.target.value)
                  setSaveMessage('')
                }}
                className="fi"
                style={{ flex: 1 }}
                placeholder="C:/Users/you/Pi-Desktop-Session"
              />
              <button onClick={browseDefaultDir} className="bs" type="button">Browse</button>
              <button onClick={saveDefaultDir} className="bp" type="button">Save</button>
            </div>
            {saveMessage && (
              <div style={{ fontSize: 11, color: 'rgba(120, 220, 160, 0.82)', marginTop: 8 }}>
                {saveMessage}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>Theme</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                Toggle between dark and light mode.
              </div>
            </div>
            <button onClick={toggleTheme} className={`toggle ${theme === 'dark' ? 'on' : ''}`} type="button" aria-label="Toggle dark mode">
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
