import { useState, useCallback } from 'react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import type { Message } from '../types/chat'
import { useChatIPC } from '../hooks/useChatIPC'

interface ChatViewProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  isStreaming: boolean
  onSetMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
}

export default function ChatView({ messages, onSendMessage, isStreaming, onSetMessages }: ChatViewProps) {
  const handleRegenerate = useCallback((msgId: string) => {
    // Find the last user message before this assistant message
    const msgIndex = messages.findIndex(m => m.id === msgId)
    const userMessages = messages.slice(0, msgIndex).filter(m => m.role === 'user')
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1]
      // Remove this assistant message and the user message, re-send
      onSetMessages(prev => prev.filter(m => m.id !== msgId && m.id !== lastUserMsg.id))
      onSendMessage(lastUserMsg.content)
    }
  }, [messages, onSendMessage, onSetMessages])

  const handleEditMessage = useCallback((msgId: string) => {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      // Remove this user message and all messages after it
      const msgIndex = messages.findIndex(m => m.id === msgId)
      onSetMessages(prev => prev.slice(0, msgIndex))
    }
  }, [messages, onSetMessages])

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0F172A]">
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onRegenerate={handleRegenerate}
        onEditMessage={handleEditMessage}
      />
      <InputBar onSendMessage={onSendMessage} isStreaming={isStreaming} />
    </div>
  )
}
