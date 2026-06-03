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
  const [leftPanelWidth, setLeftPanelWidth] = useState(220)
  const [rightPanelWidth, setRightPanelWidth] = useState(300)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Modal states
  const [showWizard, setShowWizard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showProvider, setShowProvider] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#151414' }}>
        <div style={{ textAlign: 'center', maxWidth: '300px' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🚀</div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'rgba(255,255,255,0.7)' }}>Welcome to Pi Desktop</h1>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginBottom: '20px' }}>Configure an AI provider to get started.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={() => setShowWizard(true)} className="bp">Set Up Provider</button>
            <button onClick={() => setShowProvider(true)} className="bs">Advanced Setup</button>
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
      <div className="app-shell">
        <TopBar
          currentDir="~/projects/ppt-demo"
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setShowProfile(true)}
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
            onSessionSelect={(id) => setActiveSessionId(id)}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            onOpenFiles={() => setShowFiles(true)}
            onOpenTools={() => {}}
            onOpenSkills={() => {}}
            onOpenMemory={() => {}}
            panelWidth={leftPanelWidth}
            onResize={setLeftPanelWidth}
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
            panelWidth={rightPanelWidth}
            onResize={setRightPanelWidth}
          />
        </div>

        <StatusBar />
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      {showProvider && <ProviderManager onClose={() => setShowProvider(false)} />}
      {showShortcuts && <Shortcuts onClose={() => setShowShortcuts(false)} />}
      {showFiles && <Files onClose={() => setShowFiles(false)} />}
    </>
  )
}
