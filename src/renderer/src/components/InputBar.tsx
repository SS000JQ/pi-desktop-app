import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import ContextChips from './ContextChips'
import DropZone from './DropZone'
import type { ChatAttachment, SlashCommand } from '../types/chat'

interface InputBarProps {
  onSendMessage: (text: string, metadata?: { displayText?: string; attachments?: ChatAttachment[] }) => void
  isStreaming: boolean
  onCommand?: (command: string) => void
  slashCommands?: SlashCommand[]
  currentWorkspace?: string
  onWorkspaceRefresh?: () => void
  sessionKey?: string | null
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

const DEFAULT_EXPANDED_COMMAND_GROUPS = new Set(['Desktop', 'Pi Runtime'])

function groupForCommand(command: SlashCommand): string {
  if (command.group) return command.group
  switch (command.kind) {
    case 'desktop':
      return 'Desktop'
    case 'pi_runtime':
      return 'Pi Runtime'
    case 'skill':
      return 'Skills'
    case 'prompt':
      return 'Prompts'
    case 'extension':
      return 'Extensions'
    case 'context':
      return 'Context'
    case 'unsupported':
      return 'Unsupported'
    default:
      return command.kind
  }
}

export default function InputBar({
  onSendMessage,
  isStreaming,
  onCommand,
  slashCommands = FALLBACK_SLASH_COMMANDS,
  currentWorkspace = '',
  onWorkspaceRefresh,
  sessionKey = null,
}: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [showCommands, setShowCommands] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [commandNotice, setCommandNotice] = useState<string | null>(null)
  const [expandedCommandGroups, setExpandedCommandGroups] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const addAttachments = (files: ChatAttachment[]) => {
    setAttachments((previous) => {
      const seen = new Set(previous.map((file) => file.path.toLowerCase()))
      const next = [...previous]
      for (const file of files) {
        const key = file.path.toLowerCase()
        if (!file.path || seen.has(key)) continue
        seen.add(key)
        next.push(file)
      }
      return next
    })
  }

  const formatMessageWithAttachments = (body: string): string => {
    if (attachments.length === 0) return body
    return [
      'Attached files:',
      ...attachments.map((file) => `- ${file.path}`),
      '',
      'User request:',
      body,
    ].join('\n')
  }

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

    onSendMessage(formatMessageWithAttachments(text), {
      displayText: text,
      attachments,
    })
    setText('')
    setAttachments([])
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
    const selected = visibleCommands[selectedCmdIdx]
    if (selected) {
      chooseCommand(selected)
    }
  }

  const groupedCommands = useMemo(() => filteredCommands.reduce<Array<{ group: string; commands: SlashCommand[] }>>((groups, command) => {
    const group = groupForCommand(command)
    const existing = groups.find((entry) => entry.group === group)
    if (existing) {
      existing.commands.push(command)
    } else {
      groups.push({ group, commands: [command] })
    }
    return groups
  }, []), [filteredCommands])

  const isGroupExpanded = (group: string) => {
    if (commandFilter) return true
    if (Object.prototype.hasOwnProperty.call(expandedCommandGroups, group)) {
      return expandedCommandGroups[group]
    }
    return DEFAULT_EXPANDED_COMMAND_GROUPS.has(group)
  }

  const visibleCommands = groupedCommands.flatMap((group) => (isGroupExpanded(group.group) ? group.commands : []))

  const commandIndex = (target: SlashCommand) => visibleCommands.findIndex((command) => command.command === target.command)

  const toggleCommandGroup = (group: string) => {
    setExpandedCommandGroups((previous) => ({
      ...previous,
      [group]: !isGroupExpanded(group),
    }))
    setSelectedCmdIdx(0)
  }

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
    if (showCommands && visibleCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedCmdIdx((previous) => Math.min(previous + 1, visibleCommands.length - 1))
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
    setSelectedCmdIdx(0)
  }, [commandFilter, slashCommands])

  useEffect(() => {
    setAttachments([])
    setCommandNotice(null)
    setIsDragging(false)
  }, [sessionKey])

  useEffect(() => {
    const inputEl = inputRef.current
    if (!inputEl) return

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          setCommandNotice('Image paste will be available after file attachment support saves pasted images.')
          break
        }
      }
    }

    inputEl.addEventListener('paste', handlePaste)
    return () => inputEl.removeEventListener('paste', handlePaste)
  }, [])

  const readWorkspaceDrop = (dataTransfer: DataTransfer): ChatAttachment[] => {
    if (typeof dataTransfer.getData !== 'function') return []
    const raw = dataTransfer.getData('application/x-pi-desktop-file')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as { path?: string; name?: string }
      if (!parsed.path) return []
      return [{
        id: `workspace:${parsed.path}`,
        name: parsed.name || parsed.path.split(/[\\/]/).pop() || parsed.path,
        path: parsed.path,
        source: 'workspace',
      }]
    } catch {
      return []
    }
  }

  const isUsableNativePath = (path: string, fileName: string): boolean => {
    if (!path || path === fileName) return false
    return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
  }

  const readNativeDrop = (fileList: FileList | File[] | null | undefined): { attachments: ChatAttachment[]; rejected: number } => {
    if (!fileList) return { attachments: [], rejected: 0 }
    const attachments: ChatAttachment[] = []
    let rejected = 0
    Array.from(fileList).forEach((file) => {
      const path = window.piDesktop.files.getPathForFile?.(file) || (file as File & { path?: string }).path || ''
      if (!isUsableNativePath(path, file.name)) {
        rejected += 1
        return
      }
      attachments.push({
        id: `drop:${path}`,
        name: file.name || path.split(/[\\/]/).pop() || path,
        path,
        type: file.type || undefined,
        size: file.size,
        source: 'drop' as const,
      })
    })
    return { attachments, rejected }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  const importDroppedFiles = async (files: ChatAttachment[]) => {
    if (files.length === 0) return
    const uniqueFiles = files.filter((file, index, allFiles) =>
      allFiles.findIndex((entry) => entry.path.toLowerCase() === file.path.toLowerCase()) === index,
    )
    if (!currentWorkspace) {
      setCommandNotice('Choose a workspace before dropping external files.')
      return
    }
    const response = await window.piDesktop.files.importAttachments({
      workspaceDir: currentWorkspace,
      paths: uniqueFiles.map((file) => file.path),
    })
    if (!response.success) {
      setCommandNotice(response.error || 'Failed to import dropped files.')
      return
    }
    const imported = Array.isArray(response.data) ? response.data : []
    addAttachments(imported.map((file) => ({
      id: `attachment:${file.path}`,
      name: file.name,
      path: file.path,
      size: file.size,
      source: 'drop',
    })))
    setCommandNotice(null)
    onWorkspaceRefresh?.()
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const workspaceFiles = readWorkspaceDrop(event.dataTransfer)
    const nativeDrop = readNativeDrop(event.dataTransfer.files)
    addAttachments(workspaceFiles)
    if (nativeDrop.rejected > 0) {
      setCommandNotice('This drop source did not provide a real file path. Please use Files or drag from Explorer.')
    }
    void importDroppedFiles(nativeDrop.attachments)
  }

  const handlePickFiles = async () => {
    const response = await window.piDesktop.files.pickFiles()
    if (!response.success) {
      setCommandNotice(response.error || 'Failed to choose files.')
      return
    }
    const selected = Array.isArray(response.data) ? response.data : []
    addAttachments(selected.map((file) => ({
      id: `picker:${file.path}`,
      name: file.name,
      path: file.path,
      size: file.size,
      source: 'picker',
    })))
  }

  return (
    <div
      className="inpw"
      data-testid="input-drop-target"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
          <div className="cmd-list-scroll">
            {groupedCommands.map((group) => {
              const expanded = isGroupExpanded(group.group)
              return (
                <div key={group.group} className="cmd-section">
                  <button
                    type="button"
                    className="cmd-group"
                    onClick={() => toggleCommandGroup(group.group)}
                    aria-expanded={expanded}
                    aria-label={`${group.group} commands`}
                  >
                    <span>{expanded ? 'v' : '>'} {group.group}</span>
                    <span className="cmd-group-count">{group.commands.length}</span>
                  </button>
                  {expanded ? group.commands.map(renderCommand) : null}
                </div>
              )
            })}
          </div>
          {commandFilter && visibleCommands.length === 0 ? (
            <div className="cmd-empty">No matching expanded commands.</div>
          ) : null}
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
          <button type="button" aria-label="Attach files" title="Attach files" className="inb" onClick={() => void handlePickFiles()}>Files</button>
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
