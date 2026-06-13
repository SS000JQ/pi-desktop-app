import { execFile } from 'child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { execPath } from 'process'
import { delimiter, dirname, join, normalize } from 'path'
import { promisify } from 'util'
import { getConfigValue, setConfigValue } from './config-store'
import { getCliAgentPaths } from './providers'

const execFileAsync = promisify(execFile)
const ANSI_RE = /\x1B\[[0-9;]*m/g

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
  runNpxImpl?: RunNpxImpl
}

export interface RunNpxOptions {
  timeout?: number
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export interface RunNpxResult {
  stdout: string
  stderr: string
}

export type RunNpxImpl = (args: string[], options: RunNpxOptions) => Promise<RunNpxResult>

export interface InstallSkillOptions {
  packageName: string
  scope: 'global' | 'project'
  cwd?: string
  runNpxImpl?: RunNpxImpl
}

interface NpxCommand {
  command: string
  argsPrefix: string[]
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
  runNpxImpl,
}: SearchSkillsOptions): Promise<SkillSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `https://skills.sh/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
  try {
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
  } catch {
    const runner = runNpxImpl || runNpx
    const output = await runner(['skills', 'find', trimmed], {
      timeout: 20_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    })
    return parseSkillsFindOutput(`${output.stdout}${output.stderr}`, limit)
  }
}

function cleanCliOutput(value: string): string {
  return value.replace(ANSI_RE, '').trim()
}

function parseSkillsFindOutput(raw: string, limit: number): SkillSearchResult[] {
  const lines = cleanCliOutput(raw).split(/\r?\n/)
  const results: SkillSearchResult[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    const match = line.match(/^([\w.\-]+\/[\w.\-@:]+)\s+([\d.,]+[KMB]?\s+installs?)$/i)
    if (!match) continue
    const packageName = match[1]
    const name = packageName.includes('@') ? packageName.split('@').pop() || packageName : packageName
    const nextLine = lines[index + 1]?.trim()
    results.push({
      packageName,
      name,
      installs: match[2],
      url: nextLine?.startsWith('https://') ? nextLine : undefined,
    })
    if (results.length >= limit) break
  }
  return results
}

function envPathValue(env: NodeJS.ProcessEnv = process.env): string {
  return env.Path || env.PATH || ''
}

function findExecutableOnPath(names: string[], env: NodeJS.ProcessEnv = process.env): string | null {
  const pathDirs = envPathValue(env).split(delimiter).filter(Boolean)
  for (const dir of pathDirs) {
    for (const name of names) {
      const candidate = join(dir, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

function findNpxCli(env: NodeJS.ProcessEnv = process.env): { nodeCommand: string; npxCli: string } | null {
  const nodeCommand = env.npm_node_execpath || findExecutableOnPath(['node.exe', 'node'], env) || execPath
  const npmExecPath = env.npm_execpath
  const npmBinDir = npmExecPath ? dirname(npmExecPath) : ''
  const nodeDir = dirname(nodeCommand)
  const candidates = [
    npmBinDir ? join(npmBinDir, 'npx-cli.js') : '',
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { nodeCommand, npxCli: candidate }
  }
  return null
}

function findNpxCommand(env: NodeJS.ProcessEnv = process.env): NpxCommand {
  const npxCli = findNpxCli(env)
  if (npxCli) {
    return { command: npxCli.nodeCommand, argsPrefix: [npxCli.npxCli] }
  }

  const npxExecutable = findExecutableOnPath(
    process.platform === 'win32' ? ['npx.cmd', 'npx.exe', 'npx'] : ['npx'],
    env,
  )
  if (npxExecutable) {
    return { command: npxExecutable, argsPrefix: [] }
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    argsPrefix: [],
  }
}

export async function runNpx(args: string[], options: RunNpxOptions = {}): Promise<RunNpxResult> {
  const env = options.env || process.env
  const npx = findNpxCommand(env)
  return execFileAsync(npx.command, [...npx.argsPrefix, ...args], {
    timeout: options.timeout,
    cwd: options.cwd,
    env,
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

export async function installSkill(payload?: InstallSkillOptions): Promise<{ output: string }> {
  const options: Partial<InstallSkillOptions> = payload || {}
  const packageName = options.packageName?.trim()
  if (!packageName) throw new Error('Skill package is required.')

  const scope = options.scope === 'project' ? 'project' : 'global'
  if (scope === 'project' && !options.cwd?.trim()) {
    throw new Error('A workspace is required to install a project skill.')
  }

  const args = ['skills', 'add', packageName, '-y', '--agent', 'pi']
  if (scope === 'global') args.push('-g')

  const runner = options.runNpxImpl || runNpx
  const result = await runner(args, {
    timeout: 60_000,
    cwd: scope === 'project' ? options.cwd : undefined,
    env: { ...process.env, FORCE_COLOR: '0' },
  })

  const output = cleanCliOutput(`${result.stdout}${result.stderr}`)
  if (!/Installation complete|Installed \d+ skill/i.test(output)) {
    throw new Error(output.slice(-500) || 'Skill installation failed.')
  }

  return { output }
}
