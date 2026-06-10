import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import ContextChips from './ContextChips'
import DropZone from './DropZone'
import type { SlashCommand } from '../types/chat'

interface InputBarProps {
  onSendMessage: (text: string) => void
  isStreaming: boolean
  onCommand?: (command: string) => void
  slashCommands?: SlashCommand[]
}

const FALLBACK_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'desktop:new',
    command: '/new',
    label: 'New session',
    description: 'Create a new Pi session in the current directory',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:settings',
    command: '/settings',
    label: 'Settings',
    description: 'Open Pi Desktop settings',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:model',
    command: '/model',
    label: 'Model',
    description: 'Open model selection',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:skills',
    command: '/skills',
    label: 'Skills',
    description: 'Open discovered Pi resources',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:workspace',
    command: '/workspace',
    label: 'Workspace',
    description: 'Choose or inspect the current workspace',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:tools',
    command: '/tools',
    label: 'Tools',
    description: 'Open Pi runtime tool controls',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:help',
    command: '/help',
    label: 'Help',
    description: 'Show common Pi Desktop commands',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'runtime:compact',
    command: '/compact',
    label: 'Compact',
    description: 'Compact older context, optionally with custom instructions',
    kind: 'pi_runtime',
    source: 'Pi',
    execution: 'runtime',
    group: 'Pi Runtime',
    requiresIdle: true,
  },
  {
    id: 'runtime:reload',
    command: '/reload',
    label: 'Reload',
    description: 'Reload keybindings, extensions, skills, prompts, and context files',
    kind: 'pi_runtime',
    source: 'Pi',
    execution: 'runtime',
    group: 'Pi Runtime',
    requiresIdle: true,
  },
  {
    id: 'runtime:session',
    command: '/session',
    label: 'Session',
    description: 'Show the current session file and ID',
    kind: 'pi_runtime',
    source: 'Pi',
    execution: 'runtime',
    group: 'Pi Runtime',
  },
  {
    id: 'unsupported:export',
    command: '/export',
    label: 'Export',
    description: 'Export session',
    kind: 'unsupported',
    source: 'Pi',
    execution: 'disabled',
    group: 'Unsupported',
    disabledReason: 'Not implemented in Pi Desktop yet',
  },
  {
    id: 'unsupported:clone',
    command: '/clone',
    label: 'Clone',
    description: 'Duplicate the current active branch into a new session file',
    kind: 'unsupported',
    source: 'Pi',
    execution: 'disabled',
    group: 'Unsupported',
    disabledReason: 'Not implemented in Pi Desktop yet',
  },
  {
    id: 'unsupported:trust',
    command: '/trust',
    label: 'Trust',
    description: 'Save a project trust decision for future sessions',
    kind: 'unsupported',
    source: 'Pi',
    execution: 'disabled',
    group: 'Unsupported',
    disabledReason: 'Not implemented in Pi Desktop yet',
  },
]

function commandIcon(command: SlashCommand): string {
  switch (command.kind) {
    case 'desktop':
      return 'app'
    case 'skill':
      return 'skill'
    case 'prompt':
      return 'prompt'
    case 'extension':
      return 'ext'
    case 'context':
      return '@'
    case 'unsupported':
      return 'off'
    default:
      return 'pi'
  }
}

function executionFor(command: SlashCommand): 'desktop' | 'runtime' | 'prompt' | 'disabled' {
  if (command.execution) return command.execution
  if (command.kind === 'desktop') return 'desktop'
  if (command.kind === 'pi_runtime') return 'runtime'
  if (command.kind === 'unsupported') return 'disabled'
  return 'prompt'
}

export default function InputBar({ onSendMessage, isStreaming, onCommand, slashCommands = FALLBACK_SLASH_COMMANDS }: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<{ name: string }[]>([])
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [commandNotice, setCommandNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveSlashCommands = slashCommands.length > 0 ? slashCommands : FALLBACK_SLASH_COMMANDS
  const filteredCommands = effectiveSlashCommands.filter((command) => command.command.toLowerCase().includes(commandFilter.toLowerCase()))

  const handleSlashCommand = (command: string) => {
    onCommand?.(command)
    setText('')
    setShowCommands(false)
    setCommandNotice(null)
  }

  const handleSend = () => {
    if (!text.trim() || isStreaming) return

    if (text.startsWith('/')) {
      const fullText = text.trim()
      const match = effectiveSlashCommands.find((command) => command.command === fullText.split(' ')[0])
      if (match) {
        const execution = executionFor(match)
        if (execution === 'disabled') {
          setCommandNotice(match.disabledReason || 'This command is not available in Pi Desktop yet.')
          return
        }
        if (execution === 'desktop' || execution === 'runtime') {
          handleSlashCommand(fullText)
          return
        }
        setCommandNotice(null)
      } else {
        setCommandNotice(null)
      }
    } else {
      setCommandNotice(null)
    }

    onSendMessage(text)
    setText('')
  }

  const chooseCommand = (command: SlashCommand) => {
    if (executionFor(command) === 'disabled') {
      setText(command.command)
      setCommandNotice(command.disabledReason || 'This command is not available in Pi Desktop yet.')
      setShowCommands(false)
      inputRef.current?.focus()
      return
    }
    setText(`${command.command} `)
    setCommandNotice(null)
    setShowCommands(false)
    inputRef.current?.focus()
  }

  const applySelectedCommand = () => {
    const selected = filteredCommands[selectedCmdIdx]
    if (selected) {
      chooseCommand(selected)
    }
  }

  const groupedCommands = filteredCommands.reduce<Array<{ group: string; commands: SlashCommand[] }>>((groups, command) => {
    const group = command.group || command.kind
    const existing = groups.find((entry) => entry.group === group)
    if (existing) {
      existing.commands.push(command)
    } else {
      groups.push({ group, commands: [command] })
    }
    return groups
  }, [])

  const commandIndex = (target: SlashCommand) => filteredCommands.findIndex((command) => command.command === target.command)

  const renderCommand = (command: SlashCommand) => {
    const index = commandIndex(command)
    const disabled = executionFor(command) === 'disabled'
    return (
      <button
        key={command.command}
        onClick={() => chooseCommand(command)}
        className={`cmd-item ${index === selectedCmdIdx ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      >
        <span className="cmd-icon">{commandIcon(command)}</span>
        <span className="cmd-name">{command.command}</span>
        <span className="cmd-desc">
          {command.argumentHint ? <span className="cmd-hint">{command.argumentHint}</span> : null}
          {command.description}
          {disabled && command.disabledReason ? <span className="cmd-disabled-reason">{command.disabledReason}</span> : null}
        </span>
      </button>
    )
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
        applySelectedCommand()
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
      setCommandNotice(null)
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
          {groupedCommands.map((group) => (
            <div key={group.group}>
              <div className="cmd-group">{group.group}</div>
              {group.commands.map(renderCommand)}
            </div>
          ))}
        </div>
      )}
      {commandNotice && (
        <div className="cmd-notice">{commandNotice}</div>
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
