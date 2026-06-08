import { useMemo, useState } from 'react'
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
  const [showCompletedTools, setShowCompletedTools] = useState(false)

  const completedToolSummary = useMemo(() => summarizeCompletedTools(message.toolCalls || []), [message.toolCalls])
  const activeToolCalls = (message.toolCalls || []).filter((toolCall) => toolCall.status !== 'done')
  const completedToolCalls = (message.toolCalls || []).filter((toolCall) => toolCall.status === 'done')
  const shouldSummarizeCompletedTools = completedToolCalls.length > 1 || activeToolCalls.length > 0
  const parts = message.parts?.length ? message.parts : undefined

  return (
    <div className={`msg ${isUser ? 'right' : 'left'}`}>
      <div className="ml">
        <span style={isUser ? { color: 'rgba(255,255,255,0.15)' } : { color: 'rgba(48,209,88,0.5)' }}>
          {isUser ? 'You' : 'Pi'}
        </span>
        {isUser && onEdit && (
          <button
            onClick={onEdit}
            className="mb-actions"
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.12)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              gap: '2px',
            }}
          >
            edit
          </button>
        )}
      </div>
      <div className={`mb ${isUser ? 'right' : 'left'}`}>
        {parts ? (
          <div className="msg-parts">
            {parts.map((part, index) => (
              <MessagePartBlock
                key={`${part.type}-${index}`}
                part={part}
                expanded={Boolean(expandedThinking[index])}
                onToggle={() => setExpandedThinking((previous) => ({ ...previous, [index]: !previous[index] }))}
              />
            ))}
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        )}

        {completedToolSummary && shouldSummarizeCompletedTools && (
          <div className="tool-summary" id={message.anchors?.toolSummary}>
            <button type="button" className="tool-summary-toggle" onClick={() => setShowCompletedTools((state) => !state)}>
              {completedToolSummary}
            </button>
            {showCompletedTools && completedToolCalls.map((toolCall) => (
              <ToolCallCard key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {!shouldSummarizeCompletedTools && completedToolCalls.map((toolCall) => (
          <ToolCallCard key={toolCall.id} toolCall={toolCall} />
        ))}

        {activeToolCalls.map((toolCall) => (
          <ToolCallCard key={toolCall.id} toolCall={toolCall} />
        ))}

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
    return (
      <div className={`thinking-part ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
        <div className="thinking-header">
          <span>{statusLabel}</span>
          <button type="button" className="thinking-toggle" onClick={onToggle}>
            {isCollapsed ? 'Show thinking' : 'Close thinking'}
          </button>
        </div>
        {!isCollapsed && <div className="thinking-text">{part.text}</div>}
      </div>
    )
  }

  if (part.type === 'toolResult') {
    return (
      <div className="tool-result-part">
        <div className="part-title">{part.title || 'Tool result'}</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{part.text}</div>
      </div>
    )
  }

  if (part.type === 'customSummary') {
    return (
      <div className="custom-part">
        {part.title && <div className="part-title">{part.title}</div>}
        <div style={{ whiteSpace: 'pre-wrap' }}>{part.text}</div>
      </div>
    )
  }

  return <div style={{ whiteSpace: 'pre-wrap' }}>{part.text}</div>
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

function summarizeCompletedTools(toolCalls: ToolCall[]): string {
  const completed = toolCalls.filter((toolCall) => toolCall.status === 'done')
  if (completed.length === 0) return ''
  const counts = new Map<string, number>()
  completed.forEach((toolCall) => counts.set(toolCall.name, (counts.get(toolCall.name) || 0) + 1))
  return Array.from(counts.entries())
    .map(([name, count]) => `${name} ${count}`)
    .join(' · ')
}

function scrollAnchor(anchorId?: string) {
  if (!anchorId) return
  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'auto', block: 'nearest' })
}
