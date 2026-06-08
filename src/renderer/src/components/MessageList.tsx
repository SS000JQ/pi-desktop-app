import { useCallback, useEffect, useRef, useState } from 'react'
import MessageRow from './MessageRow'
import type { Message } from '../types/chat'

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
  onRegenerate?: (msgId: string) => void
  onEditMessage?: (msgId: string) => void
}

export default function MessageList({ messages, isStreaming, onRegenerate, onEditMessage }: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isUserReviewing, setIsUserReviewing] = useState(false)
  const [unreadUpdateCount, setUnreadUpdateCount] = useState(0)
  const wasAtBottomRef = useRef(true)
  const previousSignatureRef = useRef('')

  const isNearBottom = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return true
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 96
  }, [])

  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom()
    wasAtBottomRef.current = nearBottom
    setIsUserReviewing(!nearBottom)
    if (nearBottom) {
      setUnreadUpdateCount(0)
    }
  }, [isNearBottom])

  const jumpToLatest = useCallback(() => {
    wasAtBottomRef.current = true
    setIsUserReviewing(false)
    setUnreadUpdateCount(0)
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'auto' })
    }
  }, [])

  useEffect(() => {
    const signature = `${messages.length}:${messages[messages.length - 1]?.id || ''}:${messages[messages.length - 1]?.content?.length || 0}:${isStreaming ? 'streaming' : 'idle'}`
    const changed = previousSignatureRef.current && previousSignatureRef.current !== signature
    previousSignatureRef.current = signature

    if (wasAtBottomRef.current && typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'auto' })
      return
    }

    if (changed && !wasAtBottomRef.current) {
      setIsUserReviewing(true)
      setUnreadUpdateCount((count) => count + 1)
    }
  }, [isStreaming, messages])

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
    <div className="msgs" ref={scrollerRef} onScroll={handleScroll}>
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
      {isUserReviewing && unreadUpdateCount > 0 && (
        <button type="button" className="jump-latest" onClick={jumpToLatest}>
          New output · Jump to latest
        </button>
      )}
    </div>
  )
}
