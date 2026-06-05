import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import ContextChips from './ContextChips'
import DropZone from './DropZone'

interface InputBarProps {
  onSendMessage: (text: string) => void
  isStreaming: boolean
  onCommand?: (command: string) => void
}

const SLASH_COMMANDS = [
  { command: '/new', description: 'Create a new Pi session in the current directory', icon: 'new' },
]

export default function InputBar({ onSendMessage, isStreaming, onCommand }: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<{ name: string }[]>([])
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCommands = SLASH_COMMANDS.filter((command) => command.command.includes(commandFilter.toLowerCase()))

  const handleSlashCommand = (command: string) => {
    onCommand?.(command)
    setText('')
    setShowCommands(false)
  }

  const handleSend = () => {
    if (!text.trim() || isStreaming) return

    if (text.startsWith('/')) {
      const match = SLASH_COMMANDS.find((command) => command.command === text.trim().split(' ')[0])
      if (match) {
        handleSlashCommand(match.command)
        return
      }
    }

    onSendMessage(text)
    setText('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedCmdIdx((previous) => Math.min(previous + 1, filteredCommands.length - 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedCmdIdx((previous) => Math.max(previous - 1, 0))
        return
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && showCommands)) {
        event.preventDefault()
        const selected = filteredCommands[selectedCmdIdx]
        if (selected) {
          setText(`${selected.command} `)
          setShowCommands(false)
        }
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
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

  useEffect(() => {
    const inputEl = inputRef.current
    if (!inputEl) return

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          setAttachments((previous) => [...previous, { name: `Screenshot ${previous.length + 1}.png` }])
          break
        }
      }
    }

    inputEl.addEventListener('paste', handlePaste)
    return () => inputEl.removeEventListener('paste', handlePaste)
  }, [])

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setIsDragging(true)
    }
    const handleDragLeave = (event: DragEvent) => {
      const target = event.relatedTarget as Node | null
      if (!target || !document.querySelector('.inpw')?.contains(target)) {
        setIsDragging(false)
      }
    }
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      setIsDragging(false)
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        const newFiles = Array.from(files).map((file) => ({ name: file.name }))
        setAttachments((previous) => [...previous, ...newFiles])
      }
    }

    const el = document.querySelector('.inpw') as HTMLElement | null
    if (!el) return

    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('drop', handleDrop)
    return () => {
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('dragleave', handleDragLeave)
      el.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <div className="inpw">
      <DropZone visible={isDragging} />
      {attachments.length > 0 && (
        <div className="cc" style={{ marginBottom: '6px' }}>
          <ContextChips
            attachments={attachments}
            onRemove={(index) => setAttachments((previous) => previous.filter((_, current) => current !== index))}
          />
        </div>
      )}

      {showCommands && filteredCommands.length > 0 && (
        <div className="cmd-list">
          {filteredCommands.map((command, index) => (
            <button
              key={command.command}
              onClick={() => {
                setText(`${command.command} `)
                setShowCommands(false)
                inputRef.current?.focus()
              }}
              className={`cmd-item ${index === selectedCmdIdx ? 'active' : ''}`}
            >
              <span className="cmd-icon">{command.icon}</span>
              <span className="cmd-name">{command.command}</span>
              <span className="cmd-desc">{command.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="inr">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pi... (attach files / paste images / drag and drop)"
          className="inf"
          disabled={isStreaming}
        />
        <div className="ina">
          <button title="Attach files" className="inb">Files</button>
          <button title="Paste screenshot" className="inb">Paste</button>
          <span className="ikh">Enter</span>
          <button
            onClick={handleSend}
            disabled={isStreaming || !text.trim()}
            className="inb"
            style={{ background: 'var(--accent)', color: 'white', borderColor: 'transparent' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
