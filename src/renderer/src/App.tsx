import { useState, useCallback, useEffect } from 'react'
import TopBar from './components/TopBar'
import LeftPanel from './components/LeftPanel'
import ChatView from './components/ChatView'
import PreviewPanel from './components/PreviewPanel'
import StatusBar from './components/StatusBar'
import Welcome from './screens/Welcome'
import Settings from './screens/Settings'
import Profile from './screens/Profile'
import ProviderManager from './screens/ProviderManager'
import Shortcuts from './screens/Shortcuts'
import Files from './screens/Files'
import Tools from './screens/Tools'
import Skills from './screens/Skills'
import Memory from './screens/Memory'
import type { Message, ModelOption, ProviderSummary, Session } from './types/chat'
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
      if (part.type === 'thinking') return part.thinking ? `[thinking]\n${part.thinking}` : '[thinking]'
      if (part.type === 'image') return `[image: ${part.source?.media_type || part.source?.type || 'image'}]`
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
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
    return {
      id: `${sessionId}-msg-${index}`,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: extractContentText(message.content),
      timestamp,
      toolCalls: message.role === 'assistant' ? extractToolCalls(message.content) : undefined,
      rawContent,
      kind: 'standard',
    }
  }

  if (message.role === 'toolResult') {
    const resultText = extractContentText(message.content)
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `Tool result (${message.toolName || message.toolCallId || 'tool'})\n${resultText}`.trim(),
      timestamp,
      rawContent,
      kind: 'toolResult',
    }
  }

  if (message.role === 'custom') {
    if (message.display === false) return null
    const customText = extractContentText(message.content)
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `[${message.customType || 'custom'}]\n${customText}`.trim(),
      timestamp,
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
      kind: 'branchSummary',
    }
  }

  if (message.role === 'compactionSummary') {
    return {
      id: `${sessionId}-msg-${index}`,
      role: 'assistant',
      content: `Compaction summary${typeof message.tokensBefore === 'number' ? ` (${message.tokensBefore} tokens before)` : ''}\n${message.summary || ''}`.trim(),
      timestamp,
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
    const truncated = message.truncated && message.fullOutputPath
      ? `\n[full output: ${message.fullOutputPath}]`
      : ''
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

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSessionPath, setActiveSessionPath] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(220)
  const [rightPanelWidth, setRightPanelWidth] = useState(300)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [currentModel, setCurrentModel] = useState('')
  const [currentDir, setCurrentDir] = useState('D:/PI/app')
  const [thinkingLevel, setThinkingLevel] = useState('medium')
  const [isInitialized, setIsInitialized] = useState(false)
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null)

  const [showWizard, setShowWizard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showProvider, setShowProvider] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [hasProvider, setHasProvider] = useState(false)
  const hasRunnableProvider = useCallback((providerList: ProviderSummary[]) => {
    return providerList.some((provider) => provider.hasAuth && provider.models.length > 0)
  }, [])

  const directoryOptions = Array.from(
    new Set([currentDir, ...sessions.map((session) => session.cwd)].filter(Boolean)),
  )
  const activeSession = sessions.find((session) => session.id === activeSessionId) || null

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

  const onStreamStart = useCallback(() => setIsStreaming(true), [])
  const onStreamEnd = useCallback(() => setIsStreaming(false), [])
  const showRuntimeError = useCallback((error: string) => {
    onAssistantMessage({
      id: `error-${Date.now()}`,
      role: 'assistant',
      content: `Error: ${error}`,
      timestamp: Date.now(),
    })
  }, [onAssistantMessage])

  const handleOpenPreviewFile = useCallback(async (path: string) => {
    const response = await window.piDesktop.files.read(path)
    if (!response.success || !response.data) return

    const ext = path.includes('.') ? `.${path.split('.').pop()?.toLowerCase() || ''}` : ''
    const name = path.split(/[/\\]/).pop() || path
    const data = response.data as { type: 'text' | 'image' | 'binary'; content?: string }

    setPreviewFile({
      path,
      name,
      ext,
      type: data.type,
      content: data.content,
    })
    setShowFiles(false)
  }, [])

  const loadProviders = useCallback(async (): Promise<ProviderSummary[]> => {
    const response = await window.piDesktop.providers.list()
    if (!response.success || !Array.isArray(response.data)) {
      setProviders([])
      setModelOptions([])
      setCurrentModel('')
      return []
    }

    const nextProviders = response.data as ProviderSummary[]
    const nextOptions = buildModelOptions(nextProviders)
    setProviders(nextProviders)
    setModelOptions(nextOptions)
    setCurrentModel((previous) => previous || getInitialModel(nextProviders))
    return nextProviders
  }, [])

  const loadSessions = useCallback(async (): Promise<Session[]> => {
    const response = await window.piDesktop.session.list()
    if (!response.success || !Array.isArray(response.data)) {
      setSessions([])
      return []
    }

    const loadedSessions = (response.data as SessionListItem[]).map((session) => ({
      id: session.id,
      path: session.path,
      cwd: session.cwd,
      source: session.source,
      title: session.title,
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: new Date(session.updatedAt).getTime(),
      messages: [],
      model: session.model || undefined,
      tokenCount: session.tokenCount,
      messageCount: session.messageCount,
    }))

    setSessions(loadedSessions)
    return loadedSessions
  }, [])

  const syncSessionDetail = useCallback(
    (detail: {
      sessionId: string
      sessionPath: string
      cwd: string
      title: string
      messages: unknown[]
      model: string | null
      thinkingLevel: string
      tokenCount: number
    }) => {
      setActiveSessionId(detail.sessionId)
      setActiveSessionPath(detail.sessionPath)
      setCurrentDir(detail.cwd)
      setThinkingLevel(detail.thinkingLevel || 'medium')
      if (detail.model) {
        setCurrentModel(detail.model)
      }

      const nextMessages = toUiMessages(detail.sessionId, detail.messages as StoredMessage[])
      setMessages(nextMessages)
      setSessions((previous) => {
        const index = previous.findIndex((session) => session.path === detail.sessionPath)
        const nextSession: Session = {
          id: detail.sessionId,
          path: detail.sessionPath,
          cwd: detail.cwd,
          source: 'pi',
          title: detail.title,
          createdAt: previous[index]?.createdAt || Date.now(),
          updatedAt: Date.now(),
          messages: nextMessages,
          model: detail.model || undefined,
          tokenCount: detail.tokenCount,
          messageCount: nextMessages.length,
          thinkingLevel: detail.thinkingLevel,
        }

        if (index >= 0) {
          const next = [...previous]
          next[index] = {
            ...next[index],
            ...nextSession,
          }
          return next.sort((a, b) => b.updatedAt - a.updatedAt)
        }

        return [nextSession, ...previous].sort((a, b) => b.updatedAt - a.updatedAt)
      })
    },
    [],
  )

  const loadSessionMessages = useCallback(
    async (sessionPath: string): Promise<void> => {
      const response = await window.piDesktop.session.switch(sessionPath)
      if (!response.success || !response.data) {
        setMessages([])
        return
      }

      syncSessionDetail(response.data as {
        sessionId: string
        sessionPath: string
        cwd: string
        title: string
        messages: unknown[]
        model: string | null
        thinkingLevel: string
        tokenCount: number
      })
    },
    [syncSessionDetail],
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

      syncSessionDetail(response.data as {
        sessionId: string
        sessionPath: string
        cwd: string
        title: string
        messages: unknown[]
        model: string | null
        thinkingLevel: string
        tokenCount: number
      })
      await loadSessions()
    },
    [activeSessionPath, loadSessions, showRuntimeError, syncSessionDetail],
  )

  const handleDirectoryChange = useCallback(
    async (dir: string) => {
      if (!dir || dir === currentDir) return

      setCurrentDir(dir)
      setPreviewFile(null)
      await window.piDesktop.config.set('workingDirectory', dir)

      const matchingSession = [...sessions]
        .filter((session) => session.cwd === dir)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]

      if (matchingSession?.path) {
        setActiveSessionId(matchingSession.id)
        setActiveSessionPath(matchingSession.path)
        return
      }

      setActiveSessionId(null)
      setActiveSessionPath(null)
      setMessages([])
    },
    [currentDir, sessions],
  )

  const { sendMessage } = useChatIPC({
    onAssistantMessage,
    onStreamStart,
    onStreamEnd,
    onArtifactCreated: (path) => {
      void handleOpenPreviewFile(path)
    },
    onSessionSynced: (detail) => {
      syncSessionDetail(detail)
      void loadSessions()
    },
    currentModel,
    currentSessionId: activeSessionId || undefined,
    currentSessionPath: activeSessionPath || undefined,
    thinkingLevel,
  })

  useEffect(() => {
    async function initialize(): Promise<void> {
      const [providersLoaded, workingDirRes, wizardRes, activeSessionRes, sessionsLoaded] = await Promise.all([
        loadProviders(),
        window.piDesktop.config.get('workingDirectory'),
        window.piDesktop.config.get('wizardCompleted'),
        window.piDesktop.session.getActive(),
        loadSessions(),
      ])

      const workingDirectory =
        workingDirRes.success && typeof workingDirRes.data === 'string' && workingDirRes.data
          ? workingDirRes.data
          : 'D:/PI/app'
      const wizardCompleted = wizardRes.success ? wizardRes.data === 'true' || wizardRes.data === true : false

      setCurrentDir(workingDirectory)
      const runnableProviderAvailable = hasRunnableProvider(providersLoaded)
      setHasProvider(runnableProviderAvailable)

      const preferredSessionId =
        activeSessionRes.success && typeof activeSessionRes.data === 'string'
          ? activeSessionRes.data
          : null
      const preferredSession = sessionsLoaded.find((session) => session.id === preferredSessionId) || sessionsLoaded[0] || null

      setActiveSessionId(preferredSession?.id || null)
      setActiveSessionPath(preferredSession?.path || null)
      if (preferredSession?.path) {
        await loadSessionMessages(preferredSession.path)
      }

      setShowWizard(!wizardCompleted && !runnableProviderAvailable)
      setIsInitialized(true)
    }

    void initialize()
  }, [hasRunnableProvider, loadProviders, loadSessionMessages, loadSessions])

  useEffect(() => {
    if (!activeSessionPath) {
      return
    }
    void loadSessionMessages(activeSessionPath)
  }, [activeSessionPath, loadSessionMessages])

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !currentModel) return

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }

      setMessages((previous) => [...previous, userMessage])
      const response = await sendMessage(text)
      if (response?.success && response.data) {
        const data = response.data as {
          sessionId: string
          sessionPath: string
          createdNewSession: boolean
        }
        if (data.createdNewSession || !activeSessionPath) {
          setActiveSessionId(data.sessionId)
          setActiveSessionPath(data.sessionPath)
          await loadSessions()
        }
      }
    },
    [activeSessionPath, currentModel, isStreaming, loadSessions, sendMessage],
  )

  const handleCreateSession = useCallback(async () => {
    const response = await window.piDesktop.session.create()
    if (!response.success || !response.data) return

    const created = response.data as {
      id: string
      path: string
      cwd: string
      title: string
      source: 'pi'
      createdAt: string
      updatedAt: string
    }
    await loadSessions()
    setActiveSessionId(created.id)
    setActiveSessionPath(created.path)
    setCurrentDir(created.cwd)
    setMessages([])
  }, [loadSessions])

  const handleComposerCommand = useCallback(
    async (command: string) => {
      if (command === '/new') {
        await handleCreateSession()
      }
    },
    [handleCreateSession],
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key === '/') { event.preventDefault(); setShowShortcuts((state) => !state) }
      if (meta && event.key === 'p') { event.preventDefault(); setShowProvider((state) => !state) }
      if (meta && event.key === ',') { event.preventDefault(); setShowSettings((state) => !state) }
      if (meta && event.key === 'b') { event.preventDefault(); setLeftPanelCollapsed((state) => !state) }
      if (meta && event.key === 'j') { event.preventDefault(); setRightPanelCollapsed((state) => !state) }
      if (meta && event.key === 'k') { event.preventDefault(); setMessages([]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      const width = window.innerWidth
      if (width < 700 && !leftPanelCollapsed) {
        setLeftPanelCollapsed(true)
      }
      if (width < 500 && !rightPanelCollapsed) {
        setRightPanelCollapsed(true)
      }
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [leftPanelCollapsed, rightPanelCollapsed])

  const tokenCount = activeSession?.tokenCount || 0
  const tokenPct = Math.min(Math.round((tokenCount / 8000) * 100), 100)
  const showTokenWarning = tokenPct > 70
  const selectedModelOption = modelOptions.find((option) => option.id === currentModel)
  const currentModelLabel = selectedModelOption?.label || (currentModel ? `${currentModel} (unconfigured)` : '')

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
        <div style={{ textAlign: 'center', maxWidth: '300px' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🧠</div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>Welcome to Pi Desktop</h1>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginBottom: '20px' }}>Configure an AI provider to get started.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
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
          currentDir={currentDir}
          directoryOptions={directoryOptions}
          currentModel={currentModel}
          currentModelLabel={currentModelLabel}
          onDirectoryChange={(dir) => { void handleDirectoryChange(dir) }}
          modelOptions={modelOptions}
          onModelChange={(model) => { void updateSessionRuntime({ modelId: model }) }}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={(level) => { void updateSessionRuntime({ thinkingLevel: level }) }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setShowProfile(true)}
          tokenCount={tokenCount}
          tokenLimit={8000}
        />

        {showTokenWarning && (
          <div className="twarn">
            <span>⚠</span>
            <span>Context {tokenPct}% full. Consider /compact or new session.</span>
          </div>
        )}

        <div className="body-layout">
          <LeftPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionSelect={(id) => {
              const selected = sessions.find((session) => session.id === id)
              setActiveSessionId(id)
              setActiveSessionPath(selected?.path || null)
              if (selected?.cwd) {
                setCurrentDir(selected.cwd)
              }
            }}
            onSessionCreate={handleCreateSession}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            onOpenFiles={() => setShowFiles(true)}
            onOpenTools={() => setShowTools(true)}
            onOpenSkills={() => setShowSkills(true)}
            onOpenMemory={() => setShowMemory(true)}
            panelWidth={leftPanelWidth}
            onResize={setLeftPanelWidth}
          />
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            onCommand={handleComposerCommand}
            isStreaming={isStreaming}
            onSetMessages={setMessages}
          />
          <PreviewPanel
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            panelWidth={rightPanelWidth}
            onResize={setRightPanelWidth}
            previewFile={previewFile}
            onClosePreview={() => setPreviewFile(null)}
            onOpenExternal={(path) => { void window.piDesktop.files.open(path) }}
          />
        </div>

        <StatusBar
          currentModel={currentModelLabel || currentModel}
          activeSessionCount={sessions.length}
          currentDir={currentDir}
        />
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      {showProvider && <ProviderManager onClose={() => { setShowProvider(false); void loadProviders() }} />}
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
      {showFiles && <Files onClose={() => setShowFiles(false)} onOpenFile={handleOpenPreviewFile} initialDir={currentDir} />}
      {showTools && (
        <Tools
          onClose={() => setShowTools(false)}
          sessionCount={sessions.length}
          providerCount={providers.length}
          currentDir={currentDir}
          currentModelLabel={currentModelLabel || currentModel}
          activeSessionTitle={activeSession?.title}
        />
      )}
      {showSkills && <Skills onClose={() => setShowSkills(false)} />}
      {showMemory && <Memory onClose={() => setShowMemory(false)} />}
    </>
  )
}
