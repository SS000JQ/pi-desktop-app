import { useEffect, useState } from 'react'

interface NewSessionDialogProps {
  isOpen: boolean
  currentDir?: string
  directoryOptions: string[]
  onClose: () => void
  onCreate: (cwd?: string) => void
}

export default function NewSessionDialog({
  isOpen,
  currentDir,
  directoryOptions,
  onClose,
  onCreate,
}: NewSessionDialogProps) {
  const [selectedMode, setSelectedMode] = useState<'current' | 'known' | 'default' | 'custom'>('current')
  const [selectedDir, setSelectedDir] = useState('')
  const [customDir, setCustomDir] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSelectedMode(currentDir ? 'current' : 'default')
    setSelectedDir(currentDir || directoryOptions[0] || '')
    setCustomDir('')
  }, [currentDir, directoryOptions, isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 460 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">New Chat</h2>
          <button onClick={onClose} className="modal-x">Close</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)', lineHeight: 1.6 }}>
            Choose where this Pi session should live.
            {' '}
            If you skip directory selection, Pi Desktop will create it under Pi-Desktop-Session.
          </div>

          {currentDir && (
            <label className="ci" style={{ alignItems: 'flex-start', cursor: 'pointer' }} aria-label="Use current workspace">
              <input
                type="radio"
                name="session-dir"
                checked={selectedMode === 'current'}
                onChange={() => setSelectedMode('current')}
                className="fchk"
              />
              <div>
                <div className="cit">Use current workspace</div>
                <div className="cim">{currentDir}</div>
              </div>
            </label>
          )}

          {directoryOptions.length > 0 && (
            <label className="ci" style={{ alignItems: 'flex-start', cursor: 'pointer' }} aria-label="Choose a known directory">
              <input
                type="radio"
                name="session-dir"
                checked={selectedMode === 'known'}
                onChange={() => setSelectedMode('known')}
                className="fchk"
              />
              <div style={{ flex: 1 }}>
                <div className="cit">Choose a known directory</div>
                <select
                  className="fsel"
                  style={{ marginTop: 8 }}
                  value={selectedDir}
                  onChange={(event) => {
                    setSelectedDir(event.target.value)
                    setSelectedMode('known')
                  }}
                >
                  {directoryOptions.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          )}

          <label className="ci" style={{ alignItems: 'flex-start', cursor: 'pointer' }} aria-label="Enter a custom directory">
            <input
              type="radio"
              name="session-dir"
              checked={selectedMode === 'custom'}
              onChange={() => setSelectedMode('custom')}
              className="fchk"
            />
            <div style={{ flex: 1 }}>
              <div className="cit">Enter a custom directory</div>
              <input
                className="fi"
                style={{ marginTop: 8 }}
                value={customDir}
                placeholder="D:/Work/My Project"
                onChange={(event) => {
                  setCustomDir(event.target.value)
                  setSelectedMode('custom')
                }}
              />
            </div>
          </label>

          <label className="ci" style={{ alignItems: 'flex-start', cursor: 'pointer' }} aria-label="Use Pi Desktop default folder">
            <input
              type="radio"
              name="session-dir"
              checked={selectedMode === 'default'}
              onChange={() => setSelectedMode('default')}
              className="fchk"
            />
            <div>
              <div className="cit">Use Pi Desktop default folder</div>
              <div className="cim">Creates the session inside <code>Pi-Desktop-Session</code>.</div>
            </div>
          </label>
        </div>
        <div className="modal-ftr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
            Sessions stay bound to the directory you pick here.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="bs">Cancel</button>
            <button
              onClick={() => {
                const trimmedCustomDir = customDir.trim()
                const resolvedCwd =
                  trimmedCustomDir
                    ? trimmedCustomDir
                    : selectedMode === 'current'
                    ? currentDir
                    : selectedMode === 'known'
                      ? selectedDir
                      : undefined
                onCreate(resolvedCwd || undefined)
              }}
              className="bp"
              disabled={selectedMode === 'custom' && !customDir.trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
