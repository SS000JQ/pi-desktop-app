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
import type { Message, Session } from './types/chat'
import { useChatIPC } from './hooks/useChatIPC'

const mockSessions: Session[] = [
  { id: 's1', title: 'PPT 结构设计', createdAt: Date.now() - 300000, updatedAt: Date.now() - 180000, messages: [] },
  { id: 's2', title: '数据分析脚本', createdAt: Date.now() - 7200000, updatedAt: Date.now() - 3600000, messages: [] },
  { id: 's3', title: '配色方案生成', createdAt: Date.now() - 14400000, updatedAt: Date.now() - 7200000, messages: [] },
  { id: 's4', title: '周报草稿', createdAt: Date.now() - 172800000, updatedAt: Date.now() - 86400000, messages: [] },
]

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>('s1')
  const [sessions] = useState<Session[]>(mockSessions)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Modal states
  const [showWizard, setShowWizard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showProvider, setShowProvider] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [hasProvider, setHasProvider] = useState(true) // Phase 3: read from config

  const onAssistantMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const onStreamStart = useCallback(() => setIsStreaming(true), [])
  const onStreamEnd = useCallback(() => setIsStreaming(false), [])

  const { sendMessage } = useChatIPC({ onAssistantMessage, onStreamStart, onStreamEnd })

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    sendMessage(text)
  }, [isStreaming, sendMessage])

  // Keyboard shortcuts listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === '/') { e.preventDefault(); setShowShortcuts(s => !s) }
      if (meta && e.key === 'p') { e.preventDefault(); setShowProvider(s => !s) }
      if (meta && e.key === ',') { e.preventDefault(); setShowSettings(s => !s) }
      if (meta && e.key === 'b') { e.preventDefault(); setLeftPanelCollapsed(p => !p) }
      if (meta && e.key === 'j') { e.preventDefault(); setRightPanelCollapsed(p => !p) }
      if (meta && e.key === 'k') { e.preventDefault(); setMessages([]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Token warning
  const tokenCount = messages.reduce((sum, m) => sum + m.content.length / 4, 0)
  const tokenPct = Math.min(Math.round((tokenCount / 4000) * 100), 100)
  const showTokenWarning = tokenPct > 70

  // Empty state: no provider configured
  if (!hasProvider && !showWizard) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0F172A]">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3">🚀</div>
          <h1 className="text-lg font-semibold mb-2">Welcome to Pi Desktop</h1>
          <p className="text-sm text-muted mb-6">Configure an AI provider to get started.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowWizard(true)} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover">
              Set Up Provider
            </button>
            <button onClick={() => setShowProvider(true)} className="px-4 py-2 text-sm bg-surface text-muted rounded-lg border border-border hover:text-[#F1F5F9]">
              Advanced Setup
            </button>
          </div>
          {showWizard && <Welcome onComplete={() => { setShowWizard(false); setHasProvider(true) }} />}
          {showProvider && <ProviderManager onClose={() => setShowProvider(false)} />}
        </div>
      </div>
    )
  }

  // Show welcome wizard on first launch
  if (showWizard) {
    return <Welcome onComplete={() => setShowWizard(false)} />
  }

  return (
    <>
      <div className="flex flex-col h-screen bg-[#0F172A] text-[#F1F5F9]">
        <TopBar
          currentDir="~/projects/ppt-demo"
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setShowProfile(true)}
        />

        {showTokenWarning && (
          <div className="px-3 py-1 text-[10px] bg-warning/10 text-warning border-b border-warning/20 flex items-center gap-2">
            <span>⚠</span>
            <span>Context {tokenPct}% full. Consider /compact or new session.</span>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <LeftPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionSelect={(id) => setActiveSessionId(id)}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            onOpenFiles={() => {}}
            onOpenTools={() => {}}
            onOpenSkills={() => {}}
            onOpenMemory={() => {}}
          />
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
            onSetMessages={setMessages}
          />
          <PreviewPanel
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
          />
        </div>

        <StatusBar />
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      {showProvider && <ProviderManager onClose={() => setShowProvider(false)} />}
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
    </>
  )
}
