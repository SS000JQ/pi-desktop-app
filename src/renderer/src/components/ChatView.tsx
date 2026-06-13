import { useCallback } from 'react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import ChatRuntimeStatusBar from './ChatRuntimeStatusBar'
import type { ChatAttachment, Message, RuntimeStatus, SlashCommand } from '../types/chat'

interface ChatViewProps {
  messages: Message[]
  onSendMessage: (text: string, metadata?: { displayText?: string; attachments?: ChatAttachment[] }) => void
  onCommand?: (command: string) => void
  isStreaming: boolean
  isInputDisabled?: boolean
  runtimeStatus: RuntimeStatus | null
  slashCommands?: SlashCommand[]
  onSetMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  currentWorkspace?: string
  onWorkspaceRefresh?: () => void
  sessionKey?: string | null
}

export default function ChatView({
  messages,
  onSendMessage,
  onCommand,
  isStreaming,
  isInputDisabled,
  runtimeStatus,
  slashCommands,
  onSetMessages,
  currentWorkspace,
  onWorkspaceRefresh,
  sessionKey,
}: ChatViewProps) {
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
      <InputBar
        onSendMessage={onSendMessage}
        onCommand={onCommand}
        isStreaming={isInputDisabled ?? isStreaming}
        slashCommands={slashCommands}
        currentWorkspace={currentWorkspace}
        onWorkspaceRefresh={onWorkspaceRefresh}
        sessionKey={sessionKey}
      />
    </div>
  )
}
