import { useEffect, useMemo, useState } from 'react'

interface RuntimeToolInfo {
  name: string
  description: string
  active: boolean
  source?: string
}

interface ToolsProps {
  onClose: () => void
  sessionPath?: string | null
}

const TOOL_PRESETS = [
  { id: 'off', label: 'Off', names: [] },
  { id: 'low', label: 'Low', names: ['read', 'bash', 'edit', 'write'] },
  { id: 'high', label: 'High', names: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'] },
]

export default function Tools({ onClose, sessionPath }: ToolsProps) {
  const [tools, setTools] = useState<RuntimeToolInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const activeToolNames = useMemo(() => tools.filter((tool) => tool.active).map((tool) => tool.name), [tools])

  const loadTools = async () => {
    if (!sessionPath) {
      setTools([])
      setNotice('Open or start a Pi session before changing tools.')
      return
    }
    setIsLoading(true)
    setNotice(null)
    const response = await window.piDesktop.piRuntime.getTools(sessionPath)
    if (response.success && Array.isArray(response.data)) {
      setTools(response.data)
    } else {
      setTools([])
      setNotice(response.error || 'Failed to load Pi tools.')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadTools()
  }, [sessionPath])

  const applyPreset = async (toolNames: string[]) => {
    if (!sessionPath) return
    const response = await window.piDesktop.piRuntime.setTools({ sessionPath, toolNames })
    if (!response.success) {
      setNotice(response.error || 'Failed to update Pi tools.')
      return
    }
    setTools((previous) => previous.map((tool) => ({ ...tool, active: toolNames.includes(tool.name) })))
    setNotice('Tool preset applied. It may take effect on the next Pi turn depending on the runtime.')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tools-modal" onClick={(event) => event.stopPropagation()}>
        <div className="tools-head">
          <span>Pi Tools</span>
          <div className="tools-head-actions">
            <button onClick={() => void loadTools()} disabled={isLoading}>{isLoading ? 'Checking...' : 'Re-check'}</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="tools-body">
          <div className="tools-note">
            Tools are read from the active Pi runtime session. Presets update the active tool allowlist by name.
          </div>
          <div className="tools-presets">
            {TOOL_PRESETS.map((preset) => (
              <button key={preset.id} onClick={() => void applyPreset(preset.names)} disabled={!sessionPath}>
                {preset.label}
              </button>
            ))}
          </div>
          {notice && <div className="tools-notice">{notice}</div>}
          <div className="tools-list">
            {tools.length === 0 && !isLoading ? (
              <div className="tools-empty">No runtime tools reported.</div>
            ) : (
              tools.map((tool) => (
                <div key={tool.name} className="tools-row">
                  <span className={`tools-dot ${tool.active ? 'active' : ''}`} />
                  <div>
                    <div className="tools-name">
                      {tool.name}
                      {tool.active ? <span>active</span> : <span>inactive</span>}
                    </div>
                    <div className="tools-desc">{tool.description || 'No description provided'}</div>
                    {tool.source ? <div className="tools-source">{tool.source}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
          {activeToolNames.length > 0 ? (
            <div className="tools-active">Active now: {activeToolNames.join(', ')}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
