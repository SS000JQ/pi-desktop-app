import { useEffect, useState } from 'react'
import type { RuntimeStatus } from '../types/chat'

interface ChatRuntimeStatusBarProps {
  status: RuntimeStatus | null
}

function formatElapsed(startedAt?: number): string {
  if (!startedAt) return '0s'
  const elapsedMs = Math.max(0, Date.now() - startedAt)
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export default function ChatRuntimeStatusBar({ status }: ChatRuntimeStatusBarProps) {
  const [elapsedLabel, setElapsedLabel] = useState(() => formatElapsed(status?.startedAt))

  useEffect(() => {
    setElapsedLabel(formatElapsed(status?.startedAt))
    if (!status?.startedAt) return

    const timer = window.setInterval(() => {
      setElapsedLabel(formatElapsed(status.startedAt))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [status?.startedAt])

  if (!status || status.status === 'idle') {
    return null
  }

  const toneClass =
    status.status === 'failed'
      ? 'runtime-status failed'
      : status.isWaitingForUser
        ? 'runtime-status waiting'
        : status.isStalled
          ? 'runtime-status stalled'
          : status.status === 'completed'
            ? 'runtime-status completed'
            : 'runtime-status active'

  const detail = status.errorSummary || status.resultSummary || status.lastAction

  return (
    <div className={toneClass} role="status" aria-live="polite">
      <div className="runtime-status-row">
        <div className="runtime-status-main">
          <span className="runtime-status-dot" />
          <span className="runtime-status-label">{status.statusLabel}</span>
          <span className="runtime-status-time">{elapsedLabel}</span>
        </div>
        <div className="runtime-status-meta">
          {status.isWaitingForUser && <span className="runtime-status-chip">Needs confirmation</span>}
          {status.isStalled && !status.isWaitingForUser && <span className="runtime-status-chip">Still running</span>}
        </div>
      </div>
      {detail && (
        <div className="runtime-status-detail" title={detail}>
          {detail}
        </div>
      )}
      {status.sessionPath && (
        <div className="runtime-status-context" title={status.sessionPath}>
          {status.sessionPath}
        </div>
      )}
    </div>
  )
}
