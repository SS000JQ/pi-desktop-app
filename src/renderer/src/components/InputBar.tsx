import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import ContextChips from './ContextChips'
import DropZone from './DropZone'

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
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.command.includes(commandFilter.toLowerCase())
  )

  const handleSend = () => {
    if (!text.trim() || isStreaming) return

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

  // Paste image from clipboard (screenshot paste support)
  useEffect(() => {
    const inputEl = inputRef.current
    if (!inputEl) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          setAttachments(prev => [...prev, { name: `Screenshot ${prev.length + 1}.png` }])
          break
        }
      }
    }
    inputEl.addEventListener('paste', handlePaste)
    return () => inputEl.removeEventListener('paste', handlePaste)
  }, [])

  // Drag-drop file support
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setIsDragging(true)
    }
    const handleDragLeave = (e: DragEvent) => {
      // Only set false if leaving the entire widget
      const target = e.relatedTarget as Node | null
      if (!target || !document.querySelector('.inpw')?.contains(target)) {
        setIsDragging(false)
      }
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const newFiles = Array.from(files).map(f => ({ name: f.name }))
        setAttachments(prev => [...prev, ...newFiles])
      }
    }
    const el = document.querySelector('.inpw') as HTMLElement | null
    if (el) {
      el.addEventListener('dragover', handleDragOver)
      el.addEventListener('dragleave', handleDragLeave)
      el.addEventListener('drop', handleDrop)
      return () => {
        el.removeEventListener('dragover', handleDragOver)
        el.removeEventListener('dragleave', handleDragLeave)
        el.removeEventListener('drop', handleDrop)
      }
    }
  }, [])

  return (
    <div className="inpw">
      <DropZone visible={isDragging} />
      {attachments.length > 0 && (
        <div className="cc" style={{ marginBottom: '6px' }}>
          <ContextChips attachments={attachments} onRemove={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))} />
        </div>
      )}

      {showCommands && filteredCommands.length > 0 && (
        <div className="cmd-list">
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.command}
              onClick={() => { setText(cmd.command + ' '); setShowCommands(false); inputRef.current?.focus() }}
              className={`cmd-item ${i === selectedCmdIdx ? 'active' : ''}`}
            >
              <span className="cmd-icon">{cmd.icon}</span>
              <span className="cmd-name">{cmd.command}</span>
              <span className="cmd-desc">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="inr">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pi... (attach files / paste images / drag & drop)"
          className="inf"
          disabled={isStreaming}
        />
        <div className="ina">
          <button title="Attach files" className="inb">📎</button>
          <button title="Paste screenshot" className="inb">🖼</button>
          <span className="ikh">⌘⏎</span>
          <button
            onClick={handleSend}
            disabled={isStreaming || !text.trim()}
            className="inb" style={{ background: 'var(--accent)', color: 'white', borderColor: 'transparent' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
