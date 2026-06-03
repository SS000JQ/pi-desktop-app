import { useState, useCallback } from 'react'
import TopBar from './components/TopBar'
import LeftPanel from './components/LeftPanel'
import ChatView from './components/ChatView'
import PreviewPanel from './components/PreviewPanel'
import StatusBar from './components/StatusBar'
import Welcome from './screens/Welcome'
import Settings from './screens/Settings'
import Profile from './screens/Profile'
import type { Message, Session } from './types/chat'
import { useChatIPC } from './hooks/useChatIPC'

const mockSessions: Session[] = [
  { id: 's1', title: 'PPT 结构设计', createdAt: Date.now() - 300000, updatedAt: Date.now() - 180000, messages: [] },
  { id: 's2', title: '数据分析脚本', createdAt: Date.now() - 7200000, updatedAt: Date.now() - 3600000, messages: [] },
  { id: 's3', title: '配色方案生成', createdAt: Date.now() - 14400000, updatedAt: Date.now() - 7200000, messages: [] },
  { id: 's4', title: '周报草稿', createdAt: Date.now() - 172800000, updatedAt: Date.now() - 86400000, messages: [] },
]

export default function App() {
  const [showWizard, setShowWizard] = useState(false) // Phase 3: read wizardCompleted from config
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>('s1')
  const [sessions] = useState<Session[]>(mockSessions)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Check for token limit (mock — Phase 3 gets real token count)
  const tokenCount = messages.reduce((sum, m) => sum + m.content.length / 4, 0)
  const showTokenWarning = tokenCount > 3000 // ~75% of 4k context

  const onAssistantMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const onStreamStart = useCallback(() => {
    setIsStreaming(true)
  }, [])

  const onStreamEnd = useCallback(() => {
    setIsStreaming(false)
  }, [])

  const { sendMessage } = useChatIPC({
    onAssistantMessage,
    onStreamStart,
    onStreamEnd,
  })

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

  // Token limit warning
  const TokenWarning = () => showTokenWarning ? (
    <div className="px-3 py-1 text-[10px] bg-warning/10 text-warning border-b border-warning/20 flex items-center gap-2">
      <span>⚠</span>
      <span>Context nearly full ({Math.round(tokenCount / 4000 * 100)}%). Consider /compact or start a new session.</span>
    </div>
  ) : null

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
        <TokenWarning />
        <div className="flex flex-1 min-h-0">
          <LeftPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionSelect={(id) => setActiveSessionId(id)}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
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
    </>
  )
}
