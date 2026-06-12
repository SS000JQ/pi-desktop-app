import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ToolCallCard from './ToolCallCard'
import type { Message, MessagePart, ToolCall } from '../types/chat'

interface MessageRowProps {
  message: Message
  onRegenerate?: () => void
  onEdit?: () => void
}

export default function MessageRow({ message, onRegenerate, onEdit }: MessageRowProps) {
  const isUser = message.role === 'user'
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({})
  const parts = message.parts?.length ? message.parts : undefined
  const toolCalls = message.toolCalls || []
  const hasToolCallParts = Boolean(parts?.some((part) => part.type === 'toolCall'))
  const displayParts = parts && !hasToolCallParts && toolCalls.length > 0
    ? insertLegacyToolCallParts(parts, toolCalls)
    : parts

  return (
    <div className={`msg ${isUser ? 'right' : 'left'}`}>
      <div className="ml">
        <span className={isUser ? 'msg-role user' : 'msg-role assistant'}>
          {isUser ? 'You' : 'Pi'}
        </span>
        {isUser && onEdit && (
          <button
            onClick={onEdit}
            className="msg-inline-edit"
          >
            edit
          </button>
        )}
      </div>
      <div className={`mb ${isUser ? 'right' : 'left'}`}>
        {displayParts ? (
          <div className="msg-parts">
            {displayParts.map((part, index) => (
              <MessagePartBlock
                key={`${part.type}-${part.toolCall?.id || index}`}
                part={part}
                expanded={Boolean(expandedThinking[index])}
                onToggle={() => setExpandedThinking((previous) => ({ ...previous, [index]: !previous[index] }))}
              />
            ))}
          </div>
        ) : (
          <>
            {!hasToolCallParts ? renderProcessTimeline(toolCalls, message.anchors?.toolSummary) : null}
            {message.content ? (
              isUser ? <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div> : <AnswerCard text={message.content} />
            ) : null}
          </>
        )}

        {!isUser && !message.isStreaming && message.content && message.anchors?.finalAnswer && (
          <div className="msg-final-actions" id={message.anchors?.finalAnswer}>
            <button type="button" onClick={() => scrollAnchor(message.anchors?.finalAnswer)}>Final answer</button>
            {message.toolCalls?.length ? <button type="button" onClick={() => scrollAnchor(message.anchors?.toolSummary)}>Tool summary</button> : null}
            <button type="button" onClick={() => void navigator.clipboard?.writeText(message.content)}>Copy answer</button>
          </div>
        )}
      </div>
      {!isUser && onRegenerate && (
        <div className="mb-actions" style={{ marginTop: '6px' }}>
          <button onClick={onRegenerate}>Regenerate</button>
        </div>
      )}
    </div>
  )
}

function insertLegacyToolCallParts(parts: MessagePart[], toolCalls: ToolCall[]): MessagePart[] {
  const firstAnswerIndex = parts.findIndex((part) => part.type !== 'thinking')
  const insertAt = firstAnswerIndex >= 0 ? firstAnswerIndex : parts.length
  const toolParts = toolCalls.map((toolCall) => ({
    type: 'toolCall' as const,
    text: '',
    toolCall,
  }))
  return [
    ...parts.slice(0, insertAt),
    ...toolParts,
    ...parts.slice(insertAt),
  ]
}

function MessagePartBlock({
  part,
  expanded,
  onToggle,
}: {
  part: MessagePart
  expanded: boolean
  onToggle: () => void
}) {
  if (part.type === 'thinking') {
    const isCollapsed = part.collapsed !== false && !expanded
    const statusLabel = getThinkingStatusLabel(part)
    const preview = part.state === 'streaming' ? getThinkingPreview(part.text) : ''
    return (
      <div className={`process-card thinking-card thinking-part ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
        <div className="thinking-header">
          <span>{statusLabel}</span>
          <button type="button" className="thinking-toggle" onClick={onToggle}>
            {isCollapsed ? 'Show thinking' : 'Close thinking'}
          </button>
        </div>
        {isCollapsed && preview ? <div className="thinking-preview">{preview}</div> : null}
        {!isCollapsed && <div className="thinking-text">{part.text}</div>}
      </div>
    )
  }

  if (part.type === 'toolCall') {
    return part.toolCall ? <ToolCallCard toolCall={part.toolCall} /> : null
  }

  if (part.type === 'toolResult') {
    return (
      <div className="process-card tool-result-part">
        <div className="part-title">{part.title || 'Tool result'}</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{part.text}</div>
      </div>
    )
  }

  if (part.type === 'customSummary') {
    return (
      <div className="process-card custom-part">
        {part.title && <div className="part-title">{part.title}</div>}
        <div style={{ whiteSpace: 'pre-wrap' }}>{part.text}</div>
      </div>
    )
  }

  return <AnswerCard text={part.text} />
}

function renderProcessTimeline(toolCalls: ToolCall[], anchorId?: string) {
  if (toolCalls.length === 0) return null
  return (
    <div className="process-timeline" id={anchorId}>
      <div className="process-timeline-label">Process</div>
      {toolCalls.map((toolCall) => (
        <ToolCallCard key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  )
}

function getThinkingStatusLabel(part: MessagePart): string {
  const title = part.title || 'Thinking'
  if (part.state === 'complete') return `${title} · complete`
  if (part.state === 'streaming') {
    const idleMs = part.updatedAt ? Date.now() - part.updatedAt : 0
    if (idleMs > 12_000) return `${title} · idle ${Math.round(idleMs / 1000)}s`
    return `${title} · updating`
  }
  return title
}

function getThinkingPreview(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const latest = lines[lines.length - 1] || text.trim()
  if (!latest) return ''
  return latest.length > 180 ? `${latest.slice(0, 177)}...` : latest
}

function AnswerCard({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <div className="answer-card">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              rel="noreferrer"
              onClick={(event) => {
                event.preventDefault()
                if (href) void window.piDesktop.shell.openExternal(href)
              }}
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

function scrollAnchor(anchorId?: string) {
  if (!anchorId) return
  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'auto', block: 'nearest' })
}
