import ToolCallCard from './ToolCallCard'
import type { Message } from '../types/chat'

interface MessageRowProps {
  message: Message
}

export default function MessageRow({ message }: MessageRowProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end self-end' : 'items-start'} max-w-[85%]`}>
      <div className={`text-[10px] mb-0.5 ${isUser ? 'text-muted' : 'text-success'}`}>
        {isUser ? 'You' : 'Pi'}
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
    </div>
  )
}
