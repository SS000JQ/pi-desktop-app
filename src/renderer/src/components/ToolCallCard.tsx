import { useEffect, useState } from 'react'
import type { ToolCall } from '../types/chat'

interface ToolCallCardProps {
  toolCall: ToolCall
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const stateClass = toolCall.status === 'running'
    ? 'running'
    : toolCall.status === 'error'
      ? 'error'
      : 'done'
  const argsPreview = compactArgs(toolCall.args)
  const hasLongArgs = argsPreview !== toolCall.args

  useEffect(() => {
    if (toolCall.status !== 'running' || toolCall.duration) {
      setElapsedSeconds(0)
      return undefined
    }

    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [toolCall.duration, toolCall.id, toolCall.status])

  const statusText = toolCall.status === 'done'
    ? 'done'
    : toolCall.status === 'running'
      ? 'running'
      : 'error'
  const durationText = toolCall.duration || (elapsedSeconds > 0 ? `${elapsedSeconds}s` : '')

  return (
    <div className={`process-card tool-card tc ${stateClass}`}>
      <div className="tc-main">
        <span className="tcn">{toolCall.name}</span>
        <span className="tcs" title={hasLongArgs ? toolCall.args : undefined}>{argsPreview}</span>
        <span className="tc-status">
          <span className={`dot ${toolCall.status === 'done' ? 'g' : toolCall.status === 'running' ? 'b' : 'r'}`} />
          {statusText}
          {durationText && <span className="tc-duration">{durationText}</span>}
        </span>
      </div>
      {hasLongArgs && (
        <details className="tool-args-details">
          <summary>details</summary>
          <pre>{toolCall.args}</pre>
        </details>
      )}
    </div>
  )
}

function compactArgs(args: string): string {
  const singleLine = args.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= 120) return singleLine
  return `${singleLine.slice(0, 117)}...`
}
