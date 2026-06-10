import { useEffect, useState, type ReactNode } from 'react'
import type { PiResourcesResult, PiSkillResource } from '../types/chat'

interface SkillsProps {
  onClose: () => void
  currentDir?: string
  sessionPath?: string
}

export default function Skills({ onClose, currentDir, sessionPath }: SkillsProps) {
  const [resources, setResources] = useState<PiResourcesResult>({
    skills: [],
    prompts: [],
    extensions: [],
    extensionCommands: [],
    diagnostics: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ packageName: string; name: string; installs?: string; url?: string; description?: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [managerNotice, setManagerNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    void loadPiResources(currentDir, sessionPath)
      .then((nextResources) => {
        if (!active) return
        setResources(nextResources)
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load Pi resources.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [currentDir, sessionPath])

  const handleReload = () => {
    setResources({
      skills: [],
      prompts: [],
      extensions: [],
      extensionCommands: [],
      diagnostics: [],
    })
    setIsLoading(true)
    setError(null)
    void loadPiResources(currentDir, sessionPath)
      .then(setResources)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load Pi resources.')
      })
      .finally(() => setIsLoading(false))
  }

  const handleToggleModelInvocation = async (skill: PiSkillResource) => {
    if (!skill.filePath || !window.piDesktop.skills?.setModelInvocation) return
    const disabled = !skill.disableModelInvocation
    const response = await window.piDesktop.skills.setModelInvocation({
      filePath: skill.filePath,
      disabled,
    })
    if (!response.success) {
      setManagerNotice(response.error || 'Failed to update skill settings.')
      return
    }
    setResources((previous) => ({
      ...previous,
      skills: previous.skills.map((entry) => (
        entry.filePath === skill.filePath
          ? { ...entry, disableModelInvocation: disabled }
          : entry
      )),
    }))
    setManagerNotice(disabled ? 'Skill hidden from model auto-invocation.' : 'Skill can be invoked by the model again.')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !window.piDesktop.skills?.search) return
    setIsSearching(true)
    setManagerNotice(null)
    const response = await window.piDesktop.skills.search({ query: searchQuery.trim(), limit: 20 })
    if (response.success && Array.isArray(response.data)) {
      setSearchResults(response.data)
    } else {
      setSearchResults([])
      setManagerNotice(response.error || 'Skill search failed.')
    }
    setIsSearching(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          background: '#1a1919',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4,
          width: 460,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Pi Resources</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleReload}
              disabled={isLoading}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: 12,
                color: 'rgba(255,255,255,0.32)',
                cursor: isLoading ? 'default' : 'pointer',
                padding: '3px 8px',
              }}
            >
              {isLoading ? 'Checking...' : 'Re-check'}
            </button>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'none',
                fontFamily: 'inherit',
                fontSize: 13,
                color: 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>
          This panel reports the resources discovered through Pi's resource loader, so it should match what the runtime can load.
          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.16)', wordBreak: 'break-all' }}>
            Workspace: {currentDir || '(runtime default)'}
          </div>
        </div>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSearch()
                }
              }}
              placeholder="Search skills"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4,
                color: 'rgba(255,255,255,0.58)',
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '6px 8px',
              }}
            />
            <button
              onClick={() => void handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 4,
                color: 'rgba(255,255,255,0.38)',
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '6px 10px',
                cursor: isSearching ? 'default' : 'pointer',
              }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {managerNotice && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{managerNotice}</div>
          )}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {searchResults.map((result) => (
                <div key={result.packageName} style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, padding: 8 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{result.packageName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 3 }}>
                    {[result.description, result.installs].filter(Boolean).join(' · ') || 'Skill package'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {isLoading && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
              Loading Pi resources...
            </div>
          )}
          {error && (
            <div style={{ margin: '8px 14px', padding: 10, border: '1px solid rgba(255,69,58,0.18)', borderRadius: 4, fontSize: 12, color: 'rgba(255,160,150,0.78)', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
          <ResourceSection title="Skills" empty="No skills discovered.">
            {resources.skills.map((skill) => (
              <ResourceRow
                key={skill.name}
                label={`/skill:${skill.name}`}
                value={skill.description || 'No description provided'}
                source={skill.source}
                status={skill.status}
                scope={skill.scope}
                actionLabel={skill.disableModelInvocation ? 'Allow model use' : 'Hide from model'}
                onAction={skill.filePath ? () => void handleToggleModelInvocation(skill) : undefined}
              />
            ))}
          </ResourceSection>
          <ResourceSection title="Prompt Templates" empty="No prompt templates discovered.">
            {resources.prompts.map((prompt) => (
              <ResourceRow
                key={prompt.name}
                label={`/${prompt.name}`}
                value={`${prompt.argumentHint ? `${prompt.argumentHint} ` : ''}${prompt.description || 'No description provided'}`}
                source={prompt.source}
                status="active"
              />
            ))}
          </ResourceSection>
          <ResourceSection title="Extensions" empty="No extensions discovered.">
            {resources.extensions.map((extension) => (
              <ResourceRow
                key={extension.name}
                label={extension.name}
                value="Loaded extension resource"
                source={extension.source}
                status={extension.status}
              />
            ))}
            {resources.extensionCommands.map((command) => (
              <ResourceRow
                key={`command:${command.name}`}
                label={`/${command.name}`}
                value={command.description || 'Extension command'}
                source={command.source}
                status="active"
              />
            ))}
          </ResourceSection>
          <ResourceSection title="Diagnostics" empty="No diagnostics.">
            {resources.diagnostics.map((diagnostic, index) => (
              <ResourceRow
                key={`${diagnostic}-${index}`}
                label="Diagnostic"
                value={diagnostic}
                source="Pi resource loader"
                status="inactive"
              />
            ))}
          </ResourceSection>
        </div>
      </div>
    </div>
  )
}

async function loadPiResources(currentDir?: string, sessionPath?: string): Promise<PiResourcesResult> {
  const getPiResources = window.piDesktop.desktop.getPiResources
  if (typeof getPiResources === 'function') {
    const response = await getPiResources(currentDir || undefined, sessionPath || undefined)
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to load Pi resources.')
    }
    return response.data as PiResourcesResult
  }

  const legacySummary = await window.piDesktop.desktop.getStateSummary()
  if (!legacySummary.success || !legacySummary.data) {
    throw new Error(legacySummary.error || 'Pi resource API is not available in this build.')
  }

  const legacySkills = Array.isArray(legacySummary.data.skills) ? legacySummary.data.skills : []
  const diagnostics = legacySkills
    .filter((skill) => skill.id === 'skills-unavailable')
    .map((skill) => skill.value)
    .filter(Boolean)

  return {
    skills: legacySkills
      .filter((skill) => skill.id !== 'skills-unavailable')
      .map((skill) => ({
        name: skill.label || skill.id,
        description: skill.value || 'Discovered by legacy desktop summary',
        source: skill.source || 'Desktop state summary',
        filePath: skill.source || '',
        baseDir: '',
        scope: 'other',
        disableModelInvocation: false,
        status: skill.status === 'active' ? 'active' : 'inactive',
      })),
    prompts: [],
    extensions: [],
    extensionCommands: [],
    diagnostics,
  }
}

function ResourceSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items
  return (
    <section style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ padding: '8px 14px 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.18)' }}>
        {title}
      </div>
      {isEmpty ? (
        <div style={{ padding: '8px 14px 12px', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          {empty}
        </div>
      ) : (
        items
      )}
    </section>
  )
}

function ResourceRow({
  label,
  value,
  source,
  status,
  scope,
  actionLabel,
  onAction,
}: {
  label: string
  value: string
  source: string
  status: 'active' | 'inactive' | 'error'
  scope?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 14px', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <span
        style={{
          marginTop: 5,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: status === 'active' ? 'rgba(48,209,88,0.7)' : status === 'error' ? 'rgba(255,69,58,0.7)' : 'rgba(255,204,0,0.7)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</div>
          {scope ? (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.24)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 999, padding: '1px 6px' }}>
              {scope}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.26)', marginTop: 4, lineHeight: 1.5 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', marginTop: 4, wordBreak: 'break-all' }}>
          {source}
        </div>
        {actionLabel && onAction ? (
          <button
            onClick={onAction}
            style={{
              marginTop: 6,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
              color: 'rgba(255,255,255,0.32)',
              fontFamily: 'inherit',
              fontSize: 11,
              padding: '4px 7px',
              cursor: 'pointer',
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
