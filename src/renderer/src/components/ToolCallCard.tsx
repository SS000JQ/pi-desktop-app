import type { ToolCall } from '../types/chat'

interface ToolCallCardProps {
  toolCall: ToolCall
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const doneClass = toolCall.status === 'done' ? 'done' : ''

  const indicator = toolCall.status === 'done' ? (
    <><span className="dot g" /> Done</>
  ) : toolCall.status === 'running' ? (
    <><span className="dot b" /> Running...</>
  ) : (
    <><span className="dot r" /> Error</>
  )

  return (
    <div className={`tc ${doneClass}`}>
      <div><span className="tcn">{toolCall.name}</span> <span className="tcs">({toolCall.args})</span></div>
      <div className="tcs" style={{ marginTop: '2px' }}>
        {indicator} {toolCall.duration && <>· {toolCall.duration}</>}
      </div>
    </div>
  )
}
