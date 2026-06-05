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
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="msg-empty">
        <div className="text-center">
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>💬</div>
          <div>Ask Pi anything to get started</div>
        </div>
      </div>
    )
  }

  return (
    <div className="msgs">
      {messages.map(msg => (
        <MessageRow
          key={msg.id}
          message={msg}
          onRegenerate={!isStreaming && msg.role === 'assistant' ? () => onRegenerate?.(msg.id) : undefined}
          onEdit={msg.role === 'user' ? () => onEditMessage?.(msg.id) : undefined}
        />
      ))}
      {isStreaming && (
        <div className="msg-stream">
          <span className="stream-dot" />
          Pi is thinking...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
