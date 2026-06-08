import type { ToolCall } from '../types/chat'

interface ToolCallCardProps {
  toolCall: ToolCall
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const doneClass = toolCall.status === 'done' ? 'done' : ''
  const argsPreview = compactArgs(toolCall.args)
  const hasLongArgs = argsPreview !== toolCall.args

  const indicator = toolCall.status === 'done' ? (
    <><span className="dot g" /> Done</>
  ) : toolCall.status === 'running' ? (
    <><span className="dot b" /> Running...</>
  ) : (
    <><span className="dot r" /> Error</>
  )

  return (
    <div className={`tc ${doneClass}`}>
      <div>
        <span className="tcn">{toolCall.name}</span>{' '}
        <span className="tcs" title={hasLongArgs ? toolCall.args : undefined}>({argsPreview})</span>
      </div>
      {hasLongArgs && (
        <details className="tool-args-details">
          <summary>details</summary>
          <pre>{toolCall.args}</pre>
        </details>
      )}
      <div className="tcs" style={{ marginTop: '2px' }}>
        {indicator} {toolCall.duration && <>· {toolCall.duration}</>}
      </div>
    </div>
  )
}

function compactArgs(args: string): string {
  const singleLine = args.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= 96) return singleLine
  return `${singleLine.slice(0, 93)}...`
}
