import ToolCallCard from './ToolCallCard'
import type { Message } from '../types/chat'

interface MessageRowProps {
  message: Message
  onRegenerate?: () => void
  onEdit?: () => void
}

export default function MessageRow({ message, onRegenerate, onEdit }: MessageRowProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`msg ${isUser ? 'right' : 'left'}`}>
      <div className="ml">
        <span style={isUser ? { color: 'rgba(255,255,255,0.15)' } : { color: 'rgba(48,209,88,0.5)' }}>
          {isUser ? 'You' : 'Pi'}
        </span>
        {isUser && onEdit && (
          <button onClick={onEdit} className="mb-actions" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.12)', background: 'none', border: 'none', cursor: 'pointer', gap: '2px' }}>
            edit
          </button>
        )}
      </div>
      <div className={`mb ${isUser ? 'right' : 'left'}`}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>

        {message.toolCalls?.map(tc => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
      </div>
      {!isUser && onRegenerate && (
        <div className="mb-actions" style={{ marginTop: '6px' }}>
          <button onClick={onRegenerate}>⟳ Regenerate</button>
        </div>
      )}
    </div>
  )
}
