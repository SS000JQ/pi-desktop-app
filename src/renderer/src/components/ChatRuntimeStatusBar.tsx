import { useEffect, useState } from 'react'
import type { RuntimeStatus } from '../types/chat'

interface ChatRuntimeStatusBarProps {
  status: RuntimeStatus | null
}

function formatElapsed(status: RuntimeStatus | null): string {
  if (!status?.startedAt) return '0s'
  if ((status.status === 'completed' || status.status === 'failed') && typeof status.elapsedMs === 'number') {
    const totalSeconds = Math.floor(Math.max(0, status.elapsedMs) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  }
  const startedAt = status.startedAt
  if (!startedAt) return '0s'
  const elapsedMs = Math.max(0, Date.now() - startedAt)
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function formatRecentUpdate(lastEventAt?: number): string {
  if (!lastEventAt) return 'No recent updates'
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - lastEventAt) / 1000))
  if (deltaSeconds === 0) return 'Updated just now'
  if (deltaSeconds === 1) return 'Updated 1s ago'
  return `Updated ${deltaSeconds}s ago`
}

export default function ChatRuntimeStatusBar({ status }: ChatRuntimeStatusBarProps) {
  const [elapsedLabel, setElapsedLabel] = useState(() => formatElapsed(status))
  const [recentUpdateLabel, setRecentUpdateLabel] = useState(() => formatRecentUpdate(status?.lastEventAt))
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)
  const [dismissedStatusKey, setDismissedStatusKey] = useState<string | null>(null)
  const statusKey = status?.runId || `${status?.startedAt || 0}:${status?.status || 'idle'}:${status?.sessionPath || ''}`

  useEffect(() => {
    setElapsedLabel(formatElapsed(status))
    setRecentUpdateLabel(formatRecentUpdate(status?.lastEventAt))
    if (!status?.startedAt) return
    if (status.status === 'completed' || status.status === 'failed') return

    const timer = window.setInterval(() => {
      setElapsedLabel(formatElapsed(status))
      setRecentUpdateLabel(formatRecentUpdate(status.lastEventAt))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    setIsThinkingExpanded(false)
  }, [status?.runId])

  if (!status || status.status === 'idle') {
    return null
  }

  if (dismissedStatusKey === statusKey && !status.isWaitingForUser && status.status !== 'failed') {
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
  const thinkingPreview = status.thinkingPreview?.trim()
  const hasThinkingPreview = Boolean(status.hasThinking && thinkingPreview)
  const isThinkingLive =
    status.status !== 'completed' &&
    status.status !== 'failed' &&
    Boolean(status.thinkingUpdatedAt && Date.now() - status.thinkingUpdatedAt < 4000)

  return (
    <div className={toneClass} role="status" aria-live="polite">
      <div className="runtime-status-row">
        <div className="runtime-status-main">
          <span className="runtime-status-dot" />
          <span className="runtime-status-label">{status.statusLabel}</span>
          <span className="runtime-status-time">{elapsedLabel}</span>
        </div>
        <div className="runtime-status-actions">
          <div className="runtime-status-meta">
            {status.isWaitingForUser && <span className="runtime-status-chip">Needs confirmation</span>}
            {status.isStalled && !status.isWaitingForUser && <span className="runtime-status-chip">Still running</span>}
            {status.activeToolName && (
              <span className="runtime-status-chip">
                {status.activeToolState === 'running' ? 'Tool' : 'Last tool'}: {status.activeToolName}
              </span>
            )}
            <span className="runtime-status-chip">{recentUpdateLabel}</span>
          </div>
          <button
            type="button"
            className="runtime-status-dismiss"
            onClick={() => setDismissedStatusKey(statusKey)}
            aria-label="Dismiss runtime status"
            title="Dismiss runtime status"
          >
            x
          </button>
        </div>
      </div>
      {detail && (
        <div className="runtime-status-detail" title={detail}>
          {detail}
        </div>
      )}
      {status.lastProgressMessage && status.lastProgressMessage !== detail && (
        <div className="runtime-status-progress" title={status.lastProgressMessage}>
          {status.lastProgressMessage}
        </div>
      )}
      {hasThinkingPreview && (
        <div className="runtime-thinking-panel">
          <div className="runtime-thinking-header">
            <div className="runtime-thinking-meta">
              <span className="runtime-status-chip">Thinking live</span>
              <span className="runtime-thinking-state">{isThinkingLive ? 'Live' : 'Captured'}</span>
            </div>
            <button
              type="button"
              className="runtime-thinking-toggle"
              onClick={() => setIsThinkingExpanded((value) => !value)}
              aria-label={isThinkingExpanded ? 'Collapse live thinking' : 'Expand live thinking'}
            >
              {isThinkingExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div className={isThinkingExpanded ? 'runtime-thinking-preview expanded' : 'runtime-thinking-preview'}>
            {thinkingPreview}
          </div>
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
