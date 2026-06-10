import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join, normalize } from 'path'
import { getConfigValue, setConfigValue } from './config-store'
import { getCliAgentPaths } from './providers'

export interface SkillSearchResult {
  packageName: string
  name: string
  installs?: string
  url?: string
  description?: string
}

export interface SearchSkillsOptions {
  query: string
  limit?: number
  fetchImpl?: typeof fetch
}

export interface SkillSettings {
  additionalSkillPaths: string[]
  disabledSkillPaths: string[]
  suggestedSkillPaths: string[]
}

interface SkillSettingsOptions {
  settingsPath?: string
  getConfigValue?: (key: string) => unknown
}

interface SetAdditionalSkillPathsOptions {
  settingsPath?: string
  pathExists?: (path: string) => boolean
  isValidSkillPath?: (path: string) => boolean
}

interface SetDisabledSkillOptions {
  getConfigValue?: (key: string) => unknown
  setConfigValue?: (key: string, value: unknown) => void
  allowedSkillPaths?: string[]
}

interface SetSkillModelInvocationOptions {
  allowedSkillPaths?: string[]
}

function formatInstalls(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K installs`
  return `${value} installs`
}

function normalizePackageName(skill: Record<string, unknown>): string {
  const existing = typeof skill.packageName === 'string' ? skill.packageName : ''
  if (existing.trim()) return existing

  const source = typeof skill.source === 'string' ? skill.source : ''
  const name = typeof skill.name === 'string' ? skill.name : typeof skill.id === 'string' ? skill.id : 'skill'
  return source ? `${source}@${name}` : name
}

export async function searchSkills({
  query,
  limit = 20,
  fetchImpl = fetch,
}: SearchSkillsOptions): Promise<SkillSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `https://skills.sh/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`skills.sh search failed: ${response.status}`)
  }

  const payload = await response.json() as Record<string, unknown>
  const skills = Array.isArray(payload.skills)
    ? payload.skills
    : Array.isArray(payload.results)
      ? payload.results
      : []

  return skills.map((entry) => {
    const skill = entry as Record<string, unknown>
    const id = typeof skill.id === 'string' ? skill.id : ''
    const name = typeof skill.name === 'string' ? skill.name : id
    return {
      packageName: normalizePackageName(skill),
      name,
      installs: formatInstalls(skill.installs),
      url: typeof skill.url === 'string' && skill.url.trim()
        ? skill.url
        : id
          ? `https://skills.sh/${id}`
          : undefined,
      description: typeof skill.description === 'string' ? skill.description : undefined,
    }
  })
}

function normalizeSkillPath(filePath: string): string {
  return normalize(filePath).replace(/\\/g, '/').toLowerCase()
}

function normalizeSettingPath(filePath: string): string {
  return normalize(filePath)
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    if (!existsSync(filePath)) return {}
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function writeJsonFile(filePath: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []
}

function defaultSuggestedSkillPaths(): string[] {
  return [
    join(homedir(), '.codex', 'skills'),
    join(homedir(), '.claude', 'skills'),
  ]
}

function assertDiscoveredSkill(filePath: string, allowedSkillPaths?: string[]): void {
  if (!allowedSkillPaths) return
  const requested = normalizeSkillPath(filePath)
  const allowed = new Set(allowedSkillPaths.map(normalizeSkillPath))
  if (!allowed.has(requested)) {
    throw new Error('Refusing to update this file because it is not a discovered skill.')
  }
}

function defaultIsValidSkillPath(filePath: string): boolean {
  try {
    const stat = statSync(filePath)
    return stat.isDirectory() || (stat.isFile() && /(?:^|[\\/])SKILL\.md$/i.test(filePath))
  } catch {
    return false
  }
}

export function getSkillSettings(options: SkillSettingsOptions = {}): SkillSettings {
  const settingsPath = options.settingsPath || getCliAgentPaths().settingsPath
  const settings = readJsonFile(settingsPath)
  const configGetter = options.getConfigValue || getConfigValue

  return {
    additionalSkillPaths: readStringArray(settings.skills).map(normalizeSettingPath),
    disabledSkillPaths: readStringArray(configGetter('disabledSkillPaths')).map(normalizeSettingPath),
    suggestedSkillPaths: defaultSuggestedSkillPaths().map(normalizeSettingPath),
  }
}

export function setAdditionalSkillPaths(paths: string[], options: SetAdditionalSkillPathsOptions = {}): string[] {
  const settingsPath = options.settingsPath || getCliAgentPaths().settingsPath
  const pathExists = options.pathExists || existsSync
  const isValidSkillPath = options.isValidSkillPath || defaultIsValidSkillPath
  const normalized = Array.from(new Set(paths.map((entry) => normalizeSettingPath(entry.trim())).filter(Boolean)))

  for (const skillPath of normalized) {
    if (!pathExists(skillPath) || !isValidSkillPath(skillPath)) {
      throw new Error(`Additional skill path is not a valid directory or SKILL.md file: ${skillPath}`)
    }
  }

  const settings = readJsonFile(settingsPath)
  settings.skills = normalized
  writeJsonFile(settingsPath, settings)
  return normalized
}

export function setDisabledSkill(filePath: string, disabled: boolean, options: SetDisabledSkillOptions = {}): string[] {
  assertDiscoveredSkill(filePath, options.allowedSkillPaths)
  const configGetter = options.getConfigValue || getConfigValue
  const configSetter = options.setConfigValue || setConfigValue
  const current = readStringArray(configGetter('disabledSkillPaths'))
  const requestedKey = normalizeSkillPath(filePath)
  const next = current.filter((entry) => normalizeSkillPath(entry) !== requestedKey)

  if (disabled) {
    next.push(filePath)
  }

  const unique = Array.from(new Set(next))
  configSetter('disabledSkillPaths', unique)
  return unique
}

export function setSkillModelInvocation(
  filePath: string,
  disabled: boolean,
  options: SetSkillModelInvocationOptions = {},
): void {
  assertDiscoveredSkill(filePath, options.allowedSkillPaths)
  const content = readFileSync(filePath, 'utf-8')
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/)

  if (!frontmatterMatch) {
    const body = content.startsWith('\n') ? content : `\n${content}`
    const frontmatter = disabled ? '---\ndisable-model-invocation: true\n---' : '---\n---'
    writeFileSync(filePath, `${frontmatter}${body}`, 'utf-8')
    return
  }

  const frontmatter = frontmatterMatch[1]
  const body = frontmatterMatch[2] || ''
  const lines = frontmatter
    .split(/\r?\n/)
    .filter((line) => !/^\s*disable-model-invocation\s*:/.test(line))

  if (disabled) {
    lines.push('disable-model-invocation: true')
  }

  writeFileSync(filePath, `---\n${lines.join('\n')}\n---${body}`, 'utf-8')
}

export async function installSkill(_payload?: unknown): Promise<void> {
  throw new Error('Skill installation requires an explicit confirmation flow and is not implemented yet.')
}
