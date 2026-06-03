import { useState, useCallback } from 'react'
import TopBar from './components/TopBar'
import LeftPanel from './components/LeftPanel'
import ChatView from './components/ChatView'
import PreviewPanel from './components/PreviewPanel'
import StatusBar from './components/StatusBar'
import type { Message, Session } from './types/chat'

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

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    // Mock streaming response (Phase 2 uses real IPC)
    setTimeout(() => {
      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'This is a mock response. Phase 2 will connect to Pi AgentSession.',
        timestamp: Date.now() + 200,
        toolCalls: [
          { id: 'tc-1', name: 'web_search', args: '("query")', status: 'done', duration: '0.8s' }
        ]
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsStreaming(false)
    }, 1500)
  }, [isStreaming])

  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-[#F1F5F9]">
      <TopBar currentDir="~/projects/ppt-demo" />
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
        />
        <PreviewPanel
          collapsed={rightPanelCollapsed}
          onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
        />
      </div>
      <StatusBar />
    </div>
  )
}
