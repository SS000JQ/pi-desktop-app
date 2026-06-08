import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type EnvironmentStatus = 'ok' | 'warning' | 'missing' | 'error'
export type EnvironmentActionKind = 'open_url' | 'copy_command' | 'open_settings' | 'choose_directory' | 'none'

export interface EnvironmentCheckItem {
  id: 'pi-core' | 'ai-provider' | 'default-workspace' | 'git' | 'git-repository' | 'release-readiness'
  label: string
  status: EnvironmentStatus
  summary: string
  detail?: string
  actionLabel?: string
  actionKind?: EnvironmentActionKind
  actionValue?: string
}

export interface EnvironmentCheckResult {
  overallStatus: EnvironmentStatus
  generatedAt: string
  items: EnvironmentCheckItem[]
}

interface ProviderLike {
  hasAuth?: boolean
  models?: unknown[]
}

interface EnvironmentStatusDeps {
  loadPiCore: () => Promise<unknown>
  loadProviders: () => ProviderLike[]
  getConfigValue: (key: string) => unknown
  getEffectiveDefaultSessionDirectory: () => string
  pathExists: (path: string) => boolean
  checkGitVersion: () => Promise<string | null>
  checkGitRepository: (path?: string | null) => Promise<boolean | null>
  releaseReady: boolean
  workspacePath?: string | null
}

const GIT_INSTALL_COMMAND = 'winget install --id Git.Git -e --source winget'
const GIT_DOWNLOAD_URL = 'https://git-scm.com/download/win'

function toErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error')
}

function computeOverallStatus(items: EnvironmentCheckItem[]): EnvironmentStatus {
  const blockingItems = items.filter((item) => item.id !== 'git' && item.id !== 'git-repository')
  if (blockingItems.some((item) => item.status === 'error')) return 'error'
  if (blockingItems.some((item) => item.status === 'missing')) return 'missing'
  if (blockingItems.some((item) => item.status === 'warning')) return 'warning'
  return 'ok'
}

export async function buildEnvironmentStatus(deps: EnvironmentStatusDeps): Promise<EnvironmentCheckResult> {
  const items: EnvironmentCheckItem[] = []

  try {
    await deps.loadPiCore()
    items.push({
      id: 'pi-core',
      label: 'Pi Core',
      status: 'ok',
      summary: 'Pi Core is ready.',
    })
  } catch (error) {
    items.push({
      id: 'pi-core',
      label: 'Pi Core',
      status: 'error',
      summary: 'Pi Core failed to load.',
      detail: toErrorDetail(error),
    })
  }

  const providers = deps.loadProviders()
  const runnableProviders = providers.filter((provider) => Boolean(provider.hasAuth) && (provider.models?.length || 0) > 0)
  items.push(
    runnableProviders.length > 0
      ? {
          id: 'ai-provider',
          label: 'AI Provider',
          status: 'ok',
          summary: `${runnableProviders.length} configured provider${runnableProviders.length === 1 ? '' : 's'} available.`,
        }
      : {
          id: 'ai-provider',
          label: 'AI Provider',
          status: 'missing',
          summary: 'Configure an AI Provider before sending Pi requests.',
          actionLabel: 'Open Models',
          actionKind: 'open_settings',
        },
  )

  const rawDefaultDir = deps.getConfigValue('defaultSessionDirectory')
  const configuredDefaultDir = typeof rawDefaultDir === 'string' ? rawDefaultDir.trim() : ''
  const effectiveDefaultDir = deps.getEffectiveDefaultSessionDirectory()
  if (!configuredDefaultDir) {
    items.push({
      id: 'default-workspace',
      label: 'Default file address',
      status: 'warning',
      summary: 'Choose a default file address for new sessions.',
      detail: `Fallback currently resolves to ${effectiveDefaultDir}.`,
      actionLabel: 'Choose folder',
      actionKind: 'choose_directory',
    })
  } else if (!deps.pathExists(configuredDefaultDir)) {
    items.push({
      id: 'default-workspace',
      label: 'Default file address',
      status: 'warning',
      summary: 'The configured default file address does not exist yet.',
      detail: configuredDefaultDir,
      actionLabel: 'Choose folder',
      actionKind: 'choose_directory',
    })
  } else {
    items.push({
      id: 'default-workspace',
      label: 'Default file address',
      status: 'ok',
      summary: configuredDefaultDir,
    })
  }

  const gitVersion = await deps.checkGitVersion()
  items.push(
    gitVersion
      ? {
          id: 'git',
          label: 'Git',
          status: 'ok',
          summary: gitVersion.trim(),
        }
      : {
          id: 'git',
          label: 'Git',
          status: 'missing',
          summary: 'Git is optional, but enables version-control workflows.',
          detail: GIT_DOWNLOAD_URL,
          actionLabel: 'Copy install command',
          actionKind: 'copy_command',
          actionValue: GIT_INSTALL_COMMAND,
        },
  )

  const repositoryStatus = await deps.checkGitRepository(deps.workspacePath || configuredDefaultDir || null)
  items.push(
    repositoryStatus
      ? {
          id: 'git-repository',
          label: 'Git repository',
          status: 'ok',
          summary: 'Current workspace is inside a Git repository.',
        }
      : {
          id: 'git-repository',
          label: 'Git repository',
          status: 'warning',
          summary: 'Current workspace is not a Git repository. This is optional.',
        },
  )

  items.push(
    deps.releaseReady
      ? {
          id: 'release-readiness',
          label: 'Release readiness',
          status: 'ok',
          summary: 'README and license files are present.',
        }
      : {
          id: 'release-readiness',
          label: 'Release readiness',
          status: 'warning',
          summary: 'README or license files are missing from the source checkout.',
        },
  )

  return {
    overallStatus: computeOverallStatus(items),
    generatedAt: new Date().toISOString(),
    items,
  }
}

export async function checkGitVersion(): Promise<string | null> {
  try {
    const result = await execFileAsync('git', ['--version'], { windowsHide: true, timeout: 3000 })
    return result.stdout.trim() || null
  } catch {
    return null
  }
}

export async function checkGitRepository(path?: string | null): Promise<boolean | null> {
  if (!path) return null
  try {
    const result = await execFileAsync('git', ['-C', path, 'rev-parse', '--is-inside-work-tree'], {
      windowsHide: true,
      timeout: 3000,
    })
    return result.stdout.trim() === 'true'
  } catch {
    return false
  }
}

export function sourceReleaseReady(appRoot: string): boolean {
  return existsSync(`${appRoot}/README.md`) && existsSync(`${appRoot}/LICENSE`)
}
