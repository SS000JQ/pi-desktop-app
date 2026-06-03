import type { ToolCall } from '../types/chat'

interface ToolCallCardProps {
  toolCall: ToolCall
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const borderColor = {
    running: 'border-l-accent',
    done: 'border-l-success',
    error: 'border-l-error',
  }[toolCall.status]

  const indicator = toolCall.status === 'done' ? (
    <><span className="w-1 h-1 rounded-full bg-success inline-block mr-1" /> Done</>
  ) : toolCall.status === 'running' ? (
    <><span className="w-1 h-1 rounded-full bg-accent inline-block mr-1 animate-pulse" /> Running...</>
  ) : (
    <><span className="w-1 h-1 rounded-full bg-error inline-block mr-1" /> Error</>
  )

  return (
    <div className={`mt-1.5 bg-[#0F172A] border border-border border-l-3 ${borderColor} rounded px-2.5 py-1.5 font-mono text-[10px] leading-relaxed`}>
      <div><span className="text-warning">{toolCall.name}</span> <span className="text-muted">({toolCall.args})</span></div>
      <div className="text-muted text-[10px] mt-0.5">
        {indicator} {toolCall.duration && `· ${toolCall.duration}`}
      </div>
    </div>
  )
}
