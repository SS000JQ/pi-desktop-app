import { useEffect, useState, type ReactNode } from 'react'
import type { PiResourcesResult, PiSkillResource } from '../types/chat'

interface SkillsProps {
  onClose: () => void
  currentDir?: string
  sessionPath?: string
}

interface SkillSettingsState {
  additionalSkillPaths: string[]
  disabledSkillPaths: string[]
  suggestedSkillPaths: string[]
}

const EMPTY_RESOURCES: PiResourcesResult = {
  skills: [],
  prompts: [],
  extensions: [],
  extensionCommands: [],
  diagnostics: [],
}

export default function Skills({ onClose, currentDir, sessionPath }: SkillsProps) {
  const [resources, setResources] = useState<PiResourcesResult>(EMPTY_RESOURCES)
  const [skillSettings, setSkillSettings] = useState<SkillSettingsState>({
    additionalSkillPaths: [],
    disabledSkillPaths: [],
    suggestedSkillPaths: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ packageName: string; name: string; installs?: string; url?: string; description?: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [installScope, setInstallScope] = useState<'global' | 'project'>('global')
  const [installingPackage, setInstallingPackage] = useState<string | null>(null)
  const [installedPackages, setInstalledPackages] = useState<Set<string>>(() => new Set())
  const [managerNotice, setManagerNotice] = useState<string | null>(null)
  const [expandedSkillPaths, setExpandedSkillPaths] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    void loadPanelState(currentDir, sessionPath)
      .then(({ resources: nextResources, settings }) => {
        if (!active) return
        setResources(nextResources)
        setSkillSettings(settings)
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
    setResources(EMPTY_RESOURCES)
    setIsLoading(true)
    setError(null)
    void loadPanelState(currentDir, sessionPath)
      .then(({ resources: nextResources, settings }) => {
        setResources(nextResources)
        setSkillSettings(settings)
      })
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
    const runtimeNotice = await reloadRuntimeResources(sessionPath)
    setManagerNotice(`${disabled ? 'Skill hidden from model auto-invocation.' : 'Skill can be invoked by the model again.'}${runtimeNotice}`)
  }

  const handleDisableSkill = async (skill: PiSkillResource) => {
    if (!skill.filePath || !window.piDesktop.skills?.setDisabled) return
    const disabled = !skill.disabled
    const response = await window.piDesktop.skills.setDisabled({
      filePath: skill.filePath,
      disabled,
    })
    if (!response.success) {
      setManagerNotice(response.error || 'Failed to update disabled skill list.')
      return
    }

    setResources((previous) => ({
      ...previous,
      skills: disabled
        ? previous.skills.filter((entry) => entry.filePath !== skill.filePath)
        : previous.skills.map((entry) => entry.filePath === skill.filePath ? { ...entry, disabled } : entry),
      disabledSkillPaths: Array.isArray(response.data) ? response.data : previous.disabledSkillPaths,
    }))
    setSkillSettings((previous) => ({
      ...previous,
      disabledSkillPaths: Array.isArray(response.data) ? response.data : previous.disabledSkillPaths,
    }))
    const runtimeNotice = await reloadRuntimeResources(sessionPath)
    setManagerNotice(`${disabled ? 'Skill disabled in Pi Desktop.' : 'Skill enabled again.'}${runtimeNotice}`)
  }

  const handleAddSuggestedPath = async (path: string) => {
    if (!window.piDesktop.skills?.setAdditionalPaths) return
    const existing = resources.additionalSkillPaths || skillSettings.additionalSkillPaths
    const nextPaths = Array.from(new Set([...existing, path]))
    const response = await window.piDesktop.skills.setAdditionalPaths({ paths: nextPaths })
    if (!response.success) {
      setManagerNotice(response.error || 'Failed to update additional skill paths.')
      return
    }

    const additionalSkillPaths = Array.isArray(response.data) ? response.data : nextPaths
    setResources((previous) => ({ ...previous, additionalSkillPaths }))
    setSkillSettings((previous) => ({ ...previous, additionalSkillPaths }))
    const runtimeNotice = await reloadRuntimeResources(sessionPath)
    setManagerNotice(`Additional skill path saved.${runtimeNotice || ' Use Re-check or /reload before the next run.'}`)
  }

  const handleRemoveAdditionalPath = async (path: string) => {
    if (!window.piDesktop.skills?.setAdditionalPaths) return
    const existing = resources.additionalSkillPaths || skillSettings.additionalSkillPaths
    const nextPaths = existing.filter((entry) => entry !== path)
    const response = await window.piDesktop.skills.setAdditionalPaths({ paths: nextPaths })
    if (!response.success) {
      setManagerNotice(response.error || 'Failed to update additional skill paths.')
      return
    }

    const additionalSkillPaths = Array.isArray(response.data) ? response.data : nextPaths
    setResources((previous) => ({ ...previous, additionalSkillPaths }))
    setSkillSettings((previous) => ({ ...previous, additionalSkillPaths }))
    const runtimeNotice = await reloadRuntimeResources(sessionPath)
    setManagerNotice(`Additional skill path removed.${runtimeNotice || ' Use Re-check or /reload before the next run.'}`)
  }

  const handleEnableDisabledPath = async (path: string) => {
    if (!window.piDesktop.skills?.setDisabled) return
    const response = await window.piDesktop.skills.setDisabled({ filePath: path, disabled: false })
    if (!response.success) {
      setManagerNotice(response.error || 'Failed to enable skill.')
      return
    }

    const disabledSkillPaths = Array.isArray(response.data) ? response.data : skillSettings.disabledSkillPaths.filter((entry) => entry !== path)
    setResources((previous) => ({ ...previous, disabledSkillPaths }))
    setSkillSettings((previous) => ({ ...previous, disabledSkillPaths }))
    const runtimeNotice = await reloadRuntimeResources(sessionPath)
    setManagerNotice(`Skill enabled again.${runtimeNotice || ' Use Re-check or /reload to make it visible.'}`)
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

  const handleInstallSkill = async (packageName: string) => {
    if (!window.piDesktop.skills?.install) return
    setInstallingPackage(packageName)
    setManagerNotice(null)

    const response = await window.piDesktop.skills.install({
      packageName,
      scope: installScope,
      cwd: currentDir || undefined,
    })
    if (!response.success) {
      setManagerNotice(response.error || `Failed to install ${packageName}.`)
      setInstallingPackage(null)
      return
    }

    setInstalledPackages((previous) => new Set(previous).add(packageName))
    const runtimeNotice = await reloadRuntimeResources(sessionPath)
    const nextResources = await loadPiResources(currentDir, sessionPath).catch(() => null)
    if (nextResources) setResources(nextResources)
    setManagerNotice(`Installed ${packageName}.${runtimeNotice}`)
    setInstallingPackage(null)
  }

  const toggleSkillExpanded = (skill: PiSkillResource) => {
    const key = skill.filePath || skill.name
    setExpandedSkillPaths((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="skills-modal"
        style={{
          background: 'var(--bg-app)',
          border: '1px solid var(--bd)',
          borderRadius: 4,
          width: 'min(860px, calc(100vw - 32px))',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 18px 46px rgba(0,0,0,0.28)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Pi Resources</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleReload}
              disabled={isLoading}
              style={{
                border: '1px solid var(--card-border)',
                background: 'var(--panel-bg)',
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: 12,
                color: 'var(--text2)',
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
                color: 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
          This panel reports the resources discovered through Pi's resource loader, so it should match what the runtime can load.
          <div style={{ marginTop: 6, color: 'var(--text3)', wordBreak: 'break-all' }}>
            Workspace: {currentDir || '(runtime default)'}
          </div>
        </div>
        <div className="skills-search-panel">
          <div className="skills-search-row">
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
              className="skills-search-input"
            />
            <button
              onClick={() => void handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="skills-search-button"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div className="skills-scope-row">
            <span className="skills-scope-label">Install to</span>
            <div role="group" aria-label="Skill install scope" className="skills-scope-toggle">
              <button
                type="button"
                aria-pressed={installScope === 'global'}
                onClick={() => setInstallScope('global')}
              >
                Global
              </button>
              <button
                type="button"
                aria-pressed={installScope === 'project'}
                onClick={() => setInstallScope('project')}
                disabled={!currentDir}
              >
                Project
              </button>
            </div>
            <span className="skills-install-path">
              {installScope === 'global' ? '~/.pi/agent/skills/' : `${currentDir || '(choose workspace)'}/.pi/agent/skills/`}
            </span>
          </div>
          {managerNotice && (
            <div role="status" className="skills-manager-notice">
              {managerNotice}
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="skills-results">
              {searchResults.map((result) => (
                <div key={result.packageName} className="skills-result-card">
                  <div className="skills-result-body">
                    <div className="skills-result-name">{result.packageName}</div>
                    <div className="skills-result-meta">
                      {[result.description, result.installs].filter(Boolean).join(' - ') || 'Skill package'}
                    </div>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="skills-result-link"
                      >
                        skills.sh
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleInstallSkill(result.packageName)}
                    disabled={installedPackages.has(result.packageName) || installingPackage !== null}
                    className="skills-install-button"
                    data-state={installedPackages.has(result.packageName) ? 'installed' : installingPackage === result.packageName ? 'installing' : 'idle'}
                  >
                    {installedPackages.has(result.packageName)
                      ? 'Installed'
                      : installingPackage === result.packageName
                        ? 'Installing...'
                        : 'Install'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="skills-resources-scroll">
          {isLoading && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>
              Loading Pi resources...
            </div>
          )}
          {error && (
            <div
              style={{
                margin: '8px 14px',
                padding: 10,
                border: '1px solid color-mix(in srgb, #dc2626 28%, var(--bd))',
                background: 'color-mix(in srgb, #dc2626 10%, var(--panel-bg))',
                borderRadius: 8,
                fontSize: 12,
                color: 'color-mix(in srgb, #dc2626 72%, var(--text))',
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--bd)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
            <div>{resources.summary?.totalSkills ?? resources.skills.length} skills discovered</div>
            <div style={{ wordBreak: 'break-all' }}>Agent dir: {resources.summary?.agentDir || '(unknown)'}</div>
            <ScopeSummary counts={resources.summary?.countsByScope} />
          </div>
          <AdditionalSkillPaths
            additionalPaths={resources.additionalSkillPaths || skillSettings.additionalSkillPaths}
            suggestedPaths={skillSettings.suggestedSkillPaths}
            onAdd={(path) => void handleAddSuggestedPath(path)}
            onRemove={(path) => void handleRemoveAdditionalPath(path)}
          />
          <DisabledSkillPaths
            disabledPaths={resources.disabledSkillPaths || skillSettings.disabledSkillPaths}
            onEnable={(path) => void handleEnableDisabledPath(path)}
          />
          <ResourceSection title="Skills" empty="No skills discovered.">
            {groupSkillsBySource(resources.skills).map((group) => (
              <div key={group.label}>
                <div style={{ padding: '8px 14px 2px', fontSize: 11, color: 'var(--text2)' }}>
                  {group.label}
                </div>
                {group.skills.map((skill) => (
                  <ResourceRow
                    key={skill.filePath || skill.name}
                    label={`/skill:${skill.name}`}
                    value={skill.description || 'No description provided'}
                    source={skill.source}
                    status={skill.status}
                    scope={undefined}
                    isExpandable
                    isExpanded={expandedSkillPaths.has(skill.filePath || skill.name)}
                    onToggleExpanded={() => toggleSkillExpanded(skill)}
                    actionLabel={skill.disableModelInvocation ? 'Allow model use' : 'Hide from model'}
                    onAction={skill.filePath ? () => void handleToggleModelInvocation(skill) : undefined}
                    secondaryActionLabel={skill.disabled ? 'Enable skill' : 'Disable skill'}
                    onSecondaryAction={skill.filePath ? () => void handleDisableSkill(skill) : undefined}
                    diagnostics={skill.diagnostics}
                    actionTestId={`skill-actions-${skill.name}`}
                  />
                ))}
              </div>
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
        sourceLabel: 'Other',
        disabled: false,
        disableModelInvocation: false,
        status: skill.status === 'active' ? 'active' : 'inactive',
      })),
    prompts: [],
    extensions: [],
    extensionCommands: [],
    diagnostics,
    summary: {
      cwd: currentDir || null,
      agentDir: null,
      totalSkills: legacySkills.filter((skill) => skill.id !== 'skills-unavailable').length,
      countsByScope: {
        pi_global: 0,
        shared_global: 0,
        project: 0,
        settings: 0,
        package: 0,
        other: legacySkills.filter((skill) => skill.id !== 'skills-unavailable').length,
      },
    },
    additionalSkillPaths: [],
    disabledSkillPaths: [],
  }
}

async function reloadRuntimeResources(sessionPath?: string): Promise<string> {
  if (!sessionPath || !window.piDesktop.piRuntime?.reloadResources) {
    return ' Changes will apply on the next Pi run.'
  }
  const response = await window.piDesktop.piRuntime.reloadResources({ sessionPath })
  return response.success
    ? ' Runtime resources reloaded.'
    : ` Saved, but runtime reload failed: ${response.error || 'runtime is not active yet'}.`
}

async function loadPanelState(currentDir?: string, sessionPath?: string): Promise<{
  resources: PiResourcesResult
  settings: SkillSettingsState
}> {
  const [resources, settings] = await Promise.all([
    loadPiResources(currentDir, sessionPath),
    loadSkillSettings(),
  ])
  return { resources, settings }
}

async function loadSkillSettings(): Promise<SkillSettingsState> {
  const fallback: SkillSettingsState = {
    additionalSkillPaths: [],
    disabledSkillPaths: [],
    suggestedSkillPaths: [],
  }
  if (!window.piDesktop.skills?.getSettings) return fallback
  const response = await window.piDesktop.skills.getSettings()
  return response.success && response.data ? response.data : fallback
}

function labelForScope(scope?: PiSkillResource['scope']): string {
  switch (scope) {
    case 'pi_global':
      return 'Pi Global'
    case 'shared_global':
      return 'Shared Global'
    case 'project':
      return 'Project'
    case 'settings':
      return 'Settings'
    case 'package':
      return 'Package'
    default:
      return 'Other'
  }
}

function groupSkillsBySource(skills: PiSkillResource[]): Array<{ label: string; skills: PiSkillResource[] }> {
  const groups = new Map<string, PiSkillResource[]>()
  for (const skill of skills) {
    const label = skill.sourceLabel || labelForScope(skill.scope)
    groups.set(label, [...(groups.get(label) || []), skill])
  }
  const order = ['Pi Global', 'Shared Global', 'Project', 'Settings', 'Package', 'Other']
  return Array.from(groups.entries())
    .sort(([left], [right]) => order.indexOf(left) - order.indexOf(right))
    .map(([label, groupSkills]) => ({ label, skills: groupSkills }))
}

function ScopeSummary({ counts }: { counts?: NonNullable<PiResourcesResult['summary']>['countsByScope'] }) {
  if (!counts) return null
  const entries = ([
    ['Pi Global', counts.pi_global || 0],
    ['Shared Global', counts.shared_global || 0],
    ['Project', counts.project || 0],
    ['Settings', counts.settings || 0],
    ['Package', counts.package || 0],
    ['Other', counts.other || 0],
  ] as Array<[string, number]>).filter(([, count]) => count > 0)

  if (entries.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {entries.map(([label, count]) => (
        <span
          key={label}
          style={{
            border: '1px solid var(--card-border)',
            borderRadius: 999,
            color: 'var(--text2)',
            background: 'color-mix(in srgb, var(--bg-chat) 84%, var(--accent) 5%)',
            padding: '2px 7px',
          }}
        >
          {label} {count}
        </span>
      ))}
    </div>
  )
}

function AdditionalSkillPaths({
  additionalPaths,
  suggestedPaths,
  onAdd,
  onRemove,
}: {
  additionalPaths: string[]
  suggestedPaths: string[]
  onAdd: (path: string) => void
  onRemove: (path: string) => void
}) {
  const existing = new Set(additionalPaths)
  const suggestions = suggestedPaths.filter((path) => !existing.has(path))
  return (
    <section style={{ borderBottom: '1px solid var(--bd)' }}>
      <div style={{ padding: '8px 14px 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text2)' }}>
        Additional skill paths
      </div>
      {suggestions.length > 0 ? (
        <div style={{ padding: '2px 14px 6px', fontSize: 11, color: 'var(--text2)' }}>
          External directories detected but not enabled
        </div>
      ) : null}
      {additionalPaths.length === 0 ? (
        <div style={{ padding: '2px 14px 6px', fontSize: 11, color: 'var(--text2)' }}>
          Add external agent skill directories manually. They are written to Pi global settings.
        </div>
      ) : (
        additionalPaths.map((path) => (
          <div key={path} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 14px', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text2)', wordBreak: 'break-all' }}>{path}</span>
            <SmallActionButton onClick={() => onRemove(path)}>Remove</SmallActionButton>
          </div>
        ))
      )}
      {suggestions.map((path) => (
        <div key={path} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 14px', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text2)', wordBreak: 'break-all' }}>{path}</span>
          <button
            onClick={() => onAdd(path)}
            style={{
              border: '1px solid var(--card-border)',
              background: 'var(--panel-bg)',
              borderRadius: 4,
              color: 'var(--text2)',
              fontFamily: 'inherit',
              fontSize: 11,
              padding: '4px 7px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {path.toLowerCase().includes('.codex') ? 'Add Codex skills' : 'Add Claude skills'}
          </button>
        </div>
      ))}
    </section>
  )
}

function DisabledSkillPaths({
  disabledPaths,
  onEnable,
}: {
  disabledPaths: string[]
  onEnable: (path: string) => void
}) {
  if (disabledPaths.length === 0) return null
  return (
    <section style={{ borderBottom: '1px solid var(--bd)' }}>
      <div style={{ padding: '8px 14px 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text2)' }}>
        Disabled skills
      </div>
      {disabledPaths.map((path) => (
        <div key={path} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 14px', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text2)', wordBreak: 'break-all' }}>{path}</span>
          <SmallActionButton onClick={() => onEnable(path)}>Enable skill</SmallActionButton>
        </div>
      ))}
    </section>
  )
}

function summarizeText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 96) return normalized
  return `${normalized.slice(0, 96).trim()}...`
}

function ResourceSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items
  return (
    <section style={{ borderBottom: '1px solid var(--bd)' }}>
      <div style={{ padding: '8px 14px 4px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text2)' }}>
        {title}
      </div>
      {isEmpty ? (
        <div style={{ padding: '8px 14px 12px', fontSize: 12, color: 'var(--text2)' }}>
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
  isExpandable = false,
  isExpanded = false,
  onToggleExpanded,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  diagnostics,
  actionTestId,
}: {
  label: string
  value: string
  source: string
  status: 'active' | 'inactive' | 'error'
  scope?: string
  isExpandable?: boolean
  isExpanded?: boolean
  onToggleExpanded?: () => void
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  diagnostics?: string[]
  actionTestId?: string
}) {
  const hasActions = Boolean((actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction))
  const displayValue = isExpandable && !isExpanded ? summarizeText(value) : value
  return (
    <div
      onClick={isExpandable ? onToggleExpanded : undefined}
      style={{
        display: 'flex',
        gap: 10,
        padding: '9px 14px',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--bd)',
        cursor: isExpandable ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          marginTop: 5,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background:
            status === 'active'
              ? 'color-mix(in srgb, var(--success) 72%, transparent)'
              : status === 'error'
                ? 'rgba(255,69,58,0.72)'
                : 'rgba(255,204,0,0.72)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>{label}</div>
          {isExpandable ? (
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>
              {isExpanded ? 'Hide details' : 'Show details'}
            </span>
          ) : null}
          {scope ? (
            <span style={{ fontSize: 10, color: 'var(--text2)', border: '1px solid var(--card-border)', borderRadius: 999, padding: '1px 6px' }}>
              {scope}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
          {displayValue}
        </div>
        {isExpanded || !isExpandable ? (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, wordBreak: 'break-all' }}>
            {source}
          </div>
        ) : null}
        {(isExpanded || !isExpandable) && diagnostics && diagnostics.length > 0 ? (
          <div style={{ fontSize: 10, color: 'color-mix(in srgb, #d97706 68%, var(--text))', marginTop: 4 }}>
            {diagnostics.join(' - ')}
          </div>
        ) : null}
      </div>
      {hasActions ? (
        <div
          data-testid={actionTestId}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            maxWidth: 230,
          }}
        >
          {actionLabel && onAction ? (
            <SmallActionButton onClick={onAction}>{actionLabel}</SmallActionButton>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <SmallActionButton onClick={onSecondaryAction}>{secondaryActionLabel}</SmallActionButton>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SmallActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      style={{
        border: '1px solid var(--card-border)',
        background: 'var(--panel-bg)',
        borderRadius: 4,
        color: 'var(--text2)',
        fontFamily: 'inherit',
        fontSize: 11,
        padding: '4px 7px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
