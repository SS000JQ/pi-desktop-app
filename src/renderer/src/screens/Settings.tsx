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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[#0F172A] border border-border rounded-lg w-[520px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button onClick={onClose} className="text-dim hover:text-muted text-sm">✕</button>
        </div>

        <div className="flex gap-0 flex-1 min-h-0">
          {/* Tabs */}
          <div className="w-28 flex-shrink-0 border-r border-[#1E293B] p-2 space-y-0.5">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`w-full text-left px-2 py-1.5 rounded text-xs ${tab === t.key ? 'bg-surface text-[#F1F5F9]' : 'text-muted hover:text-[#F1F5F9]'}`}>{t.label}</button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto text-sm">
            {tab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">General</h3>
                <div>
                  <label className="text-xs text-muted block mb-1">Working Directory</label>
                  <div className="flex gap-2">
                    <input value={workDir} onChange={e => setWorkDir(e.target.value)} className="flex-1 bg-[#0F172A] border border-border rounded px-2 py-1.5 text-xs text-[#F1F5F9] outline-none focus:border-accent" />
                    <button onClick={saveWorkDir} className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover">Save</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Providers</label>
                  <p className="text-[10px] text-dim">Manage your AI providers from the Provider Manager (⌘P)</p>
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Appearance</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Dark Mode</span>
                  <button onClick={toggleTheme} className={`w-10 h-5 rounded-full transition-colors ${theme === 'dark' ? 'bg-accent' : 'bg-[#334155]'} relative`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Font Size</label>
                  <select className="w-full bg-[#0F172A] border border-border rounded px-2 py-1.5 text-xs text-[#F1F5F9] outline-none">
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
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Keyboard Shortcuts</h3>
                {[
                  ['⌘⏎ / Ctrl+⏎', 'Send message'],
                  ['⌘K / Ctrl+K', 'Clear chat'],
                  ['⌘N / Ctrl+N', 'New session'],
                  ['⌘⇧F / Ctrl+Shift+F', 'Search sessions'],
                  ['⌘/ / Ctrl+/', 'Show shortcuts'],
                  ['⌘P / Ctrl+P', 'Open Provider Manager'],
                  ['Esc', 'Close modal'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex justify-between items-center py-1">
                    <span className="text-[10px] font-mono text-[#94A3B8] bg-surface px-1.5 py-0.5 rounded">{key}</span>
                    <span className="text-[11px] text-muted">{desc}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'about' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">About</h3>
                <div><span className="text-muted">Pi Desktop</span></div>
                <div><span className="text-muted">Version:</span> 0.1.0</div>
                <div><span className="text-muted">Electron:</span> 39</div>
                <div><span className="text-muted">React:</span> 19</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
