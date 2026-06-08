import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar'
import LeftPanel from './components/LeftPanel'
import ChatView from './components/ChatView'
import PreviewPanel from './components/PreviewPanel'
import NewSessionDialog from './components/NewSessionDialog'
import StatusBar from './components/StatusBar'
import Welcome from './screens/Welcome'
import Settings from './screens/Settings'
import Profile from './screens/Profile'
import ProviderManager from './screens/ProviderManager'
import Shortcuts from './screens/Shortcuts'
import Skills from './screens/Skills'
import type {
  ArtifactEntity,
  ConnectorSummaryEntry,
  FilePreviewData,
  Message,
  ModelOption,
  ProviderSummary,
  ResultItem,
  RuntimeStatus,
  Session,
  SkillSummaryEntry,
  WorkspaceFileEntry,
} from './types/chat'
import { useChatIPC } from './hooks/useChatIPC'
import type { PreviewFile } from './components/PreviewPanel'

interface SessionListItem {
  id: string
  path: string
  cwd: string
  title: string
  model: string | null
  tokenCount: number
  messageCount: number
  source: 'pi'
  createdAt: string
  updatedAt: string
}

interface StoredMessage {
  role: string
  content?: string | Array<{
    type: string
    text?: string
    name?: string
    id?: string
    arguments?: unknown
    thinking?: string
    source?: { media_type?: string; type?: string }
  }>
  timestamp?: string | number
  toolCallId?: string
  toolName?: string
  summary?: string
  customType?: string
  display?: boolean
  tokensBefore?: number
  command?: string
  output?: string
  exitCode?: number
  cancelled?: boolean
  truncated?: boolean
  fullOutputPath?: string
}

interface SessionDetail {
  sessionId: string
  sessionPath: string
  cwd: string
  title: string
  messages: unknown[]
  model: string | null
  thinkingLevel: string
  tokenCount: number
}

interface SyncSessionOptions {
  activate?: boolean
  updateWorkspace?: boolean
}

interface ContextResourceItem {
  id: string
  label: string
  path?: string
  meta?: string
}

interface WorkspaceViewModel {
  files: WorkspaceFileEntry[]
  directories: WorkspaceFileEntry[]
}

const DEFAULT_CONNECTORS: ConnectorSummaryEntry[] = [
  {
    id: 'web-search',
    label: 'Web search',
    value: 'Available in the current desktop runtime',
    source: 'Desktop runtime',
    status: 'active',
  },
]

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const index = normalized.lastIndexOf('/')
  return index > 0 ? normalized.slice(0, index) : ''
}

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path
}

function isPathWithinRoot(path: string, root: string): boolean {
  const normalizedPath = normalizePath(path)
  const normalizedRoot = normalizePath(root)
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
}

function buildModelOptions(providers: ProviderSummary[]): ModelOption[] {
  return providers
    .filter((provider) => provider.hasAuth)
    .flatMap((provider) =>
      provider.models.map((model) => ({
        id: model.runtimeKey,
        name: model.name,
        provider: provider.displayName,
        label: `${provider.displayName} / ${model.name}`,
        providerId: provider.providerId,
      })),
    )
}

function getInitialModel(providers: ProviderSummary[]): string {
  const availableProviders = providers.filter((provider) => provider.hasAuth && provider.models.length > 0)
  const defaultProvider = availableProviders.find((provider) => provider.isDefault) || availableProviders[0]
  const defaultModel = defaultProvider?.models.find((model) => model.isDefault) || defaultProvider?.models[0]
  return defaultModel?.runtimeKey || ''
}

function extractContentText(content: StoredMessage['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (part.type === 'text') return part.text || ''
      if (part.type === 'image') return `[image: ${part.source?.media_type || part.source?.type || 'image'}]`
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function splitThinkingText(content: string): Message['parts'] | undefined {
  const trimmed = content.trim()
  if (!trimmed) return undefined

  const tagPattern = /<thinking>([\s\S]*?)<\/thinking>/gi
  const parts: NonNullable<Message['parts']> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index).trim()
    if (before) {
      parts.push({ type: 'text', text: before })
    }
    const thinking = (match[1] || '').trim()
    if (thinking) {
      parts.push({ type: 'thinking', title: 'Thinking', text: thinking, collapsed: true })
    }
    lastIndex = match.index + match[0].length
  }

  const after = content.slice(lastIndex).trim()
  if (after) {
    parts.push({ type: 'text', text: after })
  }

  if (parts.some((part) => part.type === 'thinking')) {
    return parts
  }

  const labeledThinking = trimmed.match(/^(?:thinking|reasoning|思考)\s*[:：]\s*([\s\S]*?)(?:\n{2,}|(?:\n(?:answer|final|最终|回答)\s*[:：]\s*))([\s\S]*)$/i)
  if (!labeledThinking) return undefined

  const thinking = (labeledThinking[1] || '').trim()
  const answer = (labeledThinking[2] || '').trim()
  if (!thinking || !answer) return undefined

  return [
    { type: 'thinking', title: 'Thinking', text: thinking, collapsed: true },
    { type: 'text', text: answer },
  ]
}

function buildMessageParts(content: StoredMessage['content']): Message['parts'] {
  if (typeof content === 'string') {
    return splitThinkingText(content) || (content ? [{ type: 'text', text: content }] : undefined)
  }
  if (!Array.isArray(content)) return undefined

  const parts = content
    .map((part): NonNullable<Message['parts']>[number] | null => {
      if (part.type === 'text' && part.text) {
        return { type: 'text', text: part.text }
      }
      if (part.type === 'thinking') {
        return {
          type: 'thinking',
          title: 'Thinking',
          text: part.thinking || part.text || '',
          collapsed: true,
        }
      }
      if (part.type === 'image') {
        return {
          type: 'customSummary',
          title: 'Image',
          text: `[image: ${part.source?.media_type || part.source?.type || 'image'}]`,
        }
      }
      return null
    })
    .filter((part): part is NonNullable<Message['parts']>[number] => Boolean(part))

  return parts.length > 0 ? parts : undefined
}

function visibleContentFromParts(parts: Message['parts'], fallback: string): string {
  if (!parts?.length) return fallback
  const visible = parts
    .filter((part) => part.type !== 'thinking')
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim()
  return visible || fallback
}

function extractToolCalls(content: StoredMessage['content']): Message['toolCalls'] {
  if (!Array.isArray(content)) return []

  return content
    .filter((part) => part.type === 'toolCall')
    .map((part, index) => ({
      id: part.id || `tool-${index}`,
      name: part.name || 'tool',
      args: JSON.stringify(part.arguments || {}),
      status: 'done' as const,
    }))
}

function toUiMessage(sessionId: string, message: StoredMessage, index: number): Message | null {
  const timestamp =
    typeof message.timestamp === 'number'
      ? message.timestamp
      : message.timestamp
        ? new Date(message.timestamp).getTime()
        : Date.now()
  const rawContent = Array.isArray(message.content)
    ? message.content.map((part) => ({ ...part }))
    : undefined

  if (message.role === 'user' || message.role === 'assistant') {
    const parts = buildMessageParts(message.content)
    const contentText = extractContentText(message.content)
    return {
      id: `${sessionId}-msg-${index}`,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.role === 'assistant' ? visibleContentFromParts(parts, contentText) : contentText,
      timestamp,
      parts,
      toolCalls: message.role === 'assistant' ? extractToolCalls(message.content) : undefined,
      rawContent,
      kind: 'standard',
    }
  }

  if (message.role === 'toolResult') {
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `Tool result (${message.toolName || message.toolCallId || 'tool'})\n${extractContentText(message.content)}`.trim(),
      timestamp,
      parts: [{
        type: 'toolResult',
        title: `Tool result (${message.toolName || message.toolCallId || 'tool'})`,
        text: extractContentText(message.content),
        collapsed: true,
      }],
      rawContent,
      kind: 'toolResult',
    }
  }

  if (message.role === 'custom') {
    if (message.display === false) return null
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `[${message.customType || 'custom'}]\n${extractContentText(message.content)}`.trim(),
      timestamp,
      parts: [{
        type: 'customSummary',
        title: message.customType || 'Custom',
        text: extractContentText(message.content),
      }],
      rawContent,
      kind: 'custom',
    }
  }

  if (message.role === 'branchSummary') {
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `Branch summary\n${message.summary || ''}`.trim(),
      timestamp,
      parts: [{ type: 'customSummary', title: 'Branch summary', text: message.summary || '' }],
      kind: 'branchSummary',
    }
  }

  if (message.role === 'compactionSummary') {
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `Compaction summary${typeof message.tokensBefore === 'number' ? ` (${message.tokensBefore} tokens before)` : ''}\n${message.summary || ''}`.trim(),
      timestamp,
      parts: [{
        type: 'customSummary',
        title: `Compaction summary${typeof message.tokensBefore === 'number' ? ` (${message.tokensBefore} tokens before)` : ''}`,
        text: `${typeof message.tokensBefore === 'number' ? `${message.tokensBefore} tokens before\n` : ''}${message.summary || ''}`.trim(),
      }],
      kind: 'compactionSummary',
    }
  }

  if (message.role === 'bashExecution') {
    const output = message.output?.trim() || '(no output)'
    const status = message.cancelled
      ? 'cancelled'
      : typeof message.exitCode === 'number' && message.exitCode !== 0
        ? `exit ${message.exitCode}`
        : 'ok'
    const truncated = message.truncated && message.fullOutputPath ? `\n[full output: ${message.fullOutputPath}]` : ''
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `Bash execution (${status})\n$ ${message.command || ''}\n${output}${truncated}`.trim(),
      timestamp,
      kind: 'custom',
    }
  }

  return null
}

function toUiMessages(sessionId: string, storedMessages: StoredMessage[]): Message[] {
  return storedMessages
    .map((message, index) => toUiMessage(sessionId, message, index))
    .filter((message): message is Message => Boolean(message))
}

function sortWorkspaceFiles(files: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return [...files].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function uniqueWorkspaceEntries(entries: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false
    seen.add(entry.path)
    return true
  })
}

function isDocumentLike(path: string): boolean {
  return /\.(pdf|doc|docx|ppt|pptx|pptm|md|txt|xlsx|csv|html|htm)$/i.test(path)
}

function buildWorkspaceViewModel(
  files: WorkspaceFileEntry[],
  activeArtifacts: ArtifactEntity[],
  recentOpenedPaths: string[],
): WorkspaceViewModel {
  const artifactFiles = activeArtifacts
    .filter((artifact) => artifact.status !== 'failed' && artifact.sourcePath && isDocumentLike(artifact.sourcePath))
    .map((artifact) => ({
      name: basename(artifact.sourcePath || artifact.title),
      path: artifact.sourcePath || artifact.title,
      isDir: false,
      size: 0,
      modifiedAt: new Date(artifact.updatedAt).toISOString(),
    }))

  const sorted = uniqueWorkspaceEntries(sortWorkspaceFiles([...artifactFiles, ...files]))

  const filesOnly = sorted
    .filter((entry) => !entry.isDir)
    .sort((a, b) => {
      const aRecent = recentOpenedPaths.includes(a.path) ? 1 : 0
      const bRecent = recentOpenedPaths.includes(b.path) ? 1 : 0
      if (aRecent !== bRecent) return bRecent - aRecent
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    })
  const directories = sorted.filter((entry) => entry.isDir)

  return { files: filesOnly, directories }
}

function buildUploadItems(
  files: WorkspaceFileEntry[],
  activeArtifacts: ArtifactEntity[],
  recentOpenedPaths: string[],
): ContextResourceItem[] {
  const artifactFiles = activeArtifacts
    .filter((artifact) => artifact.status !== 'failed' && artifact.sourcePath && isDocumentLike(artifact.sourcePath))
    .map((artifact) => ({
      id: artifact.id,
      label: artifact.title,
      path: artifact.sourcePath,
      meta: artifact.metadata.actionLabel,
    }))

  const workspaceDocs = files
    .filter((entry) => !entry.isDir && isDocumentLike(entry.path))
    .sort((a, b) => {
      const aRecent = recentOpenedPaths.includes(a.path) ? 1 : 0
      const bRecent = recentOpenedPaths.includes(b.path) ? 1 : 0
      if (aRecent !== bRecent) return bRecent - aRecent
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    })
    .map((entry) => ({
      id: entry.path,
      label: entry.name,
      path: entry.path,
      meta: entry.modifiedAt,
    }))

  const seen = new Set<string>()
  return [...artifactFiles, ...workspaceDocs]
    .filter((item) => item.path)
    .filter((item) => {
      if (!item.path || seen.has(item.path)) return false
      seen.add(item.path)
      return true
    })
    .slice(0, 6)
}

function normalizeArtifact(entity: any): ArtifactEntity {
  return {
    ...entity,
    createdAt: new Date(entity.createdAt).getTime(),
    updatedAt: new Date(entity.updatedAt).getTime(),
  }
}

function artifactToResultItem(artifact: ArtifactEntity): ResultItem {
  const path = artifact.sourcePath || artifact.title
  let kind: ResultItem['kind'] = 'created'
  if (artifact.status === 'failed') kind = 'failed'
  else if (artifact.sourceKind === 'manual') kind = 'viewed'
  else if (artifact.versions.length > 1) kind = 'updated'
  else if (artifact.artifactType === 'slides' || artifact.artifactType === 'table') kind = 'exported'

  return {
    id: artifact.id,
    sessionId: artifact.sessionId,
    path,
    title: artifact.title,
    kind,
    action: artifact.metadata.actionLabel || artifact.title,
    updatedAt: new Date(artifact.updatedAt).toISOString(),
    isNew: artifact.status !== 'failed' && Date.now() - artifact.updatedAt < 60_000,
    errorSummary: artifact.metadata.errorSummary,
  }
}

function buildSessionStatus(runtimeStatus: RuntimeStatus | null, sessionPath: string): Session['status'] {
  if (!runtimeStatus || !runtimeStatus.sessionPath || normalizePath(runtimeStatus.sessionPath) !== normalizePath(sessionPath)) return 'idle'
  if (runtimeStatus.status === 'waiting') return 'waiting'
  if (runtimeStatus.status === 'failed') return 'failed'
  if (runtimeStatus.status === 'completed' || runtimeStatus.status === 'idle') return 'idle'
  return 'running'
}

function pickPreferredArtifact(artifacts: ArtifactEntity[]): ArtifactEntity | null {
  if (artifacts.length === 0) return null
  const sorted = [...artifacts].sort((a, b) => {
    const priorityA = a.metadata.primary ? 3 : a.metadata.pinned ? 2 : a.status === 'ready' ? 1 : 0
    const priorityB = b.metadata.primary ? 3 : b.metadata.pinned ? 2 : b.status === 'ready' ? 1 : 0
    if (priorityA !== priorityB) return priorityB - priorityA
    return b.updatedAt - a.updatedAt
  })
  return sorted[0] || null
}

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSessionPath, setActiveSessionPath] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(280)
  const [rightPanelWidth, setRightPanelWidth] = useState(360)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [currentModel, setCurrentModel] = useState('')
  const [currentDir, setCurrentDir] = useState('')
  const [runtimeWorkspaceDir, setRuntimeWorkspaceDir] = useState('')
  const [thinkingLevel, setThinkingLevel] = useState('medium')
  const [isInitialized, setIsInitialized] = useState(false)
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([])
  const [workspaceChildrenByDir, setWorkspaceChildrenByDir] = useState<Record<string, WorkspaceFileEntry[]>>({})
  const [artifactsBySession, setArtifactsBySession] = useState<Record<string, ArtifactEntity[]>>({})
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)
  const [recentOpenedPaths, setRecentOpenedPaths] = useState<string[]>([])
  const [contextSkills, setContextSkills] = useState<SkillSummaryEntry[]>([])
  const [contextConnectors, setContextConnectors] = useState<ConnectorSummaryEntry[]>([])

  const [showWizard, setShowWizard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showProvider, setShowProvider] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [newSessionError, setNewSessionError] = useState<string | null>(null)
  const [hasProvider, setHasProvider] = useState(false)
  const currentDirRef = useRef(currentDir)
  const activeSessionPathRef = useRef<string | null>(activeSessionPath)
  const latestSessionDetailsRef = useRef<Record<string, SessionDetail>>({})
  const workspaceRequestRef = useRef(0)
  const sessionRequestRef = useRef(0)
  const previewRequestRef = useRef(0)
  const skipNextSessionReloadRef = useRef<string | null>(null)
  const isStreamingRef = useRef(false)

  const hasRunnableProvider = useCallback((providerList: ProviderSummary[]) => {
    return providerList.some((provider) => provider.hasAuth && provider.models.length > 0)
  }, [])

  const effectiveCurrentDir = currentDir || runtimeWorkspaceDir
  const directoryOptions = Array.from(new Set([effectiveCurrentDir, ...sessions.map((session) => session.cwd)].filter(Boolean)))
  const activeSession =
    sessions.find((session) => activeSessionPath && normalizePath(session.path) === normalizePath(activeSessionPath))
    || sessions.find((session) => session.id === activeSessionId)
    || null
  const workspaceFilesRoot = workspaceFiles.length > 0 ? dirname(workspaceFiles[0].path) : ''
  const sessionWorkspaceDir = activeSessionPath && activeSession ? activeSession.cwd : ''
  const visibleWorkspaceDir = sessionWorkspaceDir || effectiveCurrentDir || workspaceFilesRoot
  const activeArtifactKey = activeSessionPath || activeSessionId
  const activeArtifacts = useMemo(() => {
    if (!activeArtifactKey) return []
    return artifactsBySession[activeArtifactKey] || []
  }, [activeArtifactKey, artifactsBySession])
  const activeRuntimeStatus = useMemo(() => {
    if (!runtimeStatus) return null
    if (runtimeStatus.sessionId && activeSessionId && runtimeStatus.sessionId !== activeSessionId) return null
    if (
      runtimeStatus.sessionPath
      && activeSessionPath
      && normalizePath(runtimeStatus.sessionPath) !== normalizePath(activeSessionPath)
    ) return null
    return runtimeStatus
  }, [activeSessionId, activeSessionPath, runtimeStatus])

  const onAssistantMessage = useCallback((message: Message) => {
    setMessages((previous) => {
      const index = previous.findIndex((entry) => entry.id === message.id)
      if (index >= 0) {
        const next = [...previous]
        next[index] = message
        return next
      }
      return [...previous, message]
    })
  }, [])

  const onStreamStart = useCallback(() => {
    isStreamingRef.current = true
    setIsStreaming(true)
  }, [])
  const onStreamEnd = useCallback(() => {
    isStreamingRef.current = false
    setIsStreaming(false)
  }, [])

  const showRuntimeError = useCallback(
    (error: string) => {
      onAssistantMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: Date.now(),
      })
    },
    [onAssistantMessage],
  )

  const loadWorkspaceFiles = useCallback(async (dir: string): Promise<WorkspaceFileEntry[]> => {
    const requestId = workspaceRequestRef.current + 1
    workspaceRequestRef.current = requestId

    if (!dir) {
      if (workspaceRequestRef.current === requestId) {
        setWorkspaceFiles([])
      }
      return []
    }

    const response = await window.piDesktop.files.list(dir)
    if (workspaceRequestRef.current !== requestId) {
      return []
    }

    if (!response?.success || !Array.isArray(response.data)) {
      setWorkspaceFiles([])
      return []
    }

    const files = sortWorkspaceFiles(response.data as WorkspaceFileEntry[])
    setWorkspaceFiles(files)
    return files
  }, [])

  const loadWorkspaceDirectory = useCallback(async (dir: string): Promise<WorkspaceFileEntry[]> => {
    const rootDir = currentDirRef.current
    const response = await window.piDesktop.files.list(dir)
    if (!isPathWithinRoot(dir, currentDirRef.current) || normalizePath(rootDir) !== normalizePath(currentDirRef.current)) {
      return []
    }

    if (!response?.success || !Array.isArray(response.data)) {
      setWorkspaceChildrenByDir((previous) => ({ ...previous, [dir]: [] }))
      return []
    }

    const files = sortWorkspaceFiles(response.data as WorkspaceFileEntry[])
    setWorkspaceChildrenByDir((previous) => ({ ...previous, [dir]: files }))
    return files
  }, [])

  const refreshWorkspaceTree = useCallback(async (dir: string): Promise<void> => {
    if (!dir) {
      await loadWorkspaceFiles('')
      return
    }

    await loadWorkspaceFiles(dir)
    const expandedDirectories = Object.keys(workspaceChildrenByDir).filter((path) => isPathWithinRoot(path, dir))
    await Promise.all(expandedDirectories.map((path) => loadWorkspaceDirectory(path)))
  }, [loadWorkspaceDirectory, loadWorkspaceFiles, workspaceChildrenByDir])

  const loadContextSummary = useCallback(async () => {
    const response = await window.piDesktop.desktop.getStateSummary()
    if (!response.success || !response.data) {
      setContextSkills([])
      setContextConnectors([])
      return
    }

    setContextSkills(Array.isArray(response.data.skills) ? response.data.skills as SkillSummaryEntry[] : [])
    setContextConnectors(Array.isArray(response.data.connectors) ? response.data.connectors as ConnectorSummaryEntry[] : DEFAULT_CONNECTORS)
  }, [])

  const loadArtifacts = useCallback(async (sessionKey: string | null) => {
    if (!sessionKey) {
      setActiveArtifactId(null)
      return []
    }

    const artifactApi = window.piDesktop.artifacts
    if (!artifactApi?.list) {
      setArtifactsBySession((previous) => ({ ...previous, [sessionKey]: [] }))
      setActiveArtifactId(null)
      return []
    }

    const response = await artifactApi.list(sessionKey)
    if (!response.success || !Array.isArray(response.data)) {
      setArtifactsBySession((previous) => ({ ...previous, [sessionKey]: [] }))
      return []
    }

    const nextArtifacts = (response.data as unknown as any[])
      .map((artifact) => normalizeArtifact(artifact))
      .sort((a, b) => b.updatedAt - a.updatedAt)

    setArtifactsBySession((previous) => ({ ...previous, [sessionKey]: nextArtifacts }))
    setActiveArtifactId((previous) => {
      if (previous && nextArtifacts.some((artifact) => artifact.id === previous)) {
        return previous
      }
      return pickPreferredArtifact(nextArtifacts)?.id || null
    })
    return nextArtifacts
  }, [])

  const adoptRuntimeWorkspace = useCallback(
    async (dir: string): Promise<WorkspaceFileEntry[]> => {
      if (!dir) return []

      if (currentDir) {
        currentDirRef.current = currentDir
        return loadWorkspaceFiles(currentDir)
      }

      if (!runtimeWorkspaceDir || normalizePath(runtimeWorkspaceDir) !== normalizePath(dir)) {
        currentDirRef.current = dir
        setRuntimeWorkspaceDir(dir)
        setWorkspaceChildrenByDir({})
      }

      return loadWorkspaceFiles(dir)
    },
    [currentDir, loadWorkspaceFiles, runtimeWorkspaceDir],
  )

  const handleSelectArtifact = useCallback((path: string) => {
    if (!activeArtifactKey) return
    const match = (artifactsBySession[activeArtifactKey] || []).find((artifact) => artifact.sourcePath === path)
    if (match) {
      setActiveArtifactId(match.id)
    }
  }, [activeArtifactKey, artifactsBySession])

  const handleOpenPreviewFile = useCallback(async (path: string) => {
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    const response = await window.piDesktop.files.read(path)
    const ext = path.includes('.') ? `.${path.split('.').pop()?.toLowerCase() || ''}` : ''
    const name = path.split(/[/\\]/).pop() || path
    if (requestId !== previewRequestRef.current) return

    if (!response.success || !response.data) {
      setPreviewFile({
        path,
        name,
        ext,
        type: 'binary',
        reason: response.error || 'Preview unavailable',
      })
      setRightPanelCollapsed(false)
      return
    }

    if (activeSessionId && window.piDesktop.artifacts?.view) {
      const sessionKey = activeSessionPath || activeSessionId
      void window.piDesktop.artifacts.view({ sessionId: activeSessionId, sessionPath: activeSessionPath || undefined, path }).then(() => {
        void loadArtifacts(sessionKey)
      })
    }

    setPreviewFile({
      path,
      name,
      ext,
      ...(response.data as FilePreviewData),
    })
    setRightPanelCollapsed(false)
    setRecentOpenedPaths((previous) => [path, ...previous.filter((entry) => entry !== path)].slice(0, 10))
  }, [activeSessionId, activeSessionPath, loadArtifacts])

  const handleBrowseWorkspaceDirectory = useCallback(
    async (path: string) => {
      if (workspaceChildrenByDir[path]) {
        setWorkspaceChildrenByDir((previous) => {
          const next = { ...previous }
          delete next[path]
          return next
        })
        return
      }

      await loadWorkspaceDirectory(path)
    },
    [loadWorkspaceDirectory, workspaceChildrenByDir],
  )

  const loadProviders = useCallback(async (): Promise<ProviderSummary[]> => {
    const response = await window.piDesktop.providers.list()
    if (!response.success || !Array.isArray(response.data)) {
      setProviders([])
      setModelOptions([])
      setCurrentModel('')
      return []
    }

    const nextProviders = response.data as ProviderSummary[]
    const nextModelOptions = buildModelOptions(nextProviders)
    setProviders(nextProviders)
    setModelOptions(nextModelOptions)
    setCurrentModel((previous) =>
      previous && nextModelOptions.some((option) => option.id === previous)
        ? previous
        : getInitialModel(nextProviders),
    )
    return nextProviders
  }, [])

  const loadSessions = useCallback(async (): Promise<Session[]> => {
    const response = await window.piDesktop.session.list()
    if (!response.success || !Array.isArray(response.data)) {
      setSessions([])
      return []
    }

    const nextSessions: Session[] = (response.data as SessionListItem[]).map((session) => {
      const cachedDetail = latestSessionDetailsRef.current[normalizePath(session.path)]
      const baseUpdatedAt = new Date(session.updatedAt).getTime()
      const baseSession: Session = {
        id: session.id,
        path: session.path,
        cwd: session.cwd,
        source: session.source,
        title: session.title,
        createdAt: new Date(session.createdAt).getTime(),
        updatedAt: baseUpdatedAt,
        messages: [],
        model: session.model || undefined,
        tokenCount: session.tokenCount,
        messageCount: session.messageCount,
        thinkingLevel: 'medium',
        cwdLabel: session.cwd.split(/[\\/]/).filter(Boolean).pop() || session.cwd,
        lastActiveLabel: undefined,
        status: buildSessionStatus(runtimeStatus, session.path),
      }

      if (!cachedDetail) return baseSession

      const detailMessages = toUiMessages(cachedDetail.sessionPath || cachedDetail.sessionId, cachedDetail.messages as StoredMessage[])
      const detailUpdatedAt = detailMessages[detailMessages.length - 1]?.timestamp || baseUpdatedAt
      return {
        ...baseSession,
        id: cachedDetail.sessionId || baseSession.id,
        path: cachedDetail.sessionPath || baseSession.path,
        cwd: cachedDetail.cwd || baseSession.cwd,
        title: cachedDetail.title || baseSession.title,
        updatedAt: Math.max(baseUpdatedAt, detailUpdatedAt),
        messages: detailMessages,
        model: cachedDetail.model || baseSession.model,
        tokenCount: cachedDetail.tokenCount,
        messageCount: detailMessages.length || baseSession.messageCount,
        thinkingLevel: cachedDetail.thinkingLevel || baseSession.thinkingLevel,
        cwdLabel: (cachedDetail.cwd || baseSession.cwd).split(/[\\/]/).filter(Boolean).pop() || cachedDetail.cwd || baseSession.cwd,
        status: buildSessionStatus(runtimeStatus, cachedDetail.sessionPath || baseSession.path),
      }
    })
    let mergedSessions = nextSessions
    setSessions((previous) => {
      const activePath = activeSessionPathRef.current
      if (!activePath) return nextSessions

      const hasActiveSession = nextSessions.some((session) => session.path === activePath)
      if (hasActiveSession) return nextSessions

      const previousActive = previous.find((session) => session.path === activePath)
      if (!previousActive) return nextSessions

      mergedSessions = [previousActive, ...nextSessions].sort((a, b) => b.updatedAt - a.updatedAt)
      return mergedSessions
    })
    return mergedSessions
  }, [runtimeStatus])

  const syncSessionDetail = useCallback(
    (detail: SessionDetail, options: SyncSessionOptions = {}) => {
      const { activate = false, updateWorkspace = false } = options
      const nextMessages = toUiMessages(detail.sessionPath || detail.sessionId, detail.messages as StoredMessage[])
      if (detail.sessionPath) {
        latestSessionDetailsRef.current[normalizePath(detail.sessionPath)] = detail
      }
      if (activate) {
        setActiveSessionId(detail.sessionId)
        setActiveSessionPath(detail.sessionPath)
        activeSessionPathRef.current = detail.sessionPath
        setThinkingLevel(detail.thinkingLevel || 'medium')
        if (detail.model) setCurrentModel(detail.model)
      }
      if (updateWorkspace) {
        setCurrentDir(detail.cwd)
        setRuntimeWorkspaceDir('')
        setWorkspaceChildrenByDir({})
      }
      if (activate && !isStreamingRef.current) {
        setMessages(nextMessages)
      }

      setSessions((previous) => {
        const existingSession = previous.find((session) => session.path === detail.sessionPath)
        const derivedUpdatedAt = nextMessages[nextMessages.length - 1]?.timestamp || existingSession?.updatedAt || Date.now()
        const nextSession: Session = {
          id: detail.sessionId,
          path: detail.sessionPath,
          cwd: detail.cwd,
          source: 'pi',
          title: detail.title,
          createdAt: existingSession?.createdAt || Date.now(),
          updatedAt: derivedUpdatedAt,
          messages: nextMessages,
          model: detail.model || undefined,
          tokenCount: detail.tokenCount,
          messageCount: nextMessages.length,
          thinkingLevel: detail.thinkingLevel,
          cwdLabel: detail.cwd.split(/[\\/]/).filter(Boolean).pop() || detail.cwd,
          lastActiveLabel: undefined,
          status: buildSessionStatus(runtimeStatus, detail.sessionPath),
        }

        const existingIndex = previous.findIndex((session) => session.path === detail.sessionPath)
        if (existingIndex >= 0) {
          const next = [...previous]
          next[existingIndex] = { ...next[existingIndex], ...nextSession }
          return next.sort((a, b) => b.updatedAt - a.updatedAt)
        }
        return [nextSession, ...previous].sort((a, b) => b.updatedAt - a.updatedAt)
      })
    },
    [runtimeStatus],
  )

  const loadSessionMessages = useCallback(
    async (sessionPath: string) => {
      if (skipNextSessionReloadRef.current === sessionPath) {
        skipNextSessionReloadRef.current = null
        return
      }

      const requestId = sessionRequestRef.current + 1
      sessionRequestRef.current = requestId
      const response = await window.piDesktop.session.switch(sessionPath)
      if (sessionRequestRef.current !== requestId) {
        return
      }
      if (!response.success || !response.data) {
        setMessages([])
        return
      }

      const detail = response.data as SessionDetail
      syncSessionDetail(detail, { activate: true })
      if (sessionRequestRef.current !== requestId) {
        return
      }
      await loadArtifacts(detail.sessionPath || detail.sessionId)
    },
    [loadArtifacts, syncSessionDetail],
  )

  const updateSessionRuntime = useCallback(
    async (updates: { modelId?: string; thinkingLevel?: string }) => {
      if (!activeSessionPath) {
        if (updates.modelId) setCurrentModel(updates.modelId)
        if (updates.thinkingLevel) setThinkingLevel(updates.thinkingLevel)
        return
      }

      const response = await window.piDesktop.session.updateRuntime({
        sessionPath: activeSessionPath,
        modelId: updates.modelId,
        thinkingLevel: updates.thinkingLevel,
      })

      if (!response.success || !response.data) {
        showRuntimeError(response.error || 'Failed to update Pi session runtime')
        return
      }

      syncSessionDetail(response.data as SessionDetail, { activate: true })
      await loadSessions()
    },
    [activeSessionPath, loadSessions, showRuntimeError, syncSessionDetail],
  )

  const handleDirectoryChange = useCallback(
    async (dir: string) => {
      if (!dir || dir === currentDir) return

      setCurrentDir(dir)
      setRuntimeWorkspaceDir('')
      setWorkspaceChildrenByDir({})
      setPreviewFile(null)
      setRuntimeStatus(null)
      await window.piDesktop.config.set('workingDirectory', dir)

      const matchingSession = [...sessions].filter((session) => session.cwd === dir).sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (matchingSession?.path) {
        setActiveSessionId(matchingSession.id)
        setActiveSessionPath(matchingSession.path)
        return
      }

      setActiveSessionId(null)
      setActiveSessionPath(null)
      setMessages([])
      setActiveArtifactId(null)
    },
    [currentDir, sessions],
  )

  const handlePickDirectory = useCallback(async () => {
    const response = await window.piDesktop.files.pickDirectory(currentDirRef.current)
    if (!response.success || typeof response.data !== 'string' || !response.data) {
      return null
    }
    return response.data
  }, [])

  const handleBrowseDirectory = useCallback(async () => {
    const selected = await handlePickDirectory()
    if (!selected) return
    await handleDirectoryChange(selected)
  }, [handleDirectoryChange, handlePickDirectory])

  const { sendMessage } = useChatIPC({
    onAssistantMessage,
    onStreamStart,
    onStreamEnd,
    onRuntimeStatus: setRuntimeStatus,
    onArtifactCreated: ({ path, sessionId, sessionPath }) => {
      const targetSessionKey = sessionPath || sessionId || activeSessionPath || activeSessionId
      if (!targetSessionKey) return

      void (async () => {
        await loadArtifacts(targetSessionKey)
        const sessionWorkspace = sessions.find((session) =>
          (sessionPath && normalizePath(session.path) === normalizePath(sessionPath))
          || (!sessionPath && session.id === sessionId)
        )?.cwd
        const artifactWorkspace = sessionWorkspace || dirname(path)
        if (!currentDir && !activeSessionPathRef.current) {
          currentDirRef.current = artifactWorkspace
          setRuntimeWorkspaceDir(artifactWorkspace)
        }
        await refreshWorkspaceTree(artifactWorkspace)
      })()
    },
    onSessionSynced: (detail) => {
      sessionRequestRef.current += 1
      skipNextSessionReloadRef.current = detail.sessionPath
      const shouldActivate =
        !activeSessionPathRef.current
        || normalizePath(activeSessionPathRef.current) === normalizePath(detail.sessionPath)
      syncSessionDetail(detail, {
        activate: shouldActivate,
        updateWorkspace: false,
      })
      void (async () => {
        await loadSessions()
        syncSessionDetail(detail, {
          activate: shouldActivate,
          updateWorkspace: false,
        })
        await Promise.all([
          loadArtifacts(detail.sessionPath || detail.sessionId),
          refreshWorkspaceTree(detail.cwd),
        ])
      })()
    },
    currentModel,
    currentDir: visibleWorkspaceDir,
    currentSessionId: activeSessionId || undefined,
    currentSessionPath: activeSessionPath || undefined,
    thinkingLevel,
  })

  useEffect(() => {
    async function initialize() {
      const [providersLoaded, workingDirRes, wizardRes, activeSessionRes, sessionsLoaded] = await Promise.all([
        loadProviders(),
        window.piDesktop.config.get('workingDirectory'),
        window.piDesktop.config.get('wizardCompleted'),
        window.piDesktop.session.getActive(),
        loadSessions(),
        loadContextSummary(),
      ])

      const workingDirectory =
        workingDirRes.success && typeof workingDirRes.data === 'string' && workingDirRes.data
          ? workingDirRes.data
          : ''
      const wizardCompleted = wizardRes.success ? wizardRes.data === 'true' || wizardRes.data === true : false

      setCurrentDir(workingDirectory)
      setRuntimeWorkspaceDir('')
      setHasProvider(hasRunnableProvider(providersLoaded))

      const preferredSessionKey = activeSessionRes.success && typeof activeSessionRes.data === 'string' ? activeSessionRes.data : null
      const preferredSession = sessionsLoaded.find((session) =>
        preferredSessionKey
        && (
          normalizePath(session.path) === normalizePath(preferredSessionKey)
          || session.id === preferredSessionKey
        )
      ) || null
      setActiveSessionId(preferredSession?.id || null)
      setActiveSessionPath(preferredSession?.path || null)

      await loadWorkspaceFiles(preferredSession?.cwd || workingDirectory)

      setShowWizard(!wizardCompleted && !hasRunnableProvider(providersLoaded))
      setIsInitialized(true)
    }

    void initialize()
  }, [hasRunnableProvider, loadContextSummary, loadProviders, loadSessions, loadWorkspaceFiles])

  useEffect(() => {
    if (!activeSessionPath) return
    void loadSessionMessages(activeSessionPath)
  }, [activeSessionPath, loadSessionMessages])

  useEffect(() => {
    setRuntimeStatus(null)
  }, [activeSessionPath, currentModel])

  useEffect(() => {
    currentDirRef.current = visibleWorkspaceDir
  }, [visibleWorkspaceDir])

  useEffect(() => {
    activeSessionPathRef.current = activeSessionPath
  }, [activeSessionPath])

  useEffect(() => {
    if (!visibleWorkspaceDir) return
    void loadWorkspaceFiles(visibleWorkspaceDir)
  }, [loadWorkspaceFiles, visibleWorkspaceDir])

  useEffect(() => {
    setSessions((previous) =>
      previous.map((session) => ({
        ...session,
        status: buildSessionStatus(runtimeStatus, session.path),
      })),
    )
  }, [runtimeStatus])

  useEffect(() => {
    if (!activeArtifactKey) {
      setActiveArtifactId(null)
      return
    }
    const preferred = pickPreferredArtifact(artifactsBySession[activeArtifactKey] || [])
    setActiveArtifactId((previous) => previous || preferred?.id || null)
  }, [activeArtifactKey, artifactsBySession])

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !currentModel) return

      const startedAt = Date.now()
      onStreamStart()
      setRuntimeStatus({
        status: 'preparing',
        statusLabel: 'Preparing',
        lastAction: activeSessionPath ? 'Connecting to the selected Pi session' : 'Creating a new Pi session',
        startedAt,
        elapsedMs: 0,
        isWaitingForUser: false,
        sessionId: activeSessionId || undefined,
        sessionPath: activeSessionPath || undefined,
      })

      setMessages((previous) => [
        ...previous,
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: Date.now(),
        },
      ])

      const response = await sendMessage(text)
      if (response?.success && response.data) {
        const data = response.data as { sessionId: string; sessionPath: string; createdNewSession: boolean; runId: string }
        if (data.createdNewSession || !activeSessionPath) {
          setActiveSessionId(data.sessionId)
          setActiveSessionPath(data.sessionPath)
          await Promise.all([loadSessions(), loadArtifacts(data.sessionPath || data.sessionId)])
        }
      }
    },
    [activeSessionId, activeSessionPath, currentModel, isStreaming, loadArtifacts, loadSessions, onStreamStart, sendMessage],
  )

  const handleArtifactAction = useCallback((action: 'improve' | 'regenerate' | 'summarize' | 'new_task', path: string) => {
    const artifact = activeArtifactKey ? (artifactsBySession[activeArtifactKey] || []).find((entry) => entry.sourcePath === path) : undefined
    const title = artifact?.title || path.split(/[/\\]/).pop() || path
    const type = artifact?.artifactType || 'file'

    let prompt = ''
    if (action === 'improve') {
      prompt = `Please continue improving the current ${type} artifact "${title}". Use the file at "${path}" as the primary source, keep the same session context, and produce a stronger next version.`
    } else if (action === 'regenerate') {
      prompt = `Please regenerate the ${type} artifact "${title}" from the current session context. Use the existing file at "${path}" as reference, but feel free to restructure it if needed.`
    } else if (action === 'summarize') {
      prompt = `Please summarize the artifact "${title}" located at "${path}". Focus on the key conclusions, deliverables, and next actions.`
    } else {
      prompt = `Create a new follow-up task based on the artifact "${title}" at "${path}". Use it as the starting context and propose the next concrete piece of work.`
    }

    void handleSendMessage(prompt)
  }, [activeArtifactKey, artifactsBySession, handleSendMessage])

  const handleCreateSession = useCallback(
    async (cwd?: string) => {
      setIsCreatingSession(true)
      setNewSessionError(null)

      try {
        const response = await window.piDesktop.session.create(cwd ? { cwd } : undefined)
        if (!response.success || !response.data) {
          setNewSessionError(response.error || 'Failed to create a new session.')
          return
        }

        const created = response.data as {
          id: string
          path: string
          sessionId?: string
          sessionPath?: string
          cwd: string
          title: string
          messages?: unknown[]
          model?: string | null
          thinkingLevel?: string
          tokenCount?: number
          source: 'pi'
          createdAt: string
          updatedAt: string
        }

        setWorkspaceChildrenByDir({})
        setMessages([])
        setPreviewFile(null)
        setActiveArtifactId(null)
        setShowNewSessionDialog(false)
        setNewSessionError(null)
        await window.piDesktop.config.set('workingDirectory', created.cwd)

        if (created.sessionId && created.sessionPath && Array.isArray(created.messages)) {
          skipNextSessionReloadRef.current = created.sessionPath
          syncSessionDetail({
            sessionId: created.sessionId,
            sessionPath: created.sessionPath,
            cwd: created.cwd,
            title: created.title,
            messages: created.messages,
            model: created.model || null,
            thinkingLevel: created.thinkingLevel || 'medium',
            tokenCount: created.tokenCount || 0,
          }, { activate: true, updateWorkspace: true })
          await Promise.all([loadWorkspaceFiles(created.cwd), loadArtifacts(created.sessionPath || created.sessionId)])
        } else {
          const detailResponse = await window.piDesktop.session.switch(created.path)
          if (detailResponse.success && detailResponse.data) {
            const detail = detailResponse.data as SessionDetail
            skipNextSessionReloadRef.current = detail.sessionPath
            syncSessionDetail(detail, { activate: true, updateWorkspace: true })
            await Promise.all([loadWorkspaceFiles(detail.cwd), loadArtifacts(detail.sessionPath || detail.sessionId)])
          } else {
            setActiveSessionId(created.id)
            setActiveSessionPath(created.path)
            setCurrentDir(created.cwd)
            setRuntimeWorkspaceDir('')
            await Promise.all([loadWorkspaceFiles(created.cwd), loadArtifacts(created.path || created.id)])
          }
        }

        await loadSessions()
      } catch (error) {
        setNewSessionError(error instanceof Error ? error.message : 'Failed to create a new session.')
      } finally {
        setIsCreatingSession(false)
      }
    },
    [loadArtifacts, loadSessions, loadWorkspaceFiles, syncSessionDetail],
  )

  const handleComposerCommand = useCallback((command: string) => {
    if (command === '/new') {
      setNewSessionError(null)
      setShowNewSessionDialog(true)
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key === '/') {
        event.preventDefault()
        setShowShortcuts((state) => !state)
      }
      if (meta && event.key === 'p') {
        event.preventDefault()
        setShowProvider((state) => !state)
      }
      if (meta && event.key === ',') {
        event.preventDefault()
        setShowSettings((state) => !state)
      }
      if (meta && event.key === 'b') {
        event.preventDefault()
        setLeftPanelCollapsed((state) => !state)
      }
      if (meta && event.key === 'j') {
        event.preventDefault()
        setRightPanelCollapsed((state) => !state)
      }
      if (meta && event.key === 'k') {
        event.preventDefault()
        setMessages([])
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      const width = window.innerWidth
      if (width < 760 && !leftPanelCollapsed) setLeftPanelCollapsed(true)
      if (width < 560 && !rightPanelCollapsed) setRightPanelCollapsed(true)
    }

    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [leftPanelCollapsed, rightPanelCollapsed])

  const tokenCount = activeSession?.tokenCount || 0
  const contextLimit: number | null = null
  const tokenPct = contextLimit ? Math.min(Math.round((tokenCount / contextLimit) * 100), 100) : 0
  const showTokenWarning = Boolean(contextLimit && tokenPct > 70)
  const selectedModelOption = modelOptions.find((option) => option.id === currentModel)
  const currentModelLabel = selectedModelOption?.label || (currentModel ? `${currentModel} (unconfigured)` : '')

  const resultsForPanel = useMemo(() => {
    return activeArtifacts.map(artifactToResultItem).slice(0, 8)
  }, [activeArtifacts])

  const workspaceView = useMemo(
    () => buildWorkspaceViewModel(workspaceFiles, activeArtifacts, recentOpenedPaths),
    [workspaceFiles, activeArtifacts, recentOpenedPaths],
  )

  const contextUploads = useMemo(
    () => buildUploadItems(workspaceFiles, activeArtifacts, recentOpenedPaths),
    [workspaceFiles, activeArtifacts, recentOpenedPaths],
  )

  const connectorItems = useMemo<ContextResourceItem[]>(
    () =>
      contextConnectors.map((entry) => ({
        id: entry.id,
        label: entry.label,
        meta: entry.value,
      })),
    [contextConnectors],
  )

  const skillItems = useMemo<ContextResourceItem[]>(
    () =>
      contextSkills.map((entry) => ({
        id: entry.id,
        label: entry.label,
        meta: entry.value,
      })),
    [contextSkills],
  )

  if (!isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#151414',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        Loading Pi Desktop...
      </div>
    )
  }

  if (!hasProvider && !showWizard) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#151414' }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>Pi</div>
          <h1 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>Welcome to Pi Desktop</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 20 }}>Configure an AI provider to get started.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setShowWizard(true)} className="bp">Set Up Provider</button>
            <button onClick={() => setShowProvider(true)} className="bs">Advanced Setup</button>
          </div>
          {showWizard && <Welcome onComplete={() => { setShowWizard(false); setHasProvider(true); void loadProviders() }} />}
          {showProvider && <ProviderManager onClose={() => setShowProvider(false)} />}
        </div>
      </div>
    )
  }

  if (showWizard) {
    return <Welcome onComplete={() => { setShowWizard(false); setHasProvider(true); void loadProviders() }} />
  }

  return (
    <>
      <div className="app-shell">
        <TopBar
          currentDir={visibleWorkspaceDir}
          directoryOptions={directoryOptions}
          currentModel={currentModel}
          currentModelLabel={currentModelLabel}
          onDirectoryChange={(dir) => { void handleDirectoryChange(dir) }}
          onBrowseDirectory={() => { void handleBrowseDirectory() }}
          modelOptions={modelOptions}
          onModelChange={(model) => { void updateSessionRuntime({ modelId: model }) }}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={(level) => { void updateSessionRuntime({ thinkingLevel: level }) }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setShowProfile(true)}
          tokenCount={tokenCount}
          tokenLimit={contextLimit}
        />

        {showTokenWarning && (
          <div className="twarn">
            <span>!</span>
            <span>Context {tokenPct}% full. Consider /compact or a new session.</span>
          </div>
        )}

        <div className="body-layout">
          <LeftPanel
            sessions={sessions}
            activeSessionPath={activeSessionPath}
            onSessionSelect={(path) => {
              const selected = sessions.find((session) => session.path === path)
              setActiveSessionId(selected?.id || null)
              setActiveSessionPath(selected?.path || null)
              setWorkspaceChildrenByDir({})
              setPreviewFile(null)
            }}
            onSessionCreate={() => {
              setNewSessionError(null)
              setShowNewSessionDialog(true)
            }}
            onOpenModels={() => setShowProvider(true)}
            onOpenSkills={() => setShowSkills(true)}
            onOpenSettings={() => setShowSettings(true)}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed((state) => !state)}
            panelWidth={leftPanelWidth}
            onResize={setLeftPanelWidth}
          />
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            onCommand={handleComposerCommand}
            isStreaming={isStreaming}
            runtimeStatus={activeRuntimeStatus}
            onSetMessages={setMessages}
          />
          <PreviewPanel
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() => setRightPanelCollapsed((state) => !state)}
            panelWidth={rightPanelWidth}
            onResize={setRightPanelWidth}
            currentWorkspace={visibleWorkspaceDir}
            workspaceFiles={workspaceView.files}
            workspaceDirectories={workspaceView.directories}
            workspaceChildrenByDir={workspaceChildrenByDir}
            recentResults={resultsForPanel}
            runtimeStatus={activeRuntimeStatus}
            previewFile={previewFile}
            contextUploads={contextUploads}
            contextConnectors={connectorItems}
            contextSkills={skillItems}
            onSelectResult={handleSelectArtifact}
            onSelectFile={(path) => { void handleOpenPreviewFile(path) }}
            onToggleWorkspaceDirectory={(path) => { void handleBrowseWorkspaceDirectory(path) }}
            onClosePreview={() => setPreviewFile(null)}
            onOpenExternal={(path) => { void window.piDesktop.files.open(path) }}
            onOpenFolder={(path) => {
              const directory = path.includes('/') || path.includes('\\')
                ? path.replace(/[/\\][^/\\]+$/, '')
                : path
              void window.piDesktop.files.open(directory)
            }}
            onCopyPath={(path) => { void navigator.clipboard?.writeText(path) }}
          />
        </div>

        <StatusBar currentModel={currentModelLabel || currentModel} activeSessionCount={sessions.length} currentDir={visibleWorkspaceDir} />
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      {showProvider && <ProviderManager onClose={() => { setShowProvider(false); void loadProviders() }} />}
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
      {showSkills && <Skills onClose={() => setShowSkills(false)} />}
      <NewSessionDialog
        isOpen={showNewSessionDialog}
        currentDir={visibleWorkspaceDir}
        directoryOptions={directoryOptions}
        isCreating={isCreatingSession}
        error={newSessionError}
        onClose={() => {
          setNewSessionError(null)
          setShowNewSessionDialog(false)
        }}
        onCreate={(cwd) => { void handleCreateSession(cwd) }}
        onBrowseDirectory={handlePickDirectory}
      />
    </>
  )
}
