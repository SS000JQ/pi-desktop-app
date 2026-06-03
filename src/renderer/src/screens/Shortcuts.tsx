interface ShortcutsProps {
  onClose: () => void
}

const SHORTCUTS = [
  { category: 'Chat', items: [
    { keys: '⌘⏎ / Ctrl+⏎', desc: 'Send message' },
    { keys: 'Shift+⏎', desc: 'New line' },
    { keys: '⌘K / Ctrl+K', desc: 'Clear chat' },
    { keys: '⌘Z', desc: 'Undo last send' },
  ]},
  { category: 'Navigation', items: [
    { keys: '⌘N / Ctrl+N', desc: 'New session' },
    { keys: '⌘⇧F / Ctrl+Shift+F', desc: 'Search sessions' },
    { keys: '⌘⇧[ / Ctrl+Tab', desc: 'Previous session' },
    { keys: '⌘⇧] / Ctrl+Shift+Tab', desc: 'Next session' },
  ]},
  { category: 'Panels', items: [
    { keys: '⌘B / Ctrl+B', desc: 'Toggle left panel' },
    { keys: '⌘J / Ctrl+J', desc: 'Toggle right panel' },
    { keys: '⌘P / Ctrl+P', desc: 'Open Provider Manager' },
    { keys: '⌘, / Ctrl+,', desc: 'Open Settings' },
  ]},
  { category: 'Global', items: [
    { keys: '⌘/ / Ctrl+/', desc: 'Show shortcuts' },
    { keys: '⌘W / Ctrl+W', desc: 'Close panel / modal' },
    { keys: 'Esc', desc: 'Close modal / cancel' },
    { keys: 'Alt+Shift+Space', desc: 'Toggle Pi Desktop window' },
  ]},
]

export default function Shortcuts({ onClose }: ShortcutsProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: '460px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="modal-x">✕</button>
        </div>
        <div className="modal-body">
          {SHORTCUTS.map(group => (
            <div key={group.category} style={{ marginBottom: '14px' }}>
              <div className="s-title" style={{ marginBottom: '6px' }}>{group.category}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {group.items.map(item => (
                  <div key={item.keys} className="flex justify-between items-center" style={{ padding: '2px 0' }}>
                    <span className="sc-key">{item.keys}</span>
                    <span className="sc-desc">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
