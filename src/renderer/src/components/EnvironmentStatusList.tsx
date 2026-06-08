import type { EnvironmentCheckResult, EnvironmentStatus } from '../types/chat'

interface EnvironmentStatusListProps {
  result: EnvironmentCheckResult | null
  loading?: boolean
  compact?: boolean
  onRefresh: () => void
}

const STATUS_LABELS: Record<EnvironmentStatus, string> = {
  ok: 'OK',
  warning: 'Check',
  missing: 'Missing',
  error: 'Error',
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  }
}

export default function EnvironmentStatusList({ result, loading = false, compact = false, onRefresh }: EnvironmentStatusListProps) {
  return (
    <div className={compact ? 'env-card compact' : 'env-card'}>
      <div className="env-card-header">
        <div>
          <div className="env-title">Environment</div>
          <div className="env-subtitle">
            {result ? `Overall: ${STATUS_LABELS[result.overallStatus]}` : 'Check Pi Desktop readiness.'}
          </div>
        </div>
        <button type="button" className="bs" onClick={onRefresh} disabled={loading}>
          {loading ? 'Checking...' : 'Re-check'}
        </button>
      </div>

      <div className="env-list">
        {result?.items.map((item) => (
          <div key={item.id} className={`env-row ${item.status}`}>
            <div className="env-row-main">
              <span className={`env-dot ${item.status}`} />
              <div>
                <div className="env-row-title">{item.label}</div>
                <div className="env-row-summary">{item.summary}</div>
                {item.detail && <div className="env-row-detail">{item.detail}</div>}
              </div>
            </div>
            {item.actionKind === 'copy_command' && item.actionValue ? (
              <div className="env-actions">
                <button type="button" className="bd" onClick={() => { void copyText(item.actionValue || '') }}>
                  {item.actionLabel || 'Copy'}
                </button>
                {item.detail?.startsWith('http') && (
                  <button type="button" className="bd" onClick={() => window.open(item.detail, '_blank', 'noopener,noreferrer')}>
                    Open Git
                  </button>
                )}
              </div>
            ) : item.actionKind === 'open_url' && item.actionValue ? (
              <button type="button" className="bd" onClick={() => window.open(item.actionValue, '_blank', 'noopener,noreferrer')}>
                {item.actionLabel || 'Open'}
              </button>
            ) : null}
          </div>
        ))}
        {!result && !loading && <div className="env-empty">Environment status has not been loaded yet.</div>}
      </div>
    </div>
  )
}
