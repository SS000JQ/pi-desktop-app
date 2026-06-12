import { useEffect, useState } from 'react'
import EnvironmentStatusList from '../components/EnvironmentStatusList'
import { THEME_PRESETS, applyThemePreset, normalizeThemePreset, type ThemePresetId } from '../lib/themes'
import type { EnvironmentCheckResult } from '../types/chat'

interface SettingsProps {
  onClose: () => void
  onDefaultSessionDirectoryChange?: (path: string) => void
  themePreset?: ThemePresetId
  onThemeChange?: (theme: ThemePresetId) => void
}

export default function Settings({ onClose, onDefaultSessionDirectoryChange, themePreset, onThemeChange }: SettingsProps) {
  const [defaultDir, setDefaultDir] = useState('')
  const [theme, setTheme] = useState<ThemePresetId>(themePreset || 'classic')
  const [saveMessage, setSaveMessage] = useState('')
  const [diagnosticsMessage, setDiagnosticsMessage] = useState('')
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentCheckResult | null>(null)
  const [environmentLoading, setEnvironmentLoading] = useState(false)

  useEffect(() => {
    window.piDesktop.config.get('defaultSessionDirectory').then((response) => {
      if (response.success && typeof response.data === 'string') {
        setDefaultDir(response.data)
      }
    })
    window.piDesktop.config.get('theme').then((response) => {
      if (response.success && typeof response.data === 'string') {
        setTheme(applyThemePreset(response.data))
      }
    })
    void loadEnvironmentStatus()
  }, [])

  useEffect(() => {
    if (!themePreset) return
    setTheme(themePreset)
  }, [themePreset])

  async function loadEnvironmentStatus() {
    setEnvironmentLoading(true)
    try {
      const response = await window.piDesktop.desktop.getEnvironmentStatus()
      if (response.success && response.data) {
        setEnvironmentStatus(response.data)
      }
    } finally {
      setEnvironmentLoading(false)
    }
  }

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

  async function selectTheme(value: ThemePresetId) {
    const next = normalizeThemePreset(value)
    setTheme(next)
    applyThemePreset(next)
    await window.piDesktop.config.set('theme', next)
    onThemeChange?.(next)
  }

  async function copyDiagnostics() {
    setDiagnosticsMessage('')
    const response = await window.piDesktop.desktop.getReleaseDiagnostics()
    if (!response.success || typeof response.data !== 'string') {
      setDiagnosticsMessage(response.error || 'Diagnostics could not be prepared.')
      return
    }

    await navigator.clipboard?.writeText(response.data)
    setDiagnosticsMessage('Diagnostics copied.')
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

          <div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>Theme</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                Choose a visual preset. Classic keeps the current Pi Desktop look.
              </div>
            </div>
            <div className="theme-preset-grid" role="radiogroup" aria-label="Theme preset">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === preset.id}
                  className={`theme-preset-card ${theme === preset.id ? 'active' : ''}`}
                  onClick={() => { void selectTheme(preset.id) }}
                >
                  <span className="theme-preset-main">
                    <span className="theme-preset-name">{preset.name}</span>
                    <span className="theme-preset-desc">{preset.description}</span>
                  </span>
                  <span className="theme-swatch-row" aria-hidden="true">
                    {preset.swatches.map((color) => (
                      <span key={color} className="theme-swatch" style={{ background: color }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <EnvironmentStatusList
            result={environmentStatus}
            loading={environmentLoading}
            compact
            onRefresh={loadEnvironmentStatus}
          />

          <div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>Support diagnostics</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
              Copy release details and asset checks for GitHub issues. Secrets are not included.
            </div>
            <div className="flex" style={{ gap: 8, marginTop: 10 }}>
              <button type="button" className="bs" onClick={copyDiagnostics}>Copy diagnostics</button>
              {diagnosticsMessage && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{diagnosticsMessage}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
