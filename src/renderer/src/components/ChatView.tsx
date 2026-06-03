import MessageList from './MessageList'
import InputBar from './InputBar'
import type { Message } from '../types/chat'

interface ChatViewProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  isStreaming: boolean
}

export default function ChatView({ messages, onSendMessage, isStreaming }: ChatViewProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0F172A]">
      <MessageList messages={messages} isStreaming={isStreaming} />
      <InputBar onSendMessage={onSendMessage} isStreaming={isStreaming} />
    </div>
  )
}
