import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { app } from 'electron'
import { join } from 'path'
import { getConfigValue } from './config-store'
import { resolveOptionalExistingDirectory } from './path-utils'
import { getCliAgentPaths, getCliProviderState } from './providers'
import { getPiResources } from './pi-resources'

export interface DesktopStateEntry {
  id: string
  label: string
  value: string
  source: string
}

export interface DesktopSkillEntry {
  id: string
  label: string
  value: string
  source: string
  status: 'active' | 'inactive'
}

export interface DesktopConnectorEntry {
  id: string
  label: string
  value: string
  source: string
  status: 'active' | 'inactive'
}

const RECOVERY_PATH = join(app.getPath('userData'), 'pi-desktop', 'active-session.json')

function readActiveSessionKey(): string | null {
  try {
    if (!existsSync(RECOVERY_PATH)) return null
    const data = JSON.parse(readFileSync(RECOVERY_PATH, 'utf-8')) as { id?: string; path?: string }
    return data.path || data.id || null
  } catch {
    return null
  }
}

export function saveActiveSessionId(sessionId: string, sessionPath?: string): void {
  try {
    const dir = join(app.getPath('userData'), 'pi-desktop')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(
      RECOVERY_PATH,
      JSON.stringify({ id: sessionId, path: sessionPath, timestamp: new Date().toISOString() }, null, 2),
      'utf-8',
    )
  } catch {
    // Ignore recovery persistence failures.
  }
}

export function getActiveSessionId(): string | null {
  return readActiveSessionKey()
}

export async function getDesktopStateSummary(): Promise<{
  memory: DesktopStateEntry[]
  skills: DesktopSkillEntry[]
  connectors: DesktopConnectorEntry[]
}> {
  const workingDirectory = getConfigValue('workingDirectory')
  const resolvedWorkingDirectory = resolveOptionalExistingDirectory(typeof workingDirectory === 'string' ? workingDirectory : null)
  const { agentDir, settingsPath, authPath, modelsPath } = getCliAgentPaths()
  const providerState = getCliProviderState()
  const activeSessionId = readActiveSessionKey()
  const skillsDir = join(agentDir, 'skills')

  const memory: DesktopStateEntry[] = [
    {
      id: 'default-provider',
      label: 'Default provider',
      value: providerState.settings.defaultProvider || '(not set)',
      source: settingsPath,
    },
    {
      id: 'default-model',
      label: 'Default model',
      value: providerState.settings.defaultModel || '(not set)',
      source: settingsPath,
    },
    {
      id: 'auth-providers',
      label: 'Auth providers',
      value: providerState.authProviders.length > 0 ? providerState.authProviders.join(', ') : '(none)',
      source: authPath,
    },
    {
      id: 'working-directory',
      label: 'Current working directory',
      value: resolvedWorkingDirectory || '(not set)',
      source: join(app.getPath('userData'), 'pi-desktop', 'config.json'),
    },
    {
      id: 'active-session',
      label: 'Active session source',
      value: activeSessionId ? `Pi session ${activeSessionId}` : 'No active session selected',
      source: activeSessionId ? join(agentDir, 'sessions') : RECOVERY_PATH,
    },
    {
      id: 'model-config',
      label: 'Model config providers',
      value: providerState.modelsProviders.length > 0 ? providerState.modelsProviders.join(', ') : '(none)',
      source: modelsPath,
    },
  ]

  const resourceSummary = await getPiResources(resolvedWorkingDirectory)
  const skills: DesktopSkillEntry[] = resourceSummary.skills.length > 0
    ? resourceSummary.skills.map((entry) => ({
        id: entry.name,
        label: entry.name,
        value: entry.description || 'Discovered by Pi resource loader',
        source: entry.source,
        status: entry.status === 'active' ? 'active' as const : 'inactive' as const,
      }))
    : [
        {
          id: 'skills-unavailable',
          label: 'Skill sync status',
          value: resourceSummary.diagnostics[0] || 'No Pi skill entries discovered yet',
          source: skillsDir,
          status: 'inactive' as const,
        },
      ]

  const connectors: DesktopConnectorEntry[] = [
    {
      id: 'web-search',
      label: 'Web search',
      value: 'Available in the current desktop runtime',
      source: 'Desktop runtime',
      status: 'active',
    },
  ]

  return { memory, skills, connectors }
}
