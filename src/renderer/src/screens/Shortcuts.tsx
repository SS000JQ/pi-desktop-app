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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[#0F172A] border border-border rounded-lg w-[480px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-dim hover:text-muted text-sm">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {SHORTCUTS.map(group => (
            <div key={group.category}>
              <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{group.category}</h3>
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <div key={item.keys} className="flex justify-between items-center py-0.5">
                    <span className="text-[10px] font-mono text-[#94A3B8] bg-surface px-1.5 py-0.5 rounded">{item.keys}</span>
                    <span className="text-[11px] text-muted">{item.desc}</span>
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
