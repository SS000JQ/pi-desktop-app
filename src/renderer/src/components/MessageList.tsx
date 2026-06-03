import { useRef, useEffect } from 'react'
import MessageRow from './MessageRow'
import type { Message } from '../types/chat'

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
  onRegenerate?: (msgId: string) => void
  onEditMessage?: (msgId: string) => void
}

export default function MessageList({ messages, isStreaming, onRegenerate, onEditMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        <div className="text-center">
          <div className="text-2xl mb-2">💬</div>
          <div>Ask Pi anything to get started</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.map(msg => (
        <MessageRow
          key={msg.id}
          message={msg}
          onRegenerate={!isStreaming && msg.role === 'assistant' ? () => onRegenerate?.(msg.id) : undefined}
          onEdit={msg.role === 'user' ? () => onEditMessage?.(msg.id) : undefined}
        />
      ))}
      {isStreaming && (
        <div className="flex items-center gap-1.5 text-muted text-xs font-mono ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Pi is thinking...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
