import { useCallback } from 'react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import ChatRuntimeStatusBar from './ChatRuntimeStatusBar'
import type { Message, RuntimeStatus } from '../types/chat'

interface ChatViewProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  onCommand?: (command: string) => void
  isStreaming: boolean
  runtimeStatus: RuntimeStatus | null
  onSetMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
}

export default function ChatView({ messages, onSendMessage, onCommand, isStreaming, runtimeStatus, onSetMessages }: ChatViewProps) {
  const handleRegenerate = useCallback((msgId: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId)
    const userMessages = messages.slice(0, msgIndex).filter(m => m.role === 'user')
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1]
      onSetMessages(prev => prev.filter(m => m.id !== msgId && m.id !== lastUserMsg.id))
      onSendMessage(lastUserMsg.content)
    }
  }, [messages, onSendMessage, onSetMessages])

  const handleEditMessage = useCallback((msgId: string) => {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      const msgIndex = messages.findIndex(m => m.id === msgId)
      onSetMessages(prev => prev.slice(0, msgIndex))
    }
  }, [messages, onSetMessages])

  return (
    <div className="chat">
      <ChatRuntimeStatusBar status={runtimeStatus} />
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onRegenerate={handleRegenerate}
        onEditMessage={handleEditMessage}
      />
      <InputBar onSendMessage={onSendMessage} onCommand={onCommand} isStreaming={isStreaming} />
    </div>
  )
}
