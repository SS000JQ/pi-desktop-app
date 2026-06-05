interface ToolsProps {
  onClose: () => void
  sessionCount: number
  providerCount: number
  currentDir: string
  currentModelLabel?: string
  activeSessionTitle?: string | null
}

interface CapabilityItem {
  id: string
  name: string
  description: string
  category: string
  status: 'active' | 'partial'
}

function buildCapabilities({
  sessionCount,
  providerCount,
  currentDir,
  currentModelLabel,
  activeSessionTitle,
}: Omit<ToolsProps, 'onClose'>): CapabilityItem[] {
  return [
    {
      id: 'pi-sessions',
      name: 'Pi native sessions',
      description: activeSessionTitle
        ? `Continuing the real Pi session "${activeSessionTitle}" from disk instead of a desktop-only chat store.`
        : 'Browsing and creating real Pi sessions from disk instead of a desktop-only chat store.',
      category: 'Session',
      status: 'active',
    },
    {
      id: 'provider-routing',
      name: 'Provider routing',
      description:
        providerCount > 0
          ? `${providerCount} configured provider${providerCount === 1 ? '' : 's'} available for Pi runtime selection.`
          : 'Provider management is wired up, but no provider is configured yet.',
      category: 'Model',
      status: providerCount > 0 ? 'active' : 'partial',
    },
    {
      id: 'runtime-binding',
      name: 'Per-session runtime binding',
      description: currentModelLabel
        ? `The active Pi runtime is bound to the selected session, model, and thinking level. Current model: ${currentModelLabel}.`
        : 'Pi runtime binding exists, but no model is selected yet.',
      category: 'Runtime',
      status: currentModelLabel ? 'active' : 'partial',
    },
    {
      id: 'directory-context',
      name: 'Directory-scoped workflow',
      description: `New Pi sessions are created in the selected working directory. Current directory: ${currentDir || 'not set'}.`,
      category: 'Workspace',
      status: currentDir ? 'active' : 'partial',
    },
    {
      id: 'streaming-events',
      name: 'Streaming tool events',
      description: 'Assistant streaming, tool start/finish events, and artifact previews are wired through the desktop shell.',
      category: 'Runtime',
      status: 'active',
    },
    {
      id: 'file-preview',
      name: 'File browser and preview',
      description: 'Local files can be browsed from the desktop shell and previewed alongside the Pi conversation.',
      category: 'File',
      status: 'active',
    },
    {
      id: 'session-count',
      name: 'Session discovery',
      description: `${sessionCount} Pi session${sessionCount === 1 ? '' : 's'} currently visible in the desktop session browser.`,
      category: 'Session',
      status: 'active',
    },
  ]
}

const LIMITATIONS = [
  'Branch tree visualization is not implemented yet, so Pi branch structure is preserved in data but not browsable as a tree.',
  'Desktop-side tool permission management is not implemented yet; tool execution follows the underlying Pi runtime behavior.',
]

export default function Tools({ onClose, sessionCount, providerCount, currentDir, currentModelLabel, activeSessionTitle }: ToolsProps) {
  const capabilities = buildCapabilities({
    sessionCount,
    providerCount,
    currentDir,
    currentModelLabel,
    activeSessionTitle,
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          background: '#1a1919',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4,
          width: 540,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Desktop Capabilities</span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>
            This panel reflects what the current desktop shell actually does today. It is not a tool permission switcher.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <div style={{ padding: '0 14px 6px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.16)' }}>
            Active Capabilities
          </div>
          {capabilities.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', alignItems: 'flex-start' }}>
              <span
                style={{
                  marginTop: 3,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: item.status === 'active' ? 'rgba(48,209,88,0.7)' : 'rgba(255,204,0,0.7)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)' }}>
                  {item.name}
                  <span style={{ marginLeft: 8, fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>{item.category}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, marginTop: 3 }}>
                  {item.description}
                </div>
              </div>
            </div>
          ))}

          <div style={{ padding: '12px 14px 6px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.16)' }}>
            Still Missing
          </div>
          {LIMITATIONS.map((item) => (
            <div key={item} style={{ padding: '6px 14px', fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.55 }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
