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
    <div className={`flex flex-col ${isUser ? 'items-end self-end' : 'items-start'} max-w-[85%]`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-[10px] ${isUser ? 'text-muted' : 'text-success'}`}>
          {isUser ? 'You' : 'Pi'}
        </span>
        {isUser && onEdit && (
          <button onClick={onEdit} className="text-[9px] text-dim hover:text-muted">edit</button>
        )}
      </div>
      <div className={`px-3 py-2 rounded-lg leading-relaxed text-sm ${
        isUser
          ? 'bg-surface text-[#F1F5F9] rounded-br-sm'
          : 'bg-surface text-[#E2E8F0] rounded-bl-sm'
      }`}>
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.toolCalls?.map(tc => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
      </div>
      {!isUser && onRegenerate && (
        <button onClick={onRegenerate} className="text-[10px] text-dim hover:text-muted mt-0.5 px-1">
          ⟳ Regenerate
        </button>
      )}
    </div>
  )
}
