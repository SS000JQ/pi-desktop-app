import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import ContextChips from './ContextChips'

interface InputBarProps {
  onSendMessage: (text: string) => void
  isStreaming: boolean
}

const SLASH_COMMANDS = [
  { command: '/new', description: 'Start a new conversation', icon: '🔄' },
  { command: '/clear', description: 'Clear current chat', icon: '🧹' },
  { command: '/compact', description: 'Compress context (summarize)', icon: '📦' },
  { command: '/model', description: 'Switch model', icon: '🤖' },
  { command: '/tools', description: 'Manage tools', icon: '🔧' },
  { command: '/help', description: 'Show help', icon: '❓' },
  { command: '/web', description: 'Enable web search', icon: '🌐' },
  { command: '/code', description: 'Enable code execution', icon: '💻' },
]

export default function InputBar({ onSendMessage, isStreaming }: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<{ name: string }[]>([])
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.command.includes(commandFilter.toLowerCase())
  )

  const handleSend = () => {
    if (!text.trim() || isStreaming) return

    // Handle slash commands
    if (text.startsWith('/')) {
      const match = SLASH_COMMANDS.find(c => c.command === text.trim().split(' ')[0])
      if (match) {
        handleSlashCommand(match.command)
        return
      }
    }

    onSendMessage(text)
    setText('')
  }

  const handleSlashCommand = (_command: string) => {
    // For most commands, just pass the text through
    onSendMessage(text)
    setText('')
    setShowCommands(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCmdIdx(prev => Math.min(prev + 1, filteredCommands.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCmdIdx(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && showCommands)) {
        e.preventDefault()
        const selected = filteredCommands[selectedCmdIdx]
        if (selected) {
          setText(selected.command + ' ')
          setShowCommands(false)
        }
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Show command popover when '/' is typed
  useEffect(() => {
    if (text === '/') {
      setShowCommands(true)
      setCommandFilter('')
      setSelectedCmdIdx(0)
    } else if (text.startsWith('/')) {
      setShowCommands(true)
      setCommandFilter(text.slice(1))
      setSelectedCmdIdx(0)
    } else {
      setShowCommands(false)
    }
  }, [text])

  return (
    <div className="border-t border-[#1E293B] bg-[#0F172A] px-3 py-2 flex-shrink-0 relative">
      {attachments.length > 0 && (
        <ContextChips attachments={attachments} onRemove={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))} />
      )}

      {/* Slash command popover */}
      {showCommands && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.command}
              onClick={() => { setText(cmd.command + ' '); setShowCommands(false); inputRef.current?.focus() }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${i === selectedCmdIdx ? 'bg-accent/10 text-[#F1F5F9]' : 'text-muted hover:bg-[#1E293B]'}`}
            >
              <span className="text-sm">{cmd.icon}</span>
              <span className="font-medium">{cmd.command}</span>
              <span className="text-dim ml-1">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-2 py-1.5 transition-colors focus-within:border-accent">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pi... ( / commands · drop files · paste images )"
          className="flex-1 bg-transparent border-none outline-none text-sm text-[#F1F5F9] placeholder-muted"
          disabled={isStreaming}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="Attach files" className="text-dim hover:text-muted text-sm px-0.5 rounded transition-colors hover:bg-[#334155]">📎</button>
          <button title="Paste screenshot" className="text-dim hover:text-muted text-sm px-0.5 rounded transition-colors hover:bg-[#334155]">🖼</button>
          <span className="text-[#334155] text-[9px] font-mono">⌘⏎</span>
          <button
            onClick={handleSend}
            disabled={isStreaming || !text.trim()}
            className="bg-accent text-white border-none rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
